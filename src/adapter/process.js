// process — codexpro 进程的托管：可执行解析、spawn、状态维护、终止。
//
// 边界：全包唯一持有进程句柄之处；状态转换本身委托 core/state.js。
// 平台差异只允许出现在 resolveEntry：Windows 上裸名 codexpro 是 .cmd shim，
// 在 argv 不经 shell 解释的语义下必然 ENOENT，故一律以 node 执行 .mjs 入口。
// 终止顺序（实测定型）：stdin `q` → 等待退出 → terminate() 兜底。
//   `q` 是唯一触发 codexpro 自身 cleanup 的通道（回收 tunnel、删 runtime 文件）；
//   信号路径在 Windows 上不执行其 JS 处理器，故不作为主路径。
// 参考：technical-details/进程管理.md；DSR-004、DSR-007、DSR-008。

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import {
  ARG,
  FIXED_MODE,
  HOME_ENV,
  MIN_SUPPORTED_VERSION,
  START_POLL_MS,
  START_TIMEOUT_MS,
  STOP_GRACE_MS,
  VERSION_ARGS,
} from '../core/codexpro.js'
import { EVENTS, STATES, transition } from '../core/state.js'
import { probeHealth } from './health.js'

/** 输出收集上限：诊断尾部足够定位启动失败，不需要完整流。 */
const OUTPUT_MAX_BYTES = 64 * 1024

/** 停止后等待退出的轮询间隔。 */
const STOP_POLL_MS = 100

/** 诊断消息里输出尾部的截断长度。 */
const OUTPUT_TAIL_CHARS = 600

/**
 * 解析 codexpro CLI 入口的绝对路径。
 *
 * 三条候选路径，按可靠性排序。全局安装的包不在插件自身的解析路径上
 * （从 profile 加载时 require.resolve 会 MODULE_NOT_FOUND），故不能只靠前者。
 * @param {string} [execPath] Node 可执行文件路径；默认取 process.execPath
 * @returns {string} 入口绝对路径
 * @throws {Error} 三条路径都找不到时抛出（codexpro 未安装）
 */
export function resolveEntry(execPath = process.execPath) {
  const candidates = resolveCandidates(execPath)

  for (const packageJson of candidates) {
    if (!fs.existsSync(packageJson)) continue
    const entry = readBinEntry(packageJson)
    if (entry) return entry
  }
  throw new Error(
    'codexpro 未安装或包结构不符：已尝试 require.resolve、node 同级 node_modules 及其父级 lib。'
    + '请执行 npm install -g codexpro 后重试',
  )
}

/**
 * 列出 codexpro 包清单的候选路径。
 * require.resolve 是其中一条：它命中说明插件与 codexpro 同处一棵安装树（如 workspace 依赖）。
 * 该调用在全局安装下必然抛错（全局包不在插件的解析路径上），故用 try 捕获此预期结果，
 * 而非把它当失败——探测语义由返回值表达，调用方不区分来源只按顺序取第一个可用者。
 * @param {string} execPath Node 可执行文件路径
 * @returns {string[]} 候选包清单绝对路径
 */
function resolveCandidates(execPath) {
  const candidates = []
  try {
    candidates.push(createRequire(import.meta.url).resolve('codexpro/package.json'))
  } catch (error) {
    // 预期路径：全局安装时解析不到。非 MODULE_NOT_FOUND 说明环境异常，如实上抛。
    if (error?.code !== 'MODULE_NOT_FOUND') throw error
  }
  const execDir = path.dirname(execPath)
  candidates.push(path.join(execDir, 'node_modules', 'codexpro', 'package.json'))
  candidates.push(path.join(execDir, '..', 'lib', 'node_modules', 'codexpro', 'package.json'))
  return candidates
}

/**
 * 从包清单读取 CLI 入口并解析为绝对路径。
 * @param {string} packageJson 包清单绝对路径
 * @returns {string|null} 入口绝对路径；清单不可读、无 bin 或入口不存在时返回 null
 */
