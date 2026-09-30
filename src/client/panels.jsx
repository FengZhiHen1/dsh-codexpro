// panels — 配置表单里的字段控件：参数字段与授权工作区。
//
// 边界：控件只报告用户意图（onEdit / onToggle），不自行写盘——写入由官方
// SettingsFormModel 在「保存」时一次性完成。
// 官方字段原语只有文本（SettingsValueField）与 write-only 密钥，没有 select / boolean，
// 故 select 与复选框在此自绘，但草稿仍走官方模型的 edit/resetField（knowledge/client/15 §4）。
// 参考：knowledge/client/15 §4；官方 ui-settings-subagent 的 SubagentLimitsFields.tsx。

import { createElement as h } from 'react'
import { Checkbox, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { BASH_MODES, HOSTNAME_REQUIRED_TUNNELS, TUNNEL_MODES, WRITE_MODES } from '../core/codexpro.js'
import { HAIRLINE, R, T, captionText, fieldStyle, noteText } from './theme.js'
import { AUTHORIZED, BASH_MODE, PORT, TUNNEL_HOSTNAME, TUNNEL_MODE, WRITE_MODE } from './form.js'

/** tunnel 取值的展示说明；取值本身取自 core 的权威词表，避免两半侧漂移。 */
const TUNNEL_LABELS = {
  none: 'none（仅本地，不产生公网入口）',
  ngrok: 'ngrok（稳定 dev domain）',
  cloudflare: 'cloudflare（quick tunnel，URL 每次重启都变）',
  'cloudflare-named': 'cloudflare-named（具名隧道，URL 稳定）',
  tailscale: 'tailscale（Funnel）',
}

/** 需要公网 hostname 的 tunnel 取值（权威定义在 core/codexpro.js）。 */
const NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS)

/** 已覆盖徽标文案（官方 SettingsValueField 需要 overriddenLabel）。 */
const OVERRIDDEN = '已覆盖'
/** 重置控件文案。 */
const RESET = '重置'

/**
 * 参数字段组：tunnel / hostname / 端口 / bash / 写入。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态（text/overridden/invalid）
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.onReset 暂存清除
 * @returns {object} React 元素
 */
export function OptionsFields({ fields, disabled, onEdit, onReset }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column' } }, [
    h(FieldRow, { key: 'tunnel', label: 'Tunnel 方式', hint: '公网入口方式；none 仅本地可用' },
      h('select', {
        value: fields.tunnelMode.text,
        disabled,
        onChange: (event) => onEdit(TUNNEL_MODE, event.target.value),
        style: { ...fieldStyle, minWidth: '260px', cursor: disabled ? 'default' : 'pointer' },
      }, TUNNEL_MODES.map((mode) => h('option', { key: mode, value: mode }, TUNNEL_LABELS[mode] ?? mode)))),
    NEEDS_HOSTNAME.has(fields.tunnelMode.text)
      ? h(FieldRow, { key: 'hostname', label: '公网 hostname', hint: '该 tunnel 方式必需，codexpro 亦强制要求' },
        h('input', {
          type: 'text',
          value: fields.tunnelHostname.text,
          disabled,
          placeholder: 'demo.ngrok-free.dev',
          onChange: (event) => onEdit(TUNNEL_HOSTNAME, event.target.value),
          style: { ...fieldStyle, minWidth: '260px' },
        }))
      : null,
    h(FieldRow, { key: 'port', label: '本地端口', hint: '1–65535 的整数；改动需重启进程才生效' },
      h('input', {
        type: 'text',
        inputMode: 'numeric',
        value: fields.port.text,
        disabled,
        placeholder: '8787',
        'aria-invalid': fields.port.invalid ? true : undefined,
        onChange: (event) => onEdit(PORT, event.target.value),
        style: { ...fieldStyle, minWidth: '90px', borderColor: fields.port.invalid ? T.error : T.borderL2 },
      }),
      fields.port.invalid ? h('span', { key: 'bad', style: captionText }, '端口需为整数') : null),
    h(FieldRow, { key: 'bash', label: 'bash 模式', hint: 'safe 允许常见检查与测试命令；full 为任意 shell，仅在信任的仓库使用' },
      h('select', {
        value: fields.bashMode.text,
        disabled,
        onChange: (event) => onEdit(BASH_MODE, event.target.value),
        style: { ...fieldStyle, minWidth: '120px', cursor: disabled ? 'default' : 'pointer' },
      }, BASH_MODES.map((mode) => h('option', { key: mode, value: mode }, mode)))),
    h(FieldRow, { key: 'write', label: '写入模式', hint: 'workspace 允许在授权目录内写入' },
      h('select', {
        value: fields.writeMode.text,
        disabled,
        onChange: (event) => onEdit(WRITE_MODE, event.target.value),
        style: { ...fieldStyle, minWidth: '120px', cursor: disabled ? 'default' : 'pointer' },
      }, WRITE_MODES.map((mode) => h('option', { key: mode, value: mode }, mode)))),
  ])
}

