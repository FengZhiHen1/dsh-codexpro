// api — Client→Host 传输层：统一收口业务失败与 transport 失败为 RpcError。
//
// 边界：调度语义在 Host，本层只管超时与错误归一；UI 层只认 RpcError。
// 通道用 /api 精确 Fetch 路由，端点串含命名空间（见 Host 侧 rpc-channel.js）。
// 参考：technical-details/RPC通道与设置页.md §四；DSH_Plugins docs/decisions/0002。

import { API_CHANNEL, RPC_NAMESPACE } from '../core/contract.js'

/**
 * 单次调用的超时预算。取值 15000ms：RPC 端点均为本地快操作
 * （读注册表、写一个 JSON、spawn 探测），但 start 会等待就绪探测，
 * 故预算需覆盖其 START_TIMEOUT_MS 之外的余量。
 */
const CALL_TIMEOUT_MS = 15000

/** 统一错误形状：UI catch 后读 code 决定呈现。 */
export class RpcError extends Error {
  /**
   * @param {string} message 可读消息
   * @param {object} [options]
   * @param {string} [options.code] 稳定错误码；transport 表示通道层失败
   */
  constructor(message, { code = 'internal' } = {}) {
    super(message)
    this.name = 'RpcError'
    /** 稳定错误码。 */
    this.code = code
  }
}

/**
 * 创建调用门面：经 `/api` 通道调端点，成功返回 value，失败统一抛 RpcError。
 * @param {object} ctx Client 插件上下文（inject 含 connection）
 * @returns {(endpoint: string, payload?: object) => Promise<unknown>} 调用函数
 * @throws {RpcError} 传输失败与业务失败都转为此类型
 */
export function createCall(ctx) {
  return async (endpoint, payload = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
    let result
    try {
      result = await ctx.connection.rpc.call(API_CHANNEL, `${RPC_NAMESPACE}/${endpoint}`, payload, controller.signal)
    } catch (error) {
      throw toTransportError(error, endpoint)
    } finally {
      clearTimeout(timer)
    }
    if (result !== null && typeof result === 'object' && result.ok === true) return result.value
    const failure = result !== null && typeof result === 'object' && result.error ? result.error : {}
    throw new RpcError(failure.message || '请求失败', { code: failure.code || 'internal' })
  }
}

/**
 * 把 transport 异常归一为 RpcError。
 * 超时按「未知」措辞呈现：Host 侧写操作不被客户端取消打断，谎称失败会误导用户重试。
 * @param {unknown} error 抛出的错误
 * @param {string} endpoint 端点名
 * @returns {RpcError} 归一后的错误
 */
export function toTransportError(error, endpoint) {
  if (error instanceof RpcError) return error
  const aborted = Boolean(error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  const message = aborted
    ? `调用 ${endpoint} 超时（${CALL_TIMEOUT_MS / 1000}s）：结果未知——Host 侧动作可能仍在进行，请刷新状态核对。`
    : `与 Host 的 RPC 通道失败（${endpoint}）：${error && error.message ? error.message : String(error)}`
  return new RpcError(message, { code: 'transport' })
}