function readBinEntry(packageJson) {
  try {
    const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8'))
    const bin = manifest?.bin
    const relative = typeof bin === 'string' ? bin : bin?.codexpro
    if (typeof relative !== 'string' || relative === '') return null
    const entry = path.resolve(path.dirname(packageJson), relative)
    return fs.existsSync(entry) ? entry : null
  } catch {
    return null
  }
}

/**
 * 构造 codexpro 启动参数。不含 `--headless`（会绕开 stdin 控制通道）与 `--token`
 * （token 经 profile 文件传递，避免出现在可被同机进程读取的命令行里）。
 * @param {object} input
 * @param {string} input.anchorDir 锚点目录
 * @param {string} input.port 端口
 * @param {string} input.tunnel tunnel 取值
 * @param {string} [input.hostname] 具名 tunnel 的 hostname
 * @param {string} input.bashMode bash 模式
 * @param {string} input.writeMode 写入模式
 * @returns {string[]} 参数数组（不含 node 与入口）
 */
export function buildArgs(input) {
  const args = [
    'start',
    ARG.root, input.anchorDir,
    ARG.port, input.port,
    ARG.tunnel, input.tunnel,
    ARG.mode, FIXED_MODE,
    ARG.bash, input.bashMode,
    ARG.write, input.writeMode,
  ]
  if (input.hostname) args.push(ARG.hostname, input.hostname)
  return args
}

/** codexpro 进程管理器：持有句柄与状态，对上层暴露 start / stop / snapshot。 */
export class ProcessManager {
  /**
   * @param {object} deps
   * @param {object} deps.subprocess ctx.subprocess 服务
   * @param {object} deps.logger 日志出口（需有 warn）
   */
  constructor({ subprocess, logger }) {
    this.subprocess = subprocess
    this.logger = logger
    /** 当前状态（core/state.js 的 STATES 成员）。 */
    this.state = STATES.idle
    /** 当前进程句柄；无进程时为 null。 */
    this.handle = null
    /** 最近一次失败原因；成功启动后清空。 */
    this.lastError = ''
    /** 最近一次退出事实。 */
    this.lastExit = null
    /** 最近一次使用的 CLI 入口，供状态面展示。 */
    this.entry = ''
    /** 句柄 done 是否已结算；由 attachExit 维护。 */
    this.settled = true
  }

  /**
   * 读取当前状态快照。
   * @returns {{state: string, lastError: string, entry: string}} 状态快照
   */
  snapshot() {
    return { state: this.state, lastError: this.lastError, entry: this.entry }
  }

  /**
   * 应用一个状态事件；被拒的转换只记日志、不改状态（拒绝是返回值而非异常，
   * 因为重复点击属正常用户行为）。
   * @param {string} event 事件（core/state.js 的 EVENTS 成员）
   * @returns {boolean} 转换是否被接受
   */
  applyEvent(event) {
    const result = transition(this.state, event)
    if (!result.ok) {
      this.logger?.warn?.(`dsh-codexpro: ${result.reason}`)
      return false
    }
    this.state = result.state
    return true
  }

  /**
   * 启动 codexpro 并等待健康探测通过。
   * @param {object} spec
   * @param {string} spec.entry CLI 入口绝对路径
   * @param {string[]} spec.argv 参数数组
   * @param {string} spec.cwd 工作目录
   * @param {string} spec.home codexpro 数据目录（经 env 传入）
   * @param {number} spec.port 端口（健康探测用）
   * @param {string} spec.token HTTP token（健康探测认证用）
   * @returns {Promise<{ok: true} | {ok: false, code: string, message: string}>} 启动结果
   */
  async start(spec) {
    if (!this.applyEvent(EVENTS.start)) {
      return { ok: false, code: 'ALREADY_RUNNING', message: `当前状态为 ${this.state}，无法启动` }
    }
    this.lastError = ''
    this.lastExit = null
    this.entry = spec.entry

    let handle
    try {
      handle = this.spawn(spec)
    } catch (error) {
      const message = `无法启动 codexpro：${messageOf(error)}`
      this.fail(message)
      return { ok: false, code: 'SPAWN_FAILED', message }
    }
    this.handle = handle
    this.attachExit(handle)

    const ready = await this.waitReady(spec.port, spec.token)
    if (!ready.ok) {
      this.fail(ready.message)
      await this.forceTerminate()
      return { ok: false, code: 'START_FAILED', message: ready.message }
    }
    this.state = STATES.running
    return { ok: true }
  }

