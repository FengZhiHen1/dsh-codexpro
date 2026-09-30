// parts — 卡片的展示基元：状态徽标、页签栏、字段行、保存条。
//
// 边界：纯展示组件，不持有业务状态、不发请求。
// 页签形态对齐官方设置节（ui-settings-plugins 的 PluginsSettingsSection）：文字页签 +
// 底部 2px 指示条 + 完整键盘导航与 ARIA。官方用 CSS Module 的 ::after 画指示条，
// 内联样式表达不了伪元素，故改为同几何的真实子元素（几何值逐项抄自官方 CSS）。
// 参考：knowledge/client/15 §4/§4.1；technical-details/RPC通道与设置页.md §五。

import { createElement as h, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { HAIRLINE, R, S, T, captionText, displayState, dividerStyle, noteText, statusPillStyle } from './theme.js'

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
 * 单个页签。选中与悬停共用文字色提升；指示条与焦点环分别由子元素与内联 outline 表达。
 * @param {object} props 组件属性
 * @param {object} props.tab 页签定义
 * @param {boolean} props.selected 是否选中
 * @param {Function} props.onClick 选中处理
 * @param {Function} props.onKeyDown 键盘处理
 * @param {object} props.buttonRef 转发到按钮的 ref
 * @param {string} props.panelId 受控面板 id
 * @returns {object} React 元素
 */
function Tab({ tab, selected, onClick, onKeyDown, buttonRef, panelId }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // 官方 .tab 的几何：padding 7px 1px 9px、13px/20px、无边框、透明底。
  // 文字色：未选中 tertiary，悬停或选中升为 primary（官方不靠字重区分）。
  const style = {
    position: 'relative',
    border: 0,
    padding: '7px 1px 9px',
    background: 'transparent',
    color: selected || hovered ? T.labelPrimary : T.labelTertiary,
    font: 'inherit',
    fontSize: '13px',
    lineHeight: '20px',
    cursor: 'pointer',
    // 官方 :focus-visible 为 2px 焦点环、offset 2px、圆角 2px；内联无法判「是否键盘聚焦」，
    // 故用 onFocus/onBlur 近似（鼠标点击也会命中，视觉上不冲突）。
    outline: focused ? `${T.focusRingWidth} solid ${T.focusRingColor}` : 'none',
    outlineOffset: focused ? '2px' : undefined,
    borderRadius: focused ? R.xs : undefined,
  }
  // 官方指示条：right 0 / bottom -1px / left 0 / height 2px / radius 2px 2px 0 0 / 底色 label-primary。
  // 选中与聚焦都显示（官方 `.tab[data-active='true']::after, .tab:focus-visible::after`）。
  const showIndicator = selected || focused
  return h('button', {
    ref: buttonRef,
    type: 'button',
    role: 'tab',
    id: `codexpro-tab-${tab.id}`,
    'aria-selected': selected,
    'aria-controls': panelId,
    tabIndex: selected ? 0 : -1,
    style,
    onClick,
    onKeyDown,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }, [
    tab.label,
    showIndicator
      ? h('span', {
        key: 'indicator',
        'aria-hidden': 'true',
        style: {
          position: 'absolute',
          right: 0,
          bottom: '-1px',
          left: 0,
          height: '2px',
          borderRadius: '2px 2px 0 0',
          background: T.labelPrimary,
        },
      })
      : null,
  ])
}

/**
 * 页签栏：官方设置节的文字页签形态（下划线指示条 + 键盘导航 + ARIA）。
 *
 * 键盘映射与官方一致：ArrowLeft/ArrowRight 循环、Home/End 跳首尾，切换后焦点跟随。
 * @param {object} props 组件属性
 * @param {string} props.active 当前页签 id
 * @param {Function} props.onChange 切换处理
 * @param {string} props.label 页签栏的无障碍名称
 * @param {Function} props.panelIdOf 由页签 id 求面板 id
 * @returns {object} React 元素
 */
export function TabBar({ active, onChange, label, panelIdOf }) {
  const refs = useRef([])

  /**
   * 处理键盘导航。
   * @param {object} event 键盘事件
   * @param {number} index 当前页签序号
   * @returns {void}
   */
  const onKeyDown = (event, index) => {
    let next
    switch (event.key) {
      case 'ArrowLeft': next = (index + TABS.length - 1) % TABS.length; break
      case 'ArrowRight': next = (index + 1) % TABS.length; break
      case 'Home': next = 0; break
      case 'End': next = TABS.length - 1; break
      default: return
    }
    event.preventDefault()
    event.stopPropagation()
    onChange(TABS[next].id)
    refs.current[next]?.focus()
  }

  return h('div', {
    role: 'tablist',
    'aria-label': label,
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '22px',
      borderBottom: `${HAIRLINE} solid ${T.borderL2}`,
      marginTop: '2px',
    },
  }, TABS.map((tab, index) => h(Tab, {
    key: tab.id,
    tab,
    selected: active === tab.id,
    onClick: () => onChange(tab.id),
    onKeyDown: (event) => onKeyDown(event, index),
    buttonRef: (element) => { refs.current[index] = element },
    panelId: panelIdOf(tab.id),
  })))
}

/**
 * 页签面板外壳：提供 role=tabpanel 与 ARIA 配对，并按官方语义保持挂载。
 *
 * 官方语义（PluginsSettingsSection 注释）：页签首次选中后保持挂载、仅用 hidden 隐藏，
 * 以便切走再切回时草稿与局部状态不丢。本组件用 hidden 属性表达该语义，调用方负责
 * 「首次选中才渲染」的 visited 判定。
 * @param {object} props 组件属性
 * @param {string} props.id 页签 id
 * @param {boolean} props.selected 是否当前选中
 * @param {Function} props.panelIdOf 由页签 id 求面板 id
 * @returns {object} React 元素
 */
export function TabPanel({ id, selected, panelIdOf, children }) {
  return h('div', {
    id: panelIdOf(id),
    role: 'tabpanel',
    'aria-labelledby': `codexpro-tab-${id}`,
    hidden: !selected,
    style: { minWidth: 0, paddingTop: '2px' },
  }, children)
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
    style: { margin: '0 12px 10px', padding: '6px 10px', borderRadius: R.md, background: T.bgModulePlatform },
  }, h('span', { style: { fontSize: '13px', color: T.error, lineHeight: '20px' } }, message))
}

/**
 * 底部保存条。仅在存在草稿改动或错误时出现。
 *
 * 按钮走官方 Button 原语（禁用视觉由原语承担，避免「禁用但看着亮」）；官方范式是
 * 「只有保存会写入」，故无放弃控件、无未保存标记。
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
      borderRadius: R.lg,
      background: T.bgModulePlatform,
      flexWrap: 'wrap',
    },
  }, [
    h(Button, { key: 'save', label: '保存', variant: 'primary', size: 'sm', disabled: busy || !dirty, onClick: onSave }),
    error
      ? h('span', { key: 'err', style: { fontSize: '13px', color: T.error, lineHeight: '20px' } }, error)
      : h('span', { key: 'hint', style: captionText }, '仅保存已改动项；未保存的改动在离开页面后丢弃'),
  ])
}

export { S }
