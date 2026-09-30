// endpoints — RPC 端点的处理逻辑：每个端点一项纯编排，返回 Result 信封。
//
// 边界：不注册路由（由 rpc-channel.js 做）、不持有进程句柄（由 process.js 持有）；
// 本模块只把「配置意图 + 工作区注册表 + 进程管理器」编排成端点语义。
// 参考：technical-details/RPC通道与设置页.md §二/§三；DSR-006。

import {
  ERROR_CODES,
  ContractError,
  fail,
  ok,
  parseEmptyPayload,
} from '../core/contract.js'
import { DEFAULTS } from '../core/codexpro.js'

/**
 * 构造端点编排所需的依赖面。
 * 各端点共享同一份「读配置、读候选、写 profile」能力，避免逐端点重复编排。
 * @param {object} deps
 * @param {() => object} deps.snapshot 读当前配置快照
 * @param {() => {home: string, anchor: string}} deps.resolvePaths 解析数据目录与锚点
 * @param {(anchor: string) => Promise<string>} deps.ensureAnchor 确保锚点存在并返回 realpath
 * @param {() => Promise<Array<object>>} deps.readCandidates 读候选集（含存在性与授权态）
 * @param {() => Promise<object>} deps.syncFromConfig 由当前配置同步 profile
 * @param {object} deps.manager 进程管理器
 * @returns {(endpoint: string, payload: unknown) => Promise<object>} 分发器
 */
export function createDispatcher(deps) {
  const handlers = {
    catalog: (payload) => handleCatalog(deps, payload),
    status: (payload) => handleStatus(deps, payload),
    start: (payload) => handleStart(deps, payload),
    stop: (payload) => handleStop(deps, payload),
  }

  return async (endpoint, payload) => {
    const handler = handlers[endpoint]
    if (handler === undefined) return fail(ERROR_CODES.notFound, `未知端点：${endpoint}`)
    try {
      return await handler(payload)
    } catch (error) {
      // 契约违例是调用方的错（消息可直接指导纠正）；其余归内部错误。
      // 都不外抛：抛出会被平台记为传输失败，丢失这里的可诊断信息。
      if (error instanceof ContractError) return fail(ERROR_CODES.invalidConfig, error.message)
      return fail(ERROR_CODES.internal, messageOf(error))
    }
  }
}

/**
 * catalog 端点：候选工作区、各目录存在性、当前授权态与当前参数值。
 *
 * 授权态与参数值一并返回，使客户端在 Host 表单快照尚未就绪时仍能渲染出可读内容；
 * 表单的草稿与写入一律以官方 configForms 为准（本端点只读）。
 * @param {object} deps 依赖面
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result
 */
async function handleCatalog(deps, payload) {
  parseEmptyPayload(payload)
  const values = deps.snapshot()
  const paths = deps.resolvePaths()
  return ok({
    workspaces: await deps.readCandidates(),
    dataHome: paths.home,
    anchorDir: paths.anchor,
    tunnelMode: pick(values, 'tunnelMode', DEFAULTS.tunnel),
    tunnelHostname: pick(values, 'tunnelHostname', ''),
    port: pick(values, 'port', DEFAULTS.port),
    bashMode: pick(values, 'bashMode', DEFAULTS.bash),
    writeMode: pick(values, 'writeMode', DEFAULTS.write),
  })
}

/**
 * status 端点：进程状态、展示用 URL 与健康详情。
 * token 仅用于拼接供用户粘贴到 ChatGPT 连接器的 URL；该端点由平台认证层保护。
 * @param {object} deps 依赖面
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result
 */
async function handleStatus(deps, payload) {
  parseEmptyPayload(payload)
  const values = deps.snapshot()
  const port = pick(values, 'port', DEFAULTS.port)
  const tunnel = pick(values, 'tunnelMode', DEFAULTS.tunnel)
  const hostname = pick(values, 'tunnelHostname', '')
  const token = pick(values, 'httpToken', '')
  const health = deps.manager.state === 'running' ? await deps.readHealth(Number(port), token) : { ok: false, details: null }
  return ok({
    state: deps.manager.state,
    port,
    tunnel,
    token,
    url: token ? buildServerUrl(tunnel, hostname, port, token) : '',
    health: health.details,
    lastError: deps.manager.lastError,
    anchorDir: deps.resolvePaths().anchor,
  })
}

/**
 * start 端点：确保 token 与 profile 就绪，再 spawn 并等待健康探测。
 * @param {object} deps 依赖面
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result
 */
async function handleStart(deps, payload) {
  parseEmptyPayload(payload)
  // token 必须先就绪：它要写进 profile 的 token 字段，且解析可执行前不依赖其他状态。
  const token = await deps.ensureToken()
  const synced = await deps.syncFromConfig()
  const paths = deps.resolvePaths()
  const realAnchor = await deps.ensureAnchor(paths.anchor)
  const values = deps.snapshot()

  let entry
  try {
    entry = deps.resolveEntry()
  } catch (error) {
    return fail(ERROR_CODES.spawnFailed, messageOf(error))
  }
  await deps.warnIfUnsupportedVersion(entry)

  const result = await deps.manager.start({
    entry,
    argv: deps.buildArgs({
      anchorDir: realAnchor,
      port: pick(values, 'port', DEFAULTS.port),
      tunnel: pick(values, 'tunnelMode', DEFAULTS.tunnel),
      hostname: pick(values, 'tunnelHostname', ''),
      bashMode: pick(values, 'bashMode', DEFAULTS.bash),
      writeMode: pick(values, 'writeMode', DEFAULTS.write),
    }),
    cwd: realAnchor,
    home: paths.home,
    port: Number(pick(values, 'port', DEFAULTS.port)),
    token,
  })
  if (!result.ok) return fail(result.code, result.message)
  return ok({ state: deps.manager.state, written: synced.written, allowedRoots: synced.allowedRoots })
}

/**
 * stop 端点：停止进程。
 * @param {object} deps 依赖面
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result
 */
async function handleStop(deps, payload) {
  parseEmptyPayload(payload)
  const result = await deps.manager.stop()
  return result.ok ? ok({ state: deps.manager.state }) : fail(result.code, result.message)
}

/**
 * 从配置快照取字符串字段，缺失时回落默认值。
 * @param {object} values 配置快照
 * @param {string} key 字段名
 * @param {string} fallback 默认值
 * @returns {string} 字段值
 */
function pick(values, key, fallback) {
  const value = values[key]
  return value === undefined || value === null || value === '' ? fallback : String(value)
}

/**
 * 构造供 ChatGPT 连接器使用的 Server URL。
 * token 作为查询参数是 codexpro 自身支持的形态（另一种是 Authorization 头）。
 * @param {string} tunnel tunnel 取值
 * @param {string} hostname 公网 hostname
 * @param {string} port 本地端口
 * @param {string} token HTTP token
 * @returns {string} Server URL；无公网 hostname 时回落本地回环 URL
 */
export function buildServerUrl(tunnel, hostname, port, token) {
  const base = tunnel === 'none' || hostname === '' ? `http://127.0.0.1:${port}` : `https://${hostname}`
  return `${base}/mcp?codexpro_token=${encodeURIComponent(token)}`
}

/**
 * 从任意值提取可读消息。
 * @param {unknown} error 任意错误值
 * @returns {string} 可读消息
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