  /**
   * 按 seam 规格 spawn 子进程。规格不提供默认值，故每一项都显式给出。
   * @param {object} spec start 的规格参数
   * @returns {object} SubprocessHandle
   */
  spawn(spec) {
    return this.subprocess.spawn({
      argv: [process.execPath, spec.entry, ...spec.argv],
      cwd: spec.cwd,
      stdio: {
        // stdin 必须为 pipe：停止主路径依赖它（DSR-007）。ignore 会让 q 无处可写。
        stdin: 'pipe',
        stdout: { maxBytes: OUTPUT_MAX_BYTES },
        stderr: { maxBytes: OUTPUT_MAX_BYTES },
      },
      graceMs: STOP_GRACE_MS,
      // token 不经 env 传递（会被 ctx.subprocess 的凭证形状清洗剔除），故只传数据目录隔离项。
      env: { [HOME_ENV]: spec.home },
    })
  }

  /**
   * 订阅句柄退出结算，缓存退出事实。
   * @param {object} handle SubprocessHandle
   * @returns {void}
   */
  attachExit(handle) {
    this.settled = false
    Promise.resolve(handle.done).then(
      (outcome) => {
        this.settled = true
        this.lastExit = { exitCode: outcome?.exitCode ?? null, signal: outcome?.signal ?? null }
      },
      (error) => {
        this.settled = true
        this.lastExit = { exitCode: null, signal: null }
        this.logger?.warn?.(`dsh-codexpro: 子进程异常结算：${messageOf(error)}`)
      },
    )
  }

