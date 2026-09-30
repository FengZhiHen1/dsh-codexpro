// health — codexpro 健康探测：只访问回环地址，带 token 认证与显式超时。
//
// 边界：不做状态决策（由 adapter/process.js 据返回值判断）；不重试、不轮询
// （轮询预算由调用方持有，见 core/codexpro.js 的 START_TIMEOUT_MS）。
// 参考：technical-details/进程管理.md §三。

import { HEALTH_PATH, HEALTH_TIMEOUT_MS } from '../core/codexpro.js'

/**
 * 读取 codexpro 健康端点。
 *
 * 每次调用都以 AbortSignal.timeout 设上界：无超时的 fetch 会在对端半死时挂住，
 * 而轮询循环靠「单次返回」推进，挂住即等于永不就绪。超时与连接被拒都归为
 * 「未健康」，具体原因由调用方的输出尾部诊断呈现，本函数不承担诊断职责。
 * @param {number} port 本地端口
 * @param {string} [token] HTTP token；非空时以 Bearer 头发送
 * @returns {Promise<{ok: boolean, details: object|null}>} 是否健康与响应体（不健康时为 null）
 */
export async function readHealth(port, token = '') {
  const url = `http://127.0.0.1:${port}${HEALTH_PATH}`
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, details: null }
    const body = await response.json()
    if (body === null || typeof body !== 'object' || body.ok !== true) return { ok: false, details: null }
    return { ok: true, details: body }
  } catch {
    return { ok: false, details: null }
  }
}

/**
 * 探测 codexpro 是否健康（readHealth 的布尔投影，供轮询循环使用）。
 * @param {number} port 本地端口
 * @param {string} [token] HTTP token
 * @returns {Promise<boolean>} 健康时为 true
 */
export async function probeHealth(port, token = '') {
  return (await readHealth(port, token)).ok
}
