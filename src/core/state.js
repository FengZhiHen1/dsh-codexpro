// state — 进程状态机：纯转换内核，不读时钟、不碰 IO（事件携带时间与原因）。
//
// 边界：只决定「当前状态 + 事件 → 新状态」，不做副作用；spawn/终止由 adapter/process.js 做。
// 词表完整性：STATES 与 EVENTS 是唯一词表，transition 对未列出的组合显式拒绝，
// default 分支抛错而非静默兜底（CORE-01 的无类型通道落法）。
// 参考：technical-details/进程管理.md §四；DSR-002、DSR-007。

/**
 * 状态词表。过渡态（starting / stopping）用于屏蔽重入：处于过渡态时同一动作被拒绝。
 * @type {Readonly<Record<string, string>>}
 */
export const STATES = Object.freeze({
  idle: 'idle',
  starting: 'starting',
  running: 'running',
  stopping: 'stopping',
  failed: 'failed',
})

/**
 * 事件词表。
 * @type {Readonly<Record<string, string>>}
 */
export const EVENTS = Object.freeze({
  /** 已发起 spawn，等待健康探测。 */
  start: 'start',
  /** 健康探测通过。 */
  healthy: 'healthy',
  /** 启动失败（spawn 失败、就绪超时、进程提前退出）。 */
  fail: 'fail',
  /** 用户请求停止。 */
  stop: 'stop',
  /** 进程已退出且托管范围已清空。 */
  exited: 'exited',
})

/**
 * 合法转换表：`<from>|<event>` → `<to>`。表本身即规格，未列出的组合一律拒绝。
 * @type {Readonly<Record<string, string>>}
 */
const TRANSITIONS = Object.freeze({
  [`${STATES.idle}|${EVENTS.start}`]: STATES.starting,
  [`${STATES.starting}|${EVENTS.healthy}`]: STATES.running,
  [`${STATES.starting}|${EVENTS.fail}`]: STATES.failed,
  [`${STATES.starting}|${EVENTS.stop}`]: STATES.stopping,
  [`${STATES.starting}|${EVENTS.exited}`]: STATES.idle,
  [`${STATES.running}|${EVENTS.stop}`]: STATES.stopping,
  [`${STATES.running}|${EVENTS.exited}`]: STATES.idle,
  [`${STATES.stopping}|${EVENTS.exited}`]: STATES.idle,
  [`${STATES.failed}|${EVENTS.start}`]: STATES.starting,
  [`${STATES.failed}|${EVENTS.stop}`]: STATES.idle,
})

/**
 * 纯转换：给定当前状态与事件，返回新状态或显式拒绝。
 * 拒绝以返回值表达而非异常，因为「重复点击停止」是正常的用户行为，
 * 不该让调用方去 catch；只有词表外的输入（编码错误）才抛出。
 * @param {string} state 当前状态（须是 STATES 的成员）
 * @param {string} event 事件（须是 EVENTS 的成员）
 * @returns {{ok: true, state: string} | {ok: false, reason: string}} 转换结果
 * @throws {TypeError} 状态或事件不在词表内时抛出（编码错误，不静默兜底）
 */
export function transition(state, event) {
  if (!Object.values(STATES).includes(state)) {
    throw new TypeError(`unknown process state: ${String(state)}`)
  }
  if (!Object.values(EVENTS).includes(event)) {
    throw new TypeError(`unknown process event: ${String(event)}`)
  }
  const next = TRANSITIONS[`${state}|${event}`]
  if (next === undefined) {
    return { ok: false, reason: `transition rejected: ${state} --${event}-->` }
  }
  return { ok: true, state: next }
}

/**
 * 该状态下是否允许发起启动。供 UI 决定按钮可用性与 adapter 做前置拒绝，两处同源。
 * @param {string} state 当前状态
 * @returns {boolean} 允许启动时为 true
 */
export function canStart(state) {
  return transition(state, EVENTS.start).ok
}

/**
 * 该状态下是否允许请求停止。
 * @param {string} state 当前状态
 * @returns {boolean} 允许停止时为 true
 */
export function canStop(state) {
  return transition(state, EVENTS.stop).ok
}
