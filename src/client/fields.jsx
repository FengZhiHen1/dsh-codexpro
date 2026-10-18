// fields — 官方设置表单与字段形态的复制实现，外加同几何的自绘 select 字段。
//
// 边界：表单只发布草稿动作与保存键；字段只报告用户输入。写入、revision 围栏与
// 丢弃归 settings-model.js。官方没有 select 原语，故 select 按下述同一几何自写。
// 来源：DSH 0.2.1 的 settings-form/SettingsForm.tsx、fields.tsx 及其 CSS。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」。

import { createElement as h, useEffect, useRef, useState } from 'react'
import { ChevronIcon, InfoIcon, Tag } from './controls.jsx'

/**
 * 把 aria-describedby 的各段拼成属性值。
 * @param {...string} ids id 段
 * @returns {string|undefined} 非空时返回空格分隔的 id 串
 */
function describedBy(...ids) {
  const value = ids.filter(Boolean).join(' ')
  return value === '' ? undefined : value
}

/**
 * 官方 SettingsForm：不可用提示、只读提示、children、失败文案与保存键。
 * 只有保存才写入；离开页面丢弃全部草稿，故不提供「放弃」控件。
 * @param {object} props 组件属性
 * @param {object} props.labels 框架文案（unavailable/readOnly/saveFailed/save/saving）
 * @param {object} props.state 表单 shell 状态
 * @param {() => void} props.onSave 写入全部草稿
 * @param {() => void} props.onDiscard 丢弃全部草稿
 * @param {object} props.children 字段控件
 * @returns {object} React 元素
 */
export function SettingsForm({ labels, state, onSave, onDiscard, children }) {
  const discard = useRef(onDiscard)
  discard.current = onDiscard
  useEffect(() => () => { discard.current() }, [])
  if (!state.available) {
    return h('p', { className: 'cxp-unavailable', role: 'status' }, labels.unavailable)
  }
  const blocked = !state.dirty || state.invalid || state.saving
  return h('div', { className: 'cxp-form' }, [
    !state.writable
      ? h('p', { key: 'readonly', className: 'cxp-readonly', role: 'status' }, labels.readOnly)
      : null,
    h('div', { key: 'children' }, children),
    h('div', { key: 'footer', className: 'cxp-footer' }, [
      state.failed
        ? h('p', { key: 'failed', className: 'cxp-failed', role: 'status' }, labels.saveFailed)
        : null,
      h('button', {
        key: 'save',
        type: 'button',
        className: 'cxp-save',
        disabled: blocked,
        onClick: onSave,
      }, state.saving ? labels.saving : labels.save),
    ]),
  ])
}

/**
 * 信息按钮与展开区（复刻官方 SettingsValueField 的 help 形态）。
 * @param {object} props 组件属性
 * @param {object} props.help 帮助文案 { label, content }
 * @param {string} props.id 展开区 id
 * @param {boolean} props.open 是否展开
 * @param {(next: boolean) => void} props.onToggle 切换展开
 * @returns {object} React 元素
 */
function HelpButton({ help, id, open, onToggle }) {
  return h('button', {
    type: 'button',
    className: 'cxp-help-button',
    'aria-label': help.label,
    'aria-expanded': open,
    'aria-controls': id,
    onClick: () => { onToggle(!open) },
  }, h(InfoIcon))
}

/**
 * 帮助展开区。
 * @param {object} props 组件属性
 * @param {object} props.help 帮助文案 { label, content }
 * @param {string} props.id 区域 id
 * @returns {object} React 元素
 */
function HelpRegion({ help, id }) {
  return h('div', {
    id,
    className: 'cxp-help',
    role: 'region',
    'aria-label': help.label,
  }, h('p', null, help.content))
}

/**
 * 覆盖标记与重置键（官方 overridden Tag + 原生 reset 按钮）。
 * @param {object} props 组件属性
 * @param {boolean} props.overridden 是否已覆盖
 * @param {string} props.overriddenLabel 覆盖标记文案
 * @param {string} props.resetLabel 重置文案
 * @param {boolean} props.disabled 是否禁用
 * @param {() => void} props.onReset 重置处理
 * @returns {object|null} React 元素
 */
function OverrideBadge({ overridden, overriddenLabel, resetLabel, disabled, onReset }) {
  if (!overridden) return null
  return h('span', { className: 'cxp-badges' }, [
    h(Tag, { key: 'tag', tone: 'neutral' }, overriddenLabel),
    h('button', {
      key: 'reset',
      type: 'button',
      className: 'cxp-reset',
      disabled,
      onClick: onReset,
    }, resetLabel),
  ])
}

/**
 * 文本字段：标签、输入、hint/非法提示、帮助按钮、覆盖标记与重置。
 * @param {object} props 组件属性
 * @param {string} props.id 控件 id
 * @param {string} props.label 标签
 * @param {string} [props.hint] 控件下方一行说明
 * @param {object} [props.help] 帮助文案
 * @param {string} props.text 草稿文本
 * @param {boolean} props.overridden 保存后是否会留下用户层条目
 * @param {boolean} props.invalid 草稿是否非法
 * @param {string} props.overriddenLabel 覆盖标记文案
 * @param {string} props.resetLabel 重置文案
 * @param {string} props.invalidLabel 非法提示文案
 * @param {boolean} props.disabled 是否禁用
 * @param {(text: string) => void} props.onEdit 暂存草稿
 * @param {() => void} props.onReset 暂存重置
 * @param {boolean} [props.numeric] 是否提示数字键盘
 * @param {string} [props.placeholder] 占位符
 * @returns {object} React 元素
 */
