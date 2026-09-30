// profile — codexpro profile 的身份推导与内容构造（纯函数，无 IO）。
//
// 身份一致性：文件名是 sha256(realpath(root)).slice(0,24)。codexpro 自身对 CLI 传入的
// root 做同样的 realpath 归一，两侧必须一致，否则算出不同文件名、配置写进无人读的文件。
// 因此调用方必须传入已 realpath 归一的 root；本模块不自行归一（realpath 是 IO）。
// 参考：technical-details/配置与profile投影.md §三；DSR-001、DSR-006。

import { createHash } from 'node:crypto'
import path from 'node:path'
import { PROFILES_SEGMENT } from './anchor.js'
import { DEFAULTS, TUNNEL_NAME_REQUIRED_TUNNELS } from './codexpro.js'

/** profile ID 取哈希前 24 个十六进制字符（codexpro 自身约定）。 */
const ID_LENGTH = 24

/** profile 文件格式版本（codexpro 自身写入 `version: 1`）。 */
const PROFILE_VERSION = 1

/** token 在 profile 中的字段名。经 profile 文件传递而非环境变量，见技术栈设计.md S-02。 */
const TOKEN_FIELD = 'token'

/**
 * 需要具名隧道的 tunnel 取值（只有一个，取词表首项）。
 * 从 core/codexpro.js 引用而非另写字面量：隧道名的生效条件两处必须一致，
 * 分歧会导致「profile 写了名字但被丢弃」这类静默失效。
 */
const CLOUDFLARE_NAMED = TUNNEL_NAME_REQUIRED_TUNNELS[0]

/**
 * 由锚点路径推导 profile ID。
 * @param {string} realAnchor 已 realpath 归一的锚点绝对路径
 * @returns {string} 24 字符十六进制 ID
 */
export function profileId(realAnchor) {
  return createHash('sha256').update(realAnchor).digest('hex').slice(0, ID_LENGTH)
}

/**
 * 由数据目录与锚点推导 profile 文件绝对路径。
 * @param {string} home codexpro 数据目录
 * @param {string} realAnchor 已 realpath 归一的锚点绝对路径
 * @returns {string} profile 文件绝对路径
 */
export function profilePath(home, realAnchor) {
  return path.join(home, PROFILES_SEGMENT, `${profileId(realAnchor)}.json`)
}

/**
 * 把授权集归一为 profile 的 `allowedRoots`。
 * 排序保证同输入产生逐字节相同的文件，从而让「内容未变则不写盘」的幂等判定可靠。
 * @param {Iterable<string>} roots 已 realpath 归一的授权目录
 * @returns {string[]} 去重且按字典序排序的目录列表
 */
export function normalizeAllowedRoots(roots) {
  return [...new Set(roots)].sort()
}

/**
 * 构造 profile 内容。字段省略规则对齐 codexpro 自身：与默认一致的键不写入。
 * @param {object} input
 * @param {string} input.realAnchor 已 realpath 归一的锚点
 * @param {string[]} input.allowedRoots 已归一的授权目录
 * @param {string} input.port 本地端口
 * @param {string} input.tunnel tunnel 取值
 * @param {string} [input.hostname] 具名 tunnel 的 hostname；空值不写入
 * @param {string} [input.tunnelName] cloudflare 具名隧道的隧道名；空值或非该 tunnel 时不写入
 * @param {string} input.bashMode bash 模式
 * @param {string} input.writeMode 写入模式
 * @param {string} input.token HTTP token；空串表示不写入该键
 * @param {string} input.updatedAt ISO-8601 时间戳
 * @param {string} input.mode 模式，恒为 `agent`
 * @returns {object} 可直接序列化的 profile 对象
 */
export function buildProfile(input) {
  const payload = {
    version: PROFILE_VERSION,
    root: input.realAnchor,
    updatedAt: input.updatedAt,
    port: input.port,
    mode: input.mode,
    tunnel: input.tunnel,
  }
  if (input.hostname) payload.hostname = input.hostname
  // 与 codexpro 自身同规则：隧道名只在 cloudflare-named 下有意义，切换 tunnel 时它会被丢弃
  // （dist/http.js:313「next.tunnel === "cloudflare-named" ? next.tunnelName : ""」），
  // 故此处也只在两者同时成立时写入，避免在 profile 里留下无人读取的陈旧键。
  if (input.tunnel === CLOUDFLARE_NAMED && input.tunnelName) payload.tunnelName = input.tunnelName
  if (input.bashMode !== DEFAULTS.bash) payload.bash = input.bashMode
  if (input.writeMode !== DEFAULTS.write) payload.write = input.writeMode
  if (input.token) payload[TOKEN_FIELD] = input.token
  const roots = normalizeAllowedRoots(input.allowedRoots)
  if (roots.length) payload.allowedRoots = roots
  return payload
}

/**
 * 序列化 profile 为文件文本。固定两空格缩进与尾换行，使「同内容 ⇒ 同字节」成立。
 * @param {object} payload buildProfile 的产物
 * @returns {string} 文件文本
 */
export function serializeProfile(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`
}

/**
 * 判断现有文本与待写文本是否等价（幂等：内容未变则不写盘，避免无谓的 mtime 变化）。
 * 比较前抹去 `updatedAt` 的值——它是写入时刻的产物，不应让「内容未变」被判为变化。
 * @param {string} existing 现有文件文本；文件不存在时传空串
 * @param {string} next 待写入文本
 * @returns {boolean} 二者除 updatedAt 值外是否一致
 */
export function profileEquivalent(existing, next) {
  if (!existing) return false
  return stripUpdatedAt(existing) === stripUpdatedAt(next)
}

/**
 * 抹去 profile JSON 文本中 `updatedAt` 的值，保留键以维持结构可比。
 * @param {string} text profile 文本
 * @returns {string} 归一后的文本
 */
function stripUpdatedAt(text) {
  return text.replace(/("updatedAt"\s*:\s*")[^"]*(")/, '$1$2')
}
