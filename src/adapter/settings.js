// settings — 配置边界：Cordis `Config` schema、volatile 引用读取与跨字段校验挂点。
//
// 边界：全包唯一接触 schemastery 与 settings 服务面之处。
// volatile 形状的两条硬约束（实测）：必须加在 dict 节点本身而非其值 schema；
// 不可嵌套。违反会抛 volatile fields require a fixed object path。
// 参考：technical-details/配置与profile投影.md §一；DSR-005（配置模型）。

import Schema from '@deepseek-ai/schemastery'
import {
  BASH_MODES,
  DEFAULTS,
  HOSTNAME_REQUIRED_TUNNELS,
  PORT_RANGE,
  TUNNEL_MODES,
  TUNNEL_NAME_MAX_LENGTH,
  TUNNEL_NAME_REQUIRED_TUNNELS,
  WRITE_MODES,
} from '../core/codexpro.js'

/**
 * 本插件 loader 行的 Cordis 配置 schema。loader 在 apply 之前校验并填默认值；
 * 非法类型在加载期抛错并让行挂载失败，不做静默降级。
 * 全部意图字段 volatile：设置页写入即时生效，无需重挂载。
 */
export const Config = Schema.object({
  /**
   * 授权映射：工作区 realpath → 是否授权。
   * 用映射而非数组：取消授权必须能与「尚未见过的新工作区」区分开——
   * 键存在且为 false 即明确取消，键缺席即未表态。
   */
  authorized: Schema.dict(Schema.boolean()).default({}).volatile(),
  tunnelMode: Schema.union(TUNNEL_MODES.map((mode) => Schema.const(mode))).default(DEFAULTS.tunnel).volatile(),
  tunnelHostname: Schema.string().default('').volatile(),
  /**
   * cloudflare 具名隧道的隧道名。codexpro 在 `--tunnel cloudflare-named` 且缺此值
   * （且无令牌/配置文件）时直接抛错拒绝启动，故对那个取值是硬要求。
   * 长度上限与 codexpro 的 profile schema 一致（128）。
   */
  tunnelName: Schema.string().max(TUNNEL_NAME_MAX_LENGTH).default('').volatile(),
  port: Schema.string().default(DEFAULTS.port).volatile(),
  bashMode: Schema.union(BASH_MODES.map((mode) => Schema.const(mode))).default(DEFAULTS.bash).volatile(),
  writeMode: Schema.union(WRITE_MODES.map((mode) => Schema.const(mode))).default(DEFAULTS.write).volatile(),
  /** HTTP token：空串表示尚未生成，首次启动时由 adapter 生成后回写。 */
  httpToken: Schema.string().default('').volatile(),
  /** 锚点目录覆盖；空串表示用 $DSH_HOME/codexpro/anchor。非 volatile：部署事实，经 patch 钉死。 */
  anchorDir: Schema.string().default(''),
})

/**
 * 判断值是否为 cordis volatile 引用。
 * 鸭子类型而非 import `Volatile<T>`：平台会把 schema 之外的普通值原样交给插件
 * （手写行 config、裸 node 单测注入普通对象），不认这些形态会把普通值读成 undefined。
 * @param {unknown} value 待判值
 * @returns {boolean} 是 volatile 引用时为 true
 */
function isVolatileRef(value) {
  return typeof value === 'object' && value !== null && typeof (/** @type {any} */ (value).get) === 'function'
}

/**
 * 把 loader 解析出的 config 读成纯数据快照。volatile 字段每次现读，故无陈旧窗口。
 * @param {unknown} config apply 收到的配置
 * @returns {object} 纯数据快照
 */
export function readConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return {}
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      isVolatileRef(value) ? /** @type {any} */ (value).get() : value,
    ]),
  )
}

/**
 * 配置只读门面：core 只依赖 `.get()`，保留该形状使接缝不随平台配置模型换代而变。
 * @param {unknown} config apply 收到的配置
 * @returns {{get: () => object}} 只读门面
 */
export function configReader(config) {
  return { get: () => readConfig(config) }
}

