// parts — 配置页的展示基元：进程状态 Tag 与错误提示。
//
// 边界：纯展示组件，不持有业务状态、不发请求。配置表单的失败由 SettingsForm 呈现。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」。

import { createElement as h } from 'react'
import { Tag } from './controls.jsx'
import { displayState } from './theme.js'

/**
 * 进程状态标签。
 * @param {object} props 组件属性
 * @param {string} props.state 进程状态
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
export function StatusTag({ state, t }) {
  const info = displayState(state)
  return h(Tag, { tone: info.tone }, t(info.key))
}

/**
 * 错误提示。用于进程区块的失败原因（配置表单的失败由 SettingsForm 呈现）。
 * @param {object} props 组件属性
 * @param {string} props.message 消息
 * @returns {object|null} React 元素；无消息时返回 null
 */
export function ErrorNote({ message }) {
  if (!message) return null
  return h('p', { className: 'cxp-error', role: 'alert' }, message)
}