/**
 * 授权工作区字段：逐项勾选，整组映射作为一个草稿字段写入。
 *
 * 候选集来自 `catalog` 端点（DSH 工作区注册表），勾选状态来自表单草稿。
 * 复选框点击只改草稿：把整个映射重新序列化后 edit 一次，保存时由官方模型
 * 一次性 mutate；取消全部勾选表达为 clear，让字段回落到 Host 默认值。
 * @param {object} props 组件属性
 * @param {Array<{path: string, title: string, exists: boolean}>} props.workspaces 候选工作区
 * @param {Record<string, boolean>} props.authorized 当前草稿里的授权映射
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @returns {object} React 元素
 */
export function WorkspacesField({ workspaces, authorized, disabled, onEdit }) {
  /**
   * 切换某个工作区的授权态并暂存整份映射。
   * @param {string} path 工作区路径
   * @param {boolean} next 新值
   * @returns {void}
   */
  const toggle = (path, next) => {
    const mapped = { ...authorized }
    if (next) mapped[path] = true
    else delete mapped[path]
    onEdit(AUTHORIZED, JSON.stringify(mapped))
  }

  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    return h('div', { style: { padding: '7px 0' } }, [
      h('span', { key: 'l', style: { ...labelStyle } }, '授权工作区'),
      h('p', { key: 't', style: { ...noteText, margin: '4px 0 0' } },
        '当前实例还没有工作区。在 DSH 里打开一个项目后它会出现在这里。'),
    ])
  }

  return h('div', { style: { display: 'flex', flexDirection: 'column', padding: '7px 0' } }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'baseline', gap: '8px' } }, [
      h('span', { key: 'l', style: labelStyle }, '授权工作区'),
      h('span', { key: 'c', style: captionText }, `已选 ${Object.keys(authorized).length} / ${workspaces.length}`),
    ]),
    h('p', { key: 'hint', style: { ...noteText, margin: '2px 0 8px' } },
      '授权后 ChatGPT 可在该目录内读写并执行受控命令。目录不存在的项会被跳过（codexpro 拒绝不存在的授权根）。'),
    h('div', {
      key: 'list',
      style: { border: `${HAIRLINE} solid ${T.borderL2}`, borderRadius: R.md, overflow: 'hidden' },
    }, workspaces.map((item, index) => h('div', {
      key: item.path,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        fontSize: '13px',
        borderTop: index === 0 ? 'none' : `${HAIRLINE} solid ${T.borderL2}`,
        background: T.bgLayer3,
        opacity: item.exists ? 1 : 0.55,
      },
    }, [
      h(Checkbox, {
        key: 'box',
        checked: authorized[item.path] === true,
        disabled: disabled || !item.exists,
        onChange: (next) => toggle(item.path, next),
      }),
      h('span', { key: 'title', style: { color: T.labelPrimary, flex: 'none' } }, item.title),
      h('span', { key: 'path', style: { ...captionText, flex: '1 1 auto', wordBreak: 'break-all' } }, item.path),
      item.exists ? null : h(Tag, { key: 'miss', tone: 'neutral' }, '目录不存在'),
    ]))),
  ])
}

/** 字段标签样式（与行内其他字段对齐）。 */
const labelStyle = { fontSize: '13px', color: T.labelPrimary }

/**
 * 一行字段：左标签、中控件、下侧说明。
 * @param {object} props 组件属性
 * @param {string} props.label 标签
 * @param {string} [props.hint] 说明
 * @param {object} props.children 控件
 * @returns {object} React 元素
 */
function FieldRow({ label, hint, children }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '7px 0' } }, [
    h('span', { key: 'l', style: labelStyle }, label),
    h('div', { key: 'c', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, children),
    hint ? h('p', { key: 'h', style: { ...noteText, margin: 0 } }, hint) : null,
  ])
}