export function SettingsValueField({
  id, label, hint, help, text, overridden, invalid, overriddenLabel, resetLabel,
  invalidLabel, disabled, onEdit, onReset, numeric, placeholder,
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = `${id}-help`
  const messageId = `${id}-message`
  const hasMessage = invalid || Boolean(hint)
  return h('div', { className: 'cxp-field' }, [
    h('div', { key: 'head', className: 'cxp-head' }, [
      h('div', { key: 'labels', className: 'cxp-label-group' }, [
        h('label', { key: 'label', className: 'cxp-label', htmlFor: id }, label),
        help ? h(HelpButton, { key: 'help', help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null,
      ]),
      h(OverrideBadge, {
        key: 'badge',
        overridden,
        overriddenLabel,
        resetLabel,
        disabled,
        onReset,
      }),
    ]),
    h('input', {
      key: 'input',
      id,
      className: 'cxp-input',
      type: 'text',
      ...(numeric === true ? { inputMode: 'numeric' } : {}),
      ...(invalid ? { 'aria-invalid': true } : {}),
      'aria-describedby': describedBy(hasMessage ? messageId : '', helpOpen ? helpId : ''),
      value: text,
      placeholder: placeholder ?? '',
      disabled,
      onChange: (event) => { onEdit(event.target.value) },
    }),
    hasMessage
      ? h('p', {
        key: 'message',
        id: messageId,
        className: invalid ? 'cxp-invalid' : 'cxp-hint',
      }, invalid ? (invalidLabel ?? hint) : hint)
      : null,
    help && helpOpen ? h(HelpRegion, { key: 'help-region', help, id: helpId }) : null,
  ])
}

/**
 * 下拉字段：与官方字段同样的标签、hint、帮助与重置几何；外框由 div 绘制，
 * select 只作透明交互层（走查事故 2026-09-30：select 自身边框不可靠）。
 * @param {object} props 组件属性
 * @param {string} props.id 控件 id
 * @param {string} props.label 标签
 * @param {string} [props.hint] 控件下方一行说明
 * @param {object} [props.help] 帮助文案
 * @param {string} props.value 当前取值
 * @param {Array<{value: string, label: string}>} props.options 选项
 * @param {boolean} props.overridden 保存后是否会留下用户层条目
 * @param {boolean} props.invalid 草稿是否非法
 * @param {string} props.overriddenLabel 覆盖标记文案
 * @param {string} props.resetLabel 重置文案
 * @param {boolean} props.disabled 是否禁用
 * @param {(value: string) => void} props.onEdit 暂存草稿
 * @param {() => void} props.onReset 暂存重置
 * @returns {object} React 元素
 */
export function SettingsSelectField({
  id, label, hint, help, value, options, overridden, invalid, overriddenLabel,
  resetLabel, invalidLabel, disabled, onEdit, onReset,
}) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = `${id}-help`
  const messageId = `${id}-message`
  const hasMessage = invalid || Boolean(hint)
  return h('div', { className: 'cxp-field' }, [
    h('div', { key: 'head', className: 'cxp-head' }, [
      h('div', { key: 'labels', className: 'cxp-label-group' }, [
        h('label', { key: 'label', className: 'cxp-label', htmlFor: id }, label),
        help ? h(HelpButton, { key: 'help', help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null,
      ]),
      h(OverrideBadge, {
        key: 'badge',
        overridden,
        overriddenLabel,
        resetLabel,
        disabled,
        onReset,
      }),
    ]),
    h('div', {
      key: 'box',
      className: 'cxp-select-box',
      'data-disabled': disabled,
    }, [
      h('select', {
        key: 'select',
        id,
        className: 'cxp-select',
        value,
        disabled,
        ...(invalid ? { 'aria-invalid': true } : {}),
        'aria-describedby': describedBy(hasMessage ? messageId : '', helpOpen ? helpId : ''),
        onChange: (event) => { onEdit(event.target.value) },
      }, options.map((option) => h('option', { key: option.value, value: option.value }, option.label))),
      h(ChevronIcon, { key: 'chevron' }),
    ]),
    hasMessage
      ? h('p', {
        key: 'message',
        id: messageId,
        className: invalid ? 'cxp-invalid' : 'cxp-hint',
      }, invalid ? (invalidLabel ?? hint) : hint)
      : null,
    help && helpOpen ? h(HelpRegion, { key: 'help-region', help, id: helpId }) : null,
  ])
}

/**
 * 分组：官方 SubagentCard 的 section 形态（h3 标题 + 说明 + 内容 + 分节留白）。
 * @param {object} props 组件属性
 * @param {string} props.id 分组 id（标题与 section 的 aria 关联）
 * @param {string} props.title 标题
 * @param {string} [props.note] 一句话说明
 * @param {object} [props.help] 分组帮助文案
 * @param {object} [props.trailing] 标题行右侧的附加内容
 * @param {object} props.children 内容
 * @returns {object} React 元素
 */
export function SettingsSection({ id, title, note, help, trailing, children }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const headingId = `${id}-title`
  const helpId = `${id}-help`
  return h('section', { className: 'cxp-section', 'aria-labelledby': headingId }, [
    h('div', { key: 'head', className: 'cxp-section-head' }, [
      h('h3', { key: 'title', id: headingId }, title),
      trailing ? h('span', { key: 'tail', className: 'cxp-section-tail' }, trailing) : null,
      help ? h(HelpButton, { key: 'help', help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null,
    ]),
    note ? h('p', { key: 'note', className: 'cxp-section-note' }, note) : null,
    help && helpOpen ? h(HelpRegion, { key: 'help-region', help, id: helpId }) : null,
    h('div', { key: 'body' }, children),
  ])
}