  /**
   * 等待健康探测通过，或在超时、进程提前退出时失败。
   * @param {number} port 端口
   * @param {string} token HTTP token
   * @returns {Promise<{ok: true} | {ok: false, message: string}>} 结果
   */
  async waitReady(port, token) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < START_TIMEOUT_MS) {
      // 进程提前退出：不必等满超时，立即带诊断失败。
      if (this.settled) return { ok: false, message: this.exitMessage() }
      if (await probeHealth(port, token)) return { ok: true }
      await delay(START_POLL_MS)
    }
    return { ok: false, message: `等待 codexpro 就绪超时（${START_TIMEOUT_MS} ms）。${this.outputTail()}` }
  }

  /**
   * 停止 codexpro：先走 stdin `q`（触发其自身清理），超时后走 terminate 兜底。
   * @returns {Promise<{ok: true} | {ok: false, code: string, message: string}>} 停止结果
   */
  async stop() {
    if (this.handle === null) {
      this.applyEvent(EVENTS.exited)
      return { ok: true }
    }
    if (!this.applyEvent(EVENTS.stop)) {
      return { ok: false, code: 'NOT_RUNNING', message: `当前状态为 ${this.state}，无法停止` }
    }

    // 主路径：向 stdin 写 q。写失败（管道已关）不是错误——进程已退出或正在退出。
    try {
      this.handle.stdin?.write('q')
    } catch (error) {
      this.logger?.warn?.(`dsh-codexpro: 写入 stdin 失败，将走 terminate 兜底：${messageOf(error)}`)
    }

    if (!(await this.waitStopped(STOP_GRACE_MS))) {
      this.logger?.warn?.('dsh-codexpro: stdin q 未在宽限期内结束进程，改走 terminate 兜底')
    }
    await this.forceTerminate()
    this.applyEvent(EVENTS.exited)
    return { ok: true }
  }

  /**
   * 等待被 spawn 的命令退出，预算内未退出则返回 false。
   * @param {number} budgetMs 预算毫秒
   * @returns {Promise<boolean>} 预算内退出时为 true
   */
  async waitStopped(budgetMs) {
    const deadline = Date.now() + budgetMs
    while (Date.now() < deadline) {
      if (this.settled) return true
      await delay(STOP_POLL_MS)
    }
    return this.settled
  }

  /**
   * 兜底终止：seam 的唯一终止动词 + 等待托管范围清空。
   * 该路径不触发 codexpro 自身清理，故仅在前者失败时使用。
   * @returns {Promise<void>} 终止完成后结算
   */
  async forceTerminate() {
    const handle = this.handle
    if (handle === null) return
    this.handle = null
    try {
      handle.terminate()
      await handle.waitForExit()
    } catch (error) {
      // 范围已不可观察时 waitForExit 会抛；进程已被 terminate 发出终止请求，
      // 此处只记录不改变结论——清理路径不应因观测失败而中断。
      this.logger?.warn?.(`dsh-codexpro: 等待进程退出时出错：${messageOf(error)}`)
    }
  }

  /**
   * 插件卸载时的清理：尽力停止并把异常限制在本方法内，绝不让其冒泡到 disposer
   * （disposer 抛错会打断 fiber 卸载链）。
   * @returns {Promise<void>} 清理完成后结算
   */
  async dispose() {
    if (this.handle === null) return
    try {
      await this.stop()
    } catch (error) {
      this.logger?.warn?.(`dsh-codexpro: 停止失败，改走强制终止：${messageOf(error)}`)
      await this.forceTerminate()
    }
  }

  /**
   * 由退出事实构造可读消息，附输出尾部。
   * @returns {string} 消息
   */
  exitMessage() {
    const exit = this.lastExit
    const how = exit === null
      ? '进程已退出'
      : exit.signal ? `信号 ${exit.signal}` : `退出码 ${exit.exitCode}`
    return `codexpro 在就绪前退出（${how}）。${this.outputTail()}`
  }

  /**
   * 取 stdout 与 stderr 的尾部，用于失败诊断。
   * @returns {string} 输出尾部；无内容时返回空串
   */
  outputTail() {
    const parts = []
    const stdout = this.readCollected('stdout')
    const stderr = this.readCollected('stderr')
    if (stdout) parts.push(`stdout: ${stdout}`)
    if (stderr) parts.push(`stderr: ${stderr}`)
    return parts.join(' | ')
  }

  /**
   * 读取某个 collected 流的全部内容（偏移读取不消耗流，可重复调用）。
   * @param {'stdout'|'stderr'} name 流名
   * @returns {string} 文本；不可读时返回空串
   */
  readCollected(name) {
    try {
      const reader = this.handle?.collected?.[name]
      if (!reader) return ''
      return String(reader.readFrom(0).text ?? '').trim().slice(-OUTPUT_TAIL_CHARS)
    } catch (error) {
      // 读取失败只影响诊断信息，不应掩盖真实失败原因。
      this.logger?.warn?.(`dsh-codexpro: 读取 ${name} 失败：${messageOf(error)}`)
      return ''
    }
  }

  /**
   * 记录失败状态与原因。
   * @param {string} message 可读原因
   * @returns {void}
   */
  fail(message) {
    this.lastError = message
    this.state = STATES.failed
  }
}

/**
 * 探测 codexpro 版本并判断是否达到支持下限。
 * @param {string} entry CLI 入口绝对路径
 * @param {(command: string, args: string[]) => Promise<string>} run 执行器（注入以便测试）
 * @returns {Promise<{version: string, supported: boolean}>} 版本与是否受支持
 */
export async function probeVersion(entry, run) {
  let raw = ''
  try {
    raw = await run(process.execPath, [entry, ...VERSION_ARGS])
  } catch (error) {
    return { version: '', supported: false, error: messageOf(error) }
  }
  const version = String(raw).trim().split(/\s+/).pop() ?? ''
  return { version, supported: compareVersions(version, MIN_SUPPORTED_VERSION) >= 0 }
}

/**
 * 比较两个语义化版本；忽略预发布标签，只比较主次修订号。
 * @param {string} left 左版本
 * @param {string} right 右版本
 * @returns {number} left 大于 right 为 1，相等为 0，小于为 -1
 */
export function compareVersions(left, right) {
  const parse = (value) => String(value).split('-')[0].split('.').map((part) => Number(part) || 0)
  const a = parse(left)
  const b = parse(right)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * 延时。
 * @param {number} ms 毫秒
 * @returns {Promise<void>} 延时承诺
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 从任意值提取可读消息。
 * @param {unknown} error 任意错误值
 * @returns {string} 可读消息
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
