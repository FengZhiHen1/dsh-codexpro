// index — DSH Host 侧装配入口：把配置意图、profile 投影、codexpro 进程与 RPC 通道接成一个 fiber。
//
// 边界：只做装配；领域逻辑在 core/，端点编排在 endpoints.js，profile 投影在 profile-sync.js，
// 进程在 process.js。配置真相 = 本行 loader entry 的 Cordis `Config`，即时字段操作时现读。
// 参考：technical-details/配置与profile投影.md、进程管理.md、RPC通道与设置页.md；DSR-001..008。

import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createDispatcher } from './endpoints.js'
import { readHealth } from './health.js'
import { ProcessManager, buildArgs, probeVersion, resolveEntry } from './process.js'
import { createProfileSync, pick } from './profile-sync.js'
import { registerRpcChannel } from './rpc-channel.js'
import { Config, assertConfigValid, configReader, installConfigValidation } from './settings.js'

/** 插件名，同时用作设置命名空间（= 本插件 loader 行的 id）。 */
const NAME = 'codexpro'

/** token 字节数：与 codexpro 自身的最小要求一致。 */
const TOKEN_BYTES = 24

/** 版本探测超时：本地 node 启动加读文件，5s 充裕。 */
const VERSION_TIMEOUT_MS = 5000

/**
 * Host 侧装配。
 * @param {object} ctx Host 插件上下文
 * @param {object} config loader 按 Config 校验并填默认后的配置（即时字段为 volatile 引用）
 * @returns {void}
 */
function apply(ctx, config = {}) {
  // 挂载期校验：`internal/config` 监听器在本行初次解析时尚未注册（解析先于 apply），
  // 故初次校验只能落在这里；抛错即让行挂载失败，比把非法配置带进第一次调用响亮。
  assertConfigValid(config)
  installConfigValidation(ctx)

  const readConfig = configReader(config)
  const manager = new ProcessManager({ subprocess: /** @type {any} */ (ctx).subprocess, logger: ctx.logger })
  const sync = buildSync(ctx, readConfig)

  registerRpcChannel(ctx, {
    dispatch: createDispatcher(buildDeps(ctx, readConfig, manager, sync)),
    warn: (text) => ctx.logger?.warn?.(`${NAME}: ${text}`),
  })

  // 配置经官方 configForms 写入 volatile 字段后，磁盘投影必须立即跟随：
  // profile 文件是 codexpro 的输入，不跟随就会出现「设置页显示已改、实际仍按旧值跑」。
  // 挂载期不触发（首次投影由 start 端点负责），失败只告警：设置写入本身已成功，
  // 回滚它会让用户在设置页看到与自己操作相反的结果。
  ctx.on('loader/volatile-update', () => {
    void sync.syncFromConfig().catch((error) => {
      ctx.logger?.warn?.(`${NAME}: 配置已写入，但 profile 同步失败：${messageOf(error)}`)
    })
  })

  // 进程清理挂在本 fiber 的 dispose 路径：插件卸载与 DSH 退出都会走到这里。
  // 只等不依赖本 fiber 结算的工作（子进程 OS 退出），不构成自我等待闭环。
  ctx.effect(() => () => manager.dispose(), `${NAME}: process teardown`)
}

/**
 * 组装 profile 同步器（端点的读候选、同步与配置变更监听共用同一份）。
 * @param {object} ctx Host 插件上下文
 * @param {{get: () => object}} readConfig 配置只读门面
 * @returns {object} profile-sync 同步器
 */
function buildSync(ctx, readConfig) {
  return createProfileSync({
    dshHome: () => String(ctx.dshHomePath()),
    snapshot: () => readConfig.get(),
    listWorkspaces: () => /** @type {any} */ (ctx).workspaceRegistry
      .list()
      .map((workspace) => ({ path: workspace.path, title: workspace.title })),
  })
}

/**
 * 组装端点编排所需的依赖面。
 * @param {object} ctx Host 插件上下文
 * @param {{get: () => object}} readConfig 配置只读门面
 * @param {ProcessManager} manager 进程管理器
 * @param {object} sync profile-sync 同步器
 * @returns {object} endpoints.createDispatcher 的依赖面
 */
function buildDeps(ctx, readConfig, manager, sync) {
  const snapshot = () => readConfig.get()

  return {
    snapshot,
    manager,
    resolvePaths: sync.resolvePaths,
    ensureAnchor: sync.ensureAnchor,
    readCandidates: sync.candidates,
    syncFromConfig: sync.syncFromConfig,
    ensureToken: () => ensureToken(ctx, snapshot),
    readHealth,
    resolveEntry,
    buildArgs,
    warnIfUnsupportedVersion: (entry) => warnIfUnsupportedVersion(entry, ctx.logger),
  }
}

/**
 * 从任意值提取可读消息。
 * @param {unknown} error 错误值
 * @returns {string} 可读消息
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 确保 token 已存在并返回之。
 * token 跨启停稳定是硬要求（ChatGPT 连接器会因 token 变化失效），故仅在为空时生成。
 * @param {object} ctx Host 插件上下文
 * @param {() => object} snapshot 配置快照读取器
 * @returns {Promise<string>} 当前 token
 */
async function ensureToken(ctx, snapshot) {
  const current = pick(snapshot(), 'httpToken', '')
  if (current !== '') return current
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  await ctx.settings.update(NAME, { httpToken: token })
  return token
}

/**
 * 探测 codexpro 版本，偏离已验证区间时只告警不阻断。
 * @param {string} entry CLI 入口
 * @param {object} logger 日志出口
 * @returns {Promise<void>} 探测完成后结算
 */
async function warnIfUnsupportedVersion(entry, logger) {
  const result = await probeVersion(entry, runCapture)
  if (result.version === '') {
    logger?.warn?.(`${NAME}: 无法探测 codexpro 版本${result.error ? `（${result.error}）` : ''}，按已知行为继续`)
    return
  }
  if (!result.supported) {
    logger?.warn?.(`${NAME}: codexpro ${result.version} 低于已验证下限，启动参数与 profile 形状可能不同`)
  }
}

/**
 * 执行子进程并捕获 stdout，用于版本探测。
 * 只读版本号，不进托管范围，故带独立超时而非走 ctx.subprocess。
 * @param {string} command 可执行文件
 * @param {string[]} args 参数
 * @returns {Promise<string>} stdout 文本
 */
function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: VERSION_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(String(stdout))
    })
  })
}

export { buildArgs, resolveEntry } from './process.js'
export { buildServerUrl } from './endpoints.js'

export default {
  name: NAME,
  // 静态依赖：workspaceRegistry 提供授权候选，connection 承载 RPC 路由，
  // subprocess 托管进程，settings 读写配置，dshHomePath 定位实例 HOME。
  inject: ['workspaceRegistry', 'connection', 'subprocess', 'settings', 'dshHomePath'],
  Config,
  apply,
}
