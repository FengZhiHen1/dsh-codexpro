// panels — 三个页签的具体内容：进程、授权工作区、参数。
//
// 边界：各页签只渲染自己的字段并回调变更意图，不自行发请求（请求由 card.jsx 统一触发）。
// 参考：technical-details/RPC通道与设置页.md §五。

import { createElement as h } from 'react'
import { Button, Checkbox } from '@deepseek-ai/dsh-client-ui-primitives'
import { BASH_MODES, HOSTNAME_REQUIRED_TUNNELS, TUNNEL_MODES, WRITE_MODES } from '../core/codexpro.js'
import { R, S, T, cardStyle, dividerStyle, fieldStyle, noteText, statusPillStyle } from './theme.js'
import { Divider, ErrorBar, Field, StatePill } from './parts.jsx'

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

/**
 * 进程页签：状态、启停、Server URL。
 * @param {object} props 组件属性
 * @param {object|null} props.status 状态快照
 * @param {boolean} props.busy 是否忙
 * @param {Function} props.onAction 启停处理
 * @param {Function} props.onRefresh 刷新处理
 * @returns {object} React 元素
 */
export function ProcessPanel({ status, busy, onAction, onRefresh }) {
  const state = status?.state ?? 'idle'
  const canStart = state === 'idle' || state === 'failed'
  const canStop = state === 'running' || state === 'starting'
  return h('div', { style: cardStyle }, [
    h('div', { key: 'head', style: { ...S.listRow, justifyContent: 'space-between' } }, [
      h('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        h(StatePill, { key: 'pill', state }),
        h('span', { key: 'meta', style: noteText }, status ? `端口 ${status.port} · tunnel ${status.tunnel}` : ''),
      ]),
      h('div', { key: 'actions', style: S.toolbar }, [
        h(Button, { key: 'start', label: '启动', variant: 'primary', size: 'sm', disabled: busy || !canStart, onClick: () => onAction('start') }),
        h(Button, { key: 'stop', label: '停止', size: 'sm', disabled: busy || !canStop, onClick: () => onAction('stop') }),
        h(Button, { key: 'refresh', label: '刷新状态', size: 'sm', disabled: busy, onClick: onRefresh }),
      ]),
    ]),
    h(Divider, { key: 'div' }),
    h('div', { key: 'url', style: { padding: '8px 12px' } }, [
      h('div', { key: 'l', style: { ...noteText, marginBottom: '4px' } }, 'Server URL（粘贴到 ChatGPT 连接器的 Server URL 字段）'),
      h('code', {
        key: 'v',
        style: {
          display: 'block',
          padding: '6px 8px',
          fontSize: '11px',
          borderRadius: R.sm,
          background: T.bgModulePlatform,
          color: T.labelSecondary,
          wordBreak: 'break-all',
        },
      }, status?.url || '（未运行或尚未生成 token）'),
    ]),
    status?.lastError ? h(ErrorBar, { key: 'last', message: status.lastError }) : null,
  ])
}

/**
 * 授权工作区页签：逐项勾选。
 * @param {object} props 组件属性
 * @param {Array} props.workspaces 候选工作区
 * @param {Record<string, boolean>} props.draft 草稿映射
 * @param {Function} props.onToggle 勾选处理
 * @param {string} props.anchorDir 锚点目录
 * @returns {object} React 元素
 */
export function WorkspacesPanel({ workspaces, draft, onToggle, anchorDir }) {
  if (workspaces.length === 0) {
    return h('div', { style: { ...cardStyle, ...S.listRow } }, [
      h('span', { key: 't', style: noteText }, '当前实例还没有工作区。在 DSH 里打开一个项目后它会出现在这里。'),
    ])
  }
  return h('div', null, [
    h('div', { key: 'list', style: cardStyle }, workspaces.map((item, index) => h('div', {
      key: item.path,
      style: {
        ...S.listRow,
        borderTop: index === 0 ? 'none' : `1px solid ${T.borderL1}`,
        opacity: item.exists ? 1 : 0.55,
      },
    }, [
      h(Checkbox, {
        key: 'box',
        checked: draft[item.path] === true,
        disabled: !item.exists,
        onChange: (next) => onToggle(item.path, next),
      }),
      h('span', { key: 'title', style: { fontSize: '13px', color: T.labelPrimary } }, item.title),
      h('span', { key: 'path', style: { ...noteText, flex: '1 1 auto' } }, item.path),
      item.exists ? null : h('span', { key: 'miss', style: statusPillStyle('warn') }, '目录不存在'),
    ]))),
    h('div', { key: 'anchor', style: { ...noteText, marginTop: '6px' } },
      `锚点目录（codexpro 的 --root，决定 profile 文件名）：${anchorDir}`),
  ])
}

/**
 * 参数页签：tunnel / hostname / 端口 / bash / 写入。
 * @param {object} props 组件属性
 * @param {object} props.draft 草稿
 * @param {Function} props.onChange 字段变更处理
 * @returns {object} React 元素
 */
export function OptionsPanel({ draft, onChange }) {
  return h('div', { style: cardStyle }, [
    h(Field, {
      key: 'tunnel',
      label: 'Tunnel 方式',
      children: h('select', {
        value: draft.tunnelMode,
        onChange: (event) => onChange('tunnelMode', event.target.value),
        style: { ...fieldStyle, minWidth: '260px' },
      }, TUNNEL_MODES.map((mode) => h('option', { key: mode, value: mode }, TUNNEL_LABELS[mode] ?? mode))),
    }),
    NEEDS_HOSTNAME.has(draft.tunnelMode)
      ? h(Field, {
        key: 'hostname',
        label: '公网 hostname',
        hint: '该 tunnel 方式必需，codexpro 亦强制要求',
        children: h('input', {
          type: 'text',
          value: draft.tunnelHostname,
          onChange: (event) => onChange('tunnelHostname', event.target.value),
          style: { ...fieldStyle, minWidth: '260px' },
        }),
      })
      : null,
    h('div', { key: 'd1', style: dividerStyle }),
    h(Field, {
      key: 'port',
      label: '本地端口',
      children: h('input', {
        type: 'text',
        value: draft.port,
        onChange: (event) => onChange('port', event.target.value),
        style: { ...fieldStyle, minWidth: '90px' },
      }),
    }),
    h('div', { key: 'd2', style: dividerStyle }),
    h(Field, {
      key: 'bash',
      label: 'bash 模式',
      hint: 'safe 允许常见检查与测试命令；full 为任意 shell，仅在信任的仓库使用',
      children: h('select', {
        value: draft.bashMode,
        onChange: (event) => onChange('bashMode', event.target.value),
        style: { ...fieldStyle, minWidth: '120px' },
      }, BASH_MODES.map((mode) => h('option', { key: mode, value: mode }, mode))),
    }),
    h(Field, {
      key: 'write',
      label: '写入模式',
      children: h('select', {
        value: draft.writeMode,
        onChange: (event) => onChange('writeMode', event.target.value),
        style: { ...fieldStyle, minWidth: '120px' },
      }, WRITE_MODES.map((mode) => h('option', { key: mode, value: mode }, mode))),
    }),
  ])
}
