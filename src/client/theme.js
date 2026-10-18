// theme — 进程状态的展示映射：状态词表 → 文案键与 Tag 色调。
//
// 边界：只做展示映射，不持有状态；颜色与几何在 styles.js 的 cxp-* 规则里。
// 状态词表与 Host 侧 core/state.js 一致；未知状态回落为「未知」，不谎报运行中。
// 参考：core/state.js；knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」。

/**
 * 状态到展示信息的映射。
 * @type {Readonly<Record<string, {key: string, tone: string}>>}
 */
const STATE_DISPLAY = Object.freeze({
  idle: { key: 'statusIdle', tone: 'neutral' },
  starting: { key: 'statusStarting', tone: 'warning' },
  running: { key: 'statusRunning', tone: 'success' },
  stopping: { key: 'statusStopping', tone: 'warning' },
  failed: { key: 'statusFailed', tone: 'danger' },
})

/**
 * 取状态的展示信息。
 * @param {string} state 状态值
 * @returns {{key: string, tone: string}} 文案键与色调；未知状态回落为「未知」
 */
export function displayState(state) {
  return STATE_DISPLAY[state] ?? { key: 'statusUnknown', tone: 'warning' }
}
