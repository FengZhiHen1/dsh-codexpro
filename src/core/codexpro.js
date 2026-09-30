// codexpro — codexpro 外部事实常量单一收口：启动参数、CLI 入口、健康端点、profile 字段。
//
// 边界：只放事实与取值枚举，不放流程；流程见 profile.js / catalog.js / state.js。
// 参考：技术栈设计.md「选型重访条件」；technical-details/配置与profile投影.md、进程管理.md。

/**
 * 启动参数名。集中定义以免命名散落，也便于与上游参数表逐项对照。
 * @type {Readonly<Record<string, string>>}
 */
export const ARG = Object.freeze({
  root: '--root',
  port: '--port',
  tunnel: '--tunnel',
  hostname: '--hostname',
  mode: '--mode',
  bash: '--bash',
  write: '--write',
})

/**
 * 固定以 agent 模式启动。handoff 与 pro 是明确非目标：前者让 ChatGPT 只写计划，
 * 后者为不能调工具的模型导出上下文，都不属本插件的托管场景。
 */
export const FIXED_MODE = 'agent'

/**
 * 报告类子命令，用于版本探测。取子命令而非 `--version`：后者在部分版本上不打印纯版本号。
 * @type {readonly string[]}
 */
export const VERSION_ARGS = Object.freeze(['--version'])

/** 健康端点路径（codexpro 自身启动流程也用它判就绪）。 */
export const HEALTH_PATH = '/healthz'

/** token 传递用的 profile 字段名；经 profile 文件而非环境变量，见技术栈设计.md S-02。 */
export const PROFILE_TOKEN_FIELD = 'token'

/** codexpro 数据目录的环境变量名；置于每实例 $DSH_HOME 下以实现实例隔离。 */
export const HOME_ENV = 'CODEXPRO_HOME'

/** tunnel 取值枚举。`none` 为首次配置默认值，不产生公网入口。 */
export const TUNNEL_MODES = Object.freeze(['none', 'ngrok', 'cloudflare', 'cloudflare-named', 'tailscale'])

/** 需要公网 hostname 的 tunnel 取值（codexpro 对这三者强制要求 hostname）。 */
export const HOSTNAME_REQUIRED_TUNNELS = Object.freeze(['ngrok', 'cloudflare-named', 'tailscale'])

/** bash 执行模式取值（对应 codexpro 的 `--bash`）。 */
export const BASH_MODES = Object.freeze(['off', 'safe', 'full'])

/** 写入模式取值（对应 codexpro 的 `--write`）。 */
export const WRITE_MODES = Object.freeze(['off', 'handoff', 'workspace'])

/** codexpro 自身的默认值：与默认一致的字段不写入 profile，保持投影最小。 */
export const DEFAULTS = Object.freeze({
  port: '8787',
  bash: 'safe',
  write: 'workspace',
  tunnel: 'none',
})

/** 本地端口上界与下界（codexpro 自行校验 1–65535，此处提前拦截以给出可读原因）。 */
export const PORT_RANGE = Object.freeze({ min: 1, max: 65535 })

/**
 * 健康探测单次超时。取值 3000ms：codexpro 自身启动容忍 15000ms（那是冷启动等待，
 * 不是单次探测），而回环 /healthz 的 P99 远低于 1s，3s 留足余量又不掩盖卡死。
 */
export const HEALTH_TIMEOUT_MS = 3000

/**
 * 启动就绪轮询上界。取值 30000ms：codexpro 冷启动需拉起 server 子进程并绑定端口，
 * 实测数秒内就绪；30s 覆盖慢盘与首次下载 cloudflared 之外的情形（后者由 tunnel 分支自报错）。
 */
export const START_TIMEOUT_MS = 30000

/** 就绪轮询间隔。250ms 与 codexpro 自身的探测间隔一致。 */
export const START_POLL_MS = 250

/**
 * 终止宽限期，同时也是 spawn 规格的 graceMs。取值 5000ms：stdin `q` 触发的是
 * codexpro 自身清理（回收 tunnel 子进程），实测亚秒级完成；5s 覆盖慢机与 tunnel 退出。
 */
export const STOP_GRACE_MS = 5000

/** 已知可用的 codexpro 版本下限；低于此版本 profile 形状与控制通道均未验证。 */
export const MIN_SUPPORTED_VERSION = '0.20.0'