/**
 * 校验配置的跨字段约束（schema 表达不了的部分）。
 * @param {object} config 已读出的纯数据快照
 * @returns {void}
 * @throws {Error} 约束不满足时抛出，消息含具体字段与原因
 */
export function validateConfig(config) {
  const value = config === null || typeof config !== 'object' ? {} : config

  const port = String(value.port ?? DEFAULTS.port)
  const portNumber = Number(port)
  if (!Number.isInteger(portNumber) || portNumber < PORT_RANGE.min || portNumber > PORT_RANGE.max) {
    throw new Error(`port 必须是 ${PORT_RANGE.min}–${PORT_RANGE.max} 的整数，实际为 ${JSON.stringify(port)}`)
  }

  const tunnel = String(value.tunnelMode ?? DEFAULTS.tunnel)
  if (!TUNNEL_MODES.includes(tunnel)) {
    throw new Error(`tunnelMode 必须是 ${TUNNEL_MODES.join(' / ')} 之一，实际为 ${JSON.stringify(tunnel)}`)
  }

  if (HOSTNAME_REQUIRED_TUNNELS.includes(tunnel)) {
    const hostname = String(value.tunnelHostname ?? '').trim()
    if (hostname === '') {
      throw new Error(`tunnelMode 为 ${tunnel} 时必须提供 tunnelHostname（codexpro 亦强制要求）`)
    }
  }

  // 具名隧道还要求隧道名：codexpro 在缺它时直接抛错拒绝启动
  // （scripts/codexpro.mjs:4421），故在挂载期就拦下，避免把必然失败的配置写进 profile。
  if (TUNNEL_NAME_REQUIRED_TUNNELS.includes(tunnel)) {
    const tunnelName = String(value.tunnelName ?? '').trim()
    if (tunnelName === '') {
      throw new Error(
        `tunnelMode 为 ${tunnel} 时必须提供 tunnelName（codexpro 无令牌或配置文件时会拒绝启动）`,
      )
    }
  }
  // 反向情况（非具名 tunnel 却留着隧道名）不报错：用户从 cloudflare-named 切回
  // 其他取值时若忘了清空，抛错会让整行挂载失败、只能手改 cordis.patch.yml 才能恢复。
  // 陈旧值由 buildProfile 按其语义丢弃（只在 cloudflare-named 下写入），无害。

  const bash = String(value.bashMode ?? DEFAULTS.bash)
  if (!BASH_MODES.includes(bash)) {
    throw new Error(`bashMode 必须是 ${BASH_MODES.join(' / ')} 之一，实际为 ${JSON.stringify(bash)}`)
  }

  const write = String(value.writeMode ?? DEFAULTS.write)
  if (!WRITE_MODES.includes(write)) {
    throw new Error(`writeMode 必须是 ${WRITE_MODES.join(' / ')} 之一，实际为 ${JSON.stringify(write)}`)
  }
}

/**
 * 挂载期校验。必须显式调用：`internal/config` 监听器在本行的初次解析时尚未注册
 * （解析先于 apply），故初次校验只能落在这里；抛错即让行挂载失败，比把非法配置
 * 带进第一次调用响亮。
 * 校验失败时传播 `validateConfig` 抛出的错误（本函数只做转发，不自建校验）。
 * @param {unknown} config apply 收到的配置
 * @returns {void}
 */
export function assertConfigValid(config) {
  validateConfig(readConfig(config))
}

/**
 * 注册 volatile 热更候选的解析前校验。
 *
 * `internal/config` 是 waterfall：监听器必须调用 `next()`，返回值即后续使用的配置
 * （本层只校验、不改编排）。`this !== ctx.fiber` 表示是别的 fiber 在解析自己的配置，
 * 不属本行，直接放行。
 * @param {object} ctx Host 插件上下文
 * @returns {void}
 */
export function installConfigValidation(ctx) {
  ctx.on('internal/config', function onInternalConfig(_raw, next) {
    const candidate = next()
    if (this !== ctx.fiber) return candidate
    validateConfig(candidate)
    return candidate
  })
}
