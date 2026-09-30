// parts — 配置页的展示基元：状态徽标、分隔线、错误条。
//
// 边界：纯展示组件，不持有业务状态、不发请求。
// 形态对齐官方设置页：配置页不自带卡片壳与页签栏（行标题/图标/面包屑由 Plugins 页自绘，
// 保存栏由官方 SettingsForm 自带），故这里只保留页内确实需要的三个基元。
// 参考：knowledge/client/15 §4；docs/cookbook/adding-a-settings-card.md。

import { createElement as h } from 'react'
import { HAIRLINE, T, captionText, displayState, dividerStyle, statusPillStyle } from './theme.js'

/**
 * 状态徽标。
 * @param {object} props 组件属性
 * @param {string} props.state 进程状态
 * @returns {object} React 元素
 */
export function StatePill({ state }) {
  const info = displayState(state)
  const variant = info.kind === 'ok' || info.kind === 'error' ? info.kind : info.kind === 'warn' ? 'warn' : 'idle'
  return h('span', { style: statusPillStyle(variant) }, info.label)
}

/**
 * 行间分隔线。
 * @returns {object} React 元素
 */
export function Divider() {
  return h('div', { style: dividerStyle })
}

/**
 * 错误条。用于进程区块的失败原因（配置表单的失败由官方 SettingsForm 呈现）。
 * @param {object} props 组件属性
 * @param {string} props.message 消息
 * @returns {object|null} React 元素；无消息时返回 null
 */
export function ErrorBar({ message }) {
  if (!message) return null
  return h('div', {
    style: {
      margin: '0 12px 10px',
      padding: '6px 10px',
      border: `${HAIRLINE} solid ${T.error}`,
      borderRadius: 'var(--dsw-radius-md)',
      background: T.bgModulePlatform,
    },
  }, h('span', { style: { ...captionText, color: T.error } }, message))
}
