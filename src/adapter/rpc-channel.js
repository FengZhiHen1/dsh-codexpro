// rpc-channel — 自定义 RPC 通道的 `/api` 精确 Fetch 路由承载。
//
// 不使用 connection.rpc.handle：它在生产 web 组合下注册不上任何自定义通道
// （失败点在 connection 服务自身的 ctx 上，行仍 active 但浏览器一律 405）。
// registerFetchRoute 只写内部 Map、不读 owner.webServer，故兄弟行可注册，且
// 免费继承平台的 Host/Origin 围栏(403)、认证(401)、waterfall 与体积上限(413)。
// 代价：路径必须在 /api 之下，且按完整 pathname 精确匹配 ⇒ 每端点一条路由；
// 信封的解析与封装由本模块承担（平台只对 rpc.handle 通道做信封）。
// 参考：technical-details/RPC通道与设置页.md §一至§三；DSH_Plugins docs/decisions/0002。

import {
  API_CHANNEL,
  ContractError,
  RPC_NAMESPACE,
  ENDPOINTS,
  envelopeOf,
  fail,
  parseEnvelope,
} from '../core/contract.js'

/**
 * 构造「客户端调用端点」串：含命名空间前缀（如 `codexpro/status`）。
 * @param {string} endpoint 端点名
 * @returns {string} 含命名空间的端点串
 */
export function qualified(endpoint) {
  return `${RPC_NAMESPACE}/${endpoint}`
}

/**
 * 把「(endpoint, payload) => Result」分发器装成 `/api/codexpro/<endpoint>` 的精确 Fetch 路由。
 *
 * 每个端点一条路由；生命周期经 ctx.effect 挂在本插件 fiber 上，随行卸载自动摘除。
 * 非 web 载体（connection.fetch 不可用）时安静降级：不注册、不抛、不使行 PENDING。
 * @param {object} ctx Host 插件上下文（须已静态 inject connection）
 * @param {object} options
 * @param {(endpoint: string, payload: unknown) => Promise<object>} options.dispatch 分发器，返回 Result
 * @param {(message: string) => void} [options.warn] 降级告警出口
 * @returns {void}
 */
export function registerRpcChannel(ctx, { dispatch, warn }) {
  const connection = /** @type {any} */ (ctx).connection
  if (connection === null || connection === undefined || typeof connection.fetch?.register !== 'function') {
    warn?.('connection.fetch 注册面不可用（非 web 载体）⇒ 不注册 RPC 通道，插件其余功能照常')
    return
  }

  for (const endpoint of ENDPOINTS) {
    const routePath = `${API_CHANNEL}/${RPC_NAMESPACE}/${endpoint}`
    ctx.effect(() => connection.fetch.register({
      path: routePath,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request) => handleRequest(request, endpoint, dispatch),
    }), `${RPC_NAMESPACE}: ${routePath}`)
  }
}

/**
 * 处理单次路由请求：契约面校验 + 信封解析 + 派发 + 信封封装。
 * @param {Request} request 入站请求
 * @param {string} endpoint 该路由对应的端点
 * @param {(endpoint: string, payload: unknown) => Promise<object>} dispatch 分发器
 * @returns {Promise<Response>} 响应
 */
async function handleRequest(request, endpoint, dispatch) {
  if (request.method !== 'POST') return new Response('not found', { status: 404 })

  const mediaType = String(request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return new Response('content type must be application/json', { status: 415 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response('body is not JSON', { status: 400 })
  }

  const message = parseEnvelope(body)
  // 端点必须与路径一致：平台对 method ≠ endpoint 的请求一律拒。
  if (message === undefined || message.method !== qualified(endpoint)) {
    return new Response('invalid client-request message', { status: 400 })
  }

  let result
  try {
    result = await dispatch(endpoint, message.payload)
  } catch (error) {
    // 契约违例是调用方的错（400），其余归内部错误（500）。两者都不外抛，
    // 因为抛出会被平台记为传输失败，丢失可诊断信息。
    if (error instanceof ContractError) {
      result = fail('INVALID_REQUEST', `${error.path}: ${error.message}`)
      return Response.json(envelopeOf(message.rpcId, result), { status: 200 })
    }
    const text = error instanceof Error ? error.message : String(error)
    return new Response(`handler failure: ${text}`, { status: 500 })
  }
  return Response.json(envelopeOf(message.rpcId, result))
}
