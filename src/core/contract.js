// contract — Host↔Client RPC 的信封与载荷契约：零依赖运行时校验，单一事实源。
//
// 边界：纯 JS、无外部依赖（client bundle 经 esbuild 打包本模块，不引 zod 以控体积）。
// 校验不出副本，通过即返回原值。Host 在入站解析信封，Client 在出站复验载荷。
// 参考：technical-details/RPC通道与设置页.md §三；DSH_Plugins docs/decisions/0002。

/** 契约违例：载荷形状与本模块声明不符；path 指明失配位置。 */
export class ContractError extends Error {
  /**
   * @param {string} path 失配字段路径
   * @param {string} expect 期望形状描述
   * @param {unknown} actual 实际值
   */
  constructor(path, expect, actual) {
    const got = actual === null ? 'null' : Array.isArray(actual) ? 'array' : typeof actual
    super(`RPC 载荷契约违例 @${path}：期望 ${expect}，实际 ${got}`)
    this.name = 'ContractError'
    /** 失配字段路径。 */
    this.path = path
  }
}

/**
 * 断言条件成立，否则抛契约违例。
 * @param {boolean} condition 条件
 * @param {string} path 字段路径
 * @param {string} expect 期望描述
 * @param {unknown} actual 实际值
 * @returns {void}
 */
function need(condition, path, expect, actual) {
  if (!condition) throw new ContractError(path, expect, actual)
}

/**
 * 断言值是普通对象。
 * @param {unknown} value 待检值
 * @param {string} path 字段路径
 * @returns {void}
 */
function needObject(value, path) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'object', value)
}

/**
 * 断言值是字符串。
 * @param {unknown} value 待检值
 * @param {string} path 字段路径
 * @returns {void}
 */
function needString(value, path) {
  need(typeof value === 'string', path, 'string', value)
}

/** 端点词表：与 Host 注册的路由集合同源。 */
export const ENDPOINTS = Object.freeze([
  'catalog',
  'setAuthorization',
  'status',
  'start',
  'stop',
  'configure',
])

/** RPC 命名空间段。 */
export const RPC_NAMESPACE = 'codexpro'

/** 平台共享承载前缀。自定义能力一律挂在它之下。 */
export const API_CHANNEL = '/api'

/**
 * 判断端点名是否合法（进入 `/api/<ns>/<ep>` 路径的安全字符集）。
 * @param {string} endpoint 端点名
 * @returns {boolean} 合法时为 true
 */
export function isValidEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint === '') return false
  return ENDPOINTS.includes(endpoint)
}

/**
 * 解析平台 client-request 信封。脏信封一律返回 undefined，由调用方回 400。
 * @param {unknown} body 已解析的 JSON 体
 * @returns {{rpcId: string, method: string, payload: unknown} | undefined} 合法信封或 undefined
 */
export function parseEnvelope(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined
  const { type, rpcId, method } = /** @type {Record<string, unknown>} */ (body)
  if (type !== 'client-request') return undefined
  if (typeof rpcId !== 'string' || rpcId === '') return undefined
  if (typeof method !== 'string') return undefined
  return { rpcId, method, payload: /** @type {Record<string, unknown>} */ (body).payload }
}

/**
 * 封装平台 server-response 信封。
 * @param {string} rpcId 请求带回的相关 id
 * @param {{ok: boolean, value?: unknown, error?: unknown}} result 结果
 * @returns {{type: 'server-response', rpcId: string, result: unknown}} 响应信封
 */
export function envelopeOf(rpcId, result) {
  return { type: 'server-response', rpcId, result }
}

/**
 * 构造成功结果。
 * @param {unknown} value 载荷
 * @returns {{ok: true, value: unknown}} 成功结果
 */
export function ok(value) {
  return { ok: true, value }
}

/**
 * 构造失败结果。
 * @param {string} code 稳定错误码
 * @param {string} message 可读原因
 * @returns {{ok: false, error: {code: string, message: string}}} 失败结果
 */
export function fail(code, message) {
  return { ok: false, error: { code, message } }
}

/** 稳定错误码词表。 */
export const ERROR_CODES = Object.freeze({
  invalidConfig: 'INVALID_CONFIG',
  configWriteFailed: 'CONFIG_WRITE_FAILED',
  notFound: 'NOT_FOUND',
  alreadyRunning: 'ALREADY_RUNNING',
  notRunning: 'NOT_RUNNING',
  spawnFailed: 'SPAWN_FAILED',
  startFailed: 'START_FAILED',
  stopFailed: 'STOP_FAILED',
  unsupported: 'UNSUPPORTED',
  internal: 'INTERNAL',
})

/**
 * 校验 `setAuthorization` 的载荷。
 * 形状不符时由内部断言抛 ContractError（错误带失配字段路径）。
 * @param {unknown} payload 入站载荷
 * @returns {Record<string, boolean>} 归一后的映射
 */
export function parseAuthorizationPayload(payload) {
  needObject(payload, 'payload')
  const { authorized } = /** @type {Record<string, unknown>} */ (payload)
  needObject(authorized, 'payload.authorized')
  /** @type {Record<string, boolean>} */
  const result = {}
  for (const [key, value] of Object.entries(authorized)) {
    need(typeof value === 'boolean', `payload.authorized.${key}`, 'boolean', value)
    result[key] = value
  }
  return result
}

/**
 * 校验 `configure` 的载荷：字段可选，出现则须为字符串。
 * 形状不符时由内部断言抛 ContractError（错误带失配字段路径）。
 * @param {unknown} payload 入站载荷
 * @returns {Record<string, string>} 仅含出现过的字段
 */
export function parseConfigurePayload(payload) {
  needObject(payload, 'payload')
  const source = /** @type {Record<string, unknown>} */ (payload)
  const fields = ['tunnelMode', 'tunnelHostname', 'port', 'bashMode', 'writeMode']
  /** @type {Record<string, string>} */
  const result = {}
  for (const field of fields) {
    const value = source[field]
    if (value === undefined) continue
    needString(value, `payload.${field}`)
    result[field] = value
  }
  return result
}

/**
 * 校验 `catalog` / `status` / `start` / `stop` 的空载荷。
 * 形状不符时由内部断言抛 ContractError（错误带失配字段路径）。
 * @param {unknown} payload 入站载荷
 * @returns {void}
 */
export function parseEmptyPayload(payload) {
  if (payload === undefined || payload === null) return
  needObject(payload, 'payload')
}
