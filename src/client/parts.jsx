// parts — 卡片的展示基元：状态徽标、页签栏、字段行、保存条。
//
// 边界：纯展示组件，不持有业务状态、不发请求。
// 参考：technical-details/RPC通道与设置页.md §五；knowledge/client/15。

import { createElement as h } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { R, S, T, displayState, dividerStyle, noteText, statusPillStyle } from './theme.js'

/** 页签定义。 */
export const TABS = [
  { id: 'process', label: '进程' },
  { id: 'workspaces', label: '授权工作区' },
  { id: 'options', label: '参数' },
]

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
 * 页签栏。
 * @param {object} props 组件属性
 * @param {string} props.active 当前页签
 * @param {Function} props.onChange 切换处理
 * @returns {object} React 元素
 */
export function TabBar({ active, onChange }) {
  return h('div', {
    style: { display: 'flex', gap: '18px', borderBottom: `1px solid ${T.borderL1}`, paddingBottom: '6px' },
  }, TABS.map((tab) => h('button', {
    key: tab.id,
    type: 'button',
    onClick: () => onChange(tab.id),
    style: {
      border: 'none',
      background: 'none',
      padding: '2px 0',
      font: 'inherit',
      fontSize: '13px',
      cursor: 'pointer',
      color: active === tab.id ? T.labelPrimary : T.labelSecondary,
      fontWeight: active === tab.id ? 600 : 400,
      borderBottom: active === tab.id ? `2px solid ${T.brand}` : '2px solid transparent',
      marginBottom: '-7px',
    },
  }, tab.label)))
}

/**
 * 字段行（左标签、中控件、右说明）。
 * @param {object} props 组件属性
 * @param {string} props.label 标签
 * @param {string} [props.hint] 说明
 * @param {object} props.children 控件
 * @returns {object} React 元素
 */
export function Field({ label, hint, children }) {
  return h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', flexWrap: 'wrap' },
  }, [
    h('span', { key: 'l', style: { fontSize: '13px', color: T.labelPrimary, minWidth: '104px' } }, label),
    h('span', { key: 'c', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, children),
    hint ? h('span', { key: 'h', style: noteText }, hint) : null,
  ])
}

/**
 * 行间分隔线。
 * @returns {object} React 元素
 */
export function Divider() {
  return h('div', { style: dividerStyle })
}

/**
 * 错误条。
 * @param {object} props 组件属性
 * @param {string} props.message 消息
 * @returns {object|null} React 元素；无消息时返回 null
 */
export function ErrorBar({ message }) {
  if (!message) return null
  return h('div', {
    style: { margin: '0 12px 10px', padding: '6px 10px', borderRadius: R.sm, background: T.bgModulePlatform },
  }, h('span', { style: { fontSize: '12px', color: T.error } }, message))
}

/**
 * 底部保存条。仅在存在草稿改动或错误时出现。
 * @param {object} props 组件属性
 * @param {boolean} props.dirty 是否有改动
 * @param {string} props.error 错误消息
 * @param {boolean} props.busy 是否忙
 * @param {Function} props.onSave 保存处理
 * @returns {object|null} React 元素；无改动且无错误时返回 null
 */
export function SaveBar({ dirty, error, busy, onSave }) {
  if (!dirty && !error) return null
  return h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 12px',
      borderRadius: R.md,
      background: T.bgModulePlatform,
      flexWrap: 'wrap',
    },
  }, [
    h(Button, { key: 'save', label: '保存', variant: 'primary', size: 'sm', disabled: busy || !dirty, onClick: onSave }),
    error
      ? h('span', { key: 'err', style: { fontSize: '12px', color: T.error } }, error)
      : h('span', { key: 'hint', style: noteText }, '仅保存已改动项；未保存的改动在离开页面后丢弃'),
  ])
}

/** 卡容器样式（分区外壳）。 */
export const cardPanelStyle = { border: `1px solid ${T.borderL1}`, borderRadius: R.md, background: T.bgLayer3, overflow: 'hidden' }

export { S }
