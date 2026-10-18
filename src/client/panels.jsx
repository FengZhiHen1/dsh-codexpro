// panels — 配置表单里的字段分组：网络接入、权限与授权工作区。
//
// 边界：控件只报告用户意图（onEdit / onReset），不自行写盘；写入由 settings-model.js
// 在「保存」时一次性完成。字段几何与帮助形态来自官方 SettingsValueField。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」「页面宽度与列布局」。

import { createElement as h } from 'react'
import { BASH_MODES, HOSTNAME_REQUIRED_TUNNELS, TUNNEL_MODES, WRITE_MODES } from '../core/codexpro.js'
import { Checkbox, Tag } from './controls.jsx'
import { SettingsSection, SettingsSelectField, SettingsValueField } from './fields.jsx'
import { AUTHORIZED, BASH_MODE, PORT, TUNNEL_HOSTNAME, TUNNEL_MODE, TUNNEL_NAME, WRITE_MODE, needsTunnelName, normalizeAuthorized } from './form.js'

/** 需要公网 hostname 的 tunnel 取值（权威定义在 core/codexpro.js）。 */
const NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS)

/** tunnel 取值 → 字典键。 */
const TUNNEL_LABEL_KEY = Object.freeze({
  none: 'tunnelNone',
  ngrok: 'tunnelNgrok',
  cloudflare: 'tunnelCloudflare',
  'cloudflare-named': 'tunnelCloudflareNamed',
  tailscale: 'tunnelTailscale',
})

/**
 * 文本字段的公共副本，避免每处重复五个标签键。
 * @param {object} field 字段状态
 * @param {string} overriddenLabel 覆盖标记文案
 * @param {string} resetLabel 重置文案
 * @returns {object} 可直接展开到 SettingsValueField 的公共属性
 */
function commonField(field, overriddenLabel, resetLabel) {
  return {
    text: field.text,
    overridden: field.overridden,
    invalid: field.invalid,
    overriddenLabel,
    resetLabel,
  }
}

/**
 * 网络接入组：tunnel 方式与端口并排；需要时再出现 hostname 与隧道名。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.onReset 暂存重置
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
function NetworkGroup({ fields, disabled, onEdit, onReset, t }) {
  const needsHost = NEEDS_HOSTNAME.has(fields.tunnelMode.text)
  const needsName = needsTunnelName(fields.tunnelMode.text)
  const overriddenLabel = t('overridden')
  const resetLabel = t('reset')
  return h(SettingsSection, {
    id: 'codexpro-network',
    title: t('networkTitle'),
    note: t('networkNote'),
  }, [
    h('div', { key: 'basic', className: 'cxp-grid' }, [
      h(SettingsSelectField, {
        key: 'tunnel',
        id: 'codexpro-tunnel-mode',
        label: t('tunnelMode'),
        hint: t('tunnelModeHint'),
        help: { label: t('helpTunnelModeLabel'), content: t('helpTunnelModeContent') },
        value: fields.tunnelMode.text,
        options: TUNNEL_MODES.map((mode) => ({ value: mode, label: t(TUNNEL_LABEL_KEY[mode] ?? mode) })),
        overridden: fields.tunnelMode.overridden,
        invalid: fields.tunnelMode.invalid,
        overriddenLabel,
        resetLabel,
        disabled,
        onEdit: (next) => onEdit(TUNNEL_MODE, next),
        onReset: () => onReset(TUNNEL_MODE),
      }),
      h(SettingsValueField, {
        key: 'port',
        id: 'codexpro-port',
        label: t('port'),
        hint: fields.port.invalid ? t('portInvalid') : t('portHint'),
        help: { label: t('helpPortLabel'), content: t('helpPortContent') },
        ...commonField(fields.port, overriddenLabel, resetLabel),
        invalidLabel: t('portInvalid'),
        disabled,
        numeric: true,
        placeholder: '8787',
        onEdit: (text) => onEdit(PORT, text),
        onReset: () => onReset(PORT),
      }),
    ]),
    needsHost || needsName
      ? h('div', { key: 'tunnel-extra', className: 'cxp-grid' }, [
        needsHost
          ? h(SettingsValueField, {
            key: 'hostname',
            id: 'codexpro-tunnel-hostname',
            label: t('tunnelHostname'),
            hint: t('tunnelHostnameHint'),
            help: { label: t('helpTunnelHostnameLabel'), content: t('helpTunnelHostnameContent') },
            ...commonField(fields.tunnelHostname, overriddenLabel, resetLabel),
            disabled,
            placeholder: 'your-domain.ngrok-free.dev',
            onEdit: (text) => onEdit(TUNNEL_HOSTNAME, text),
            onReset: () => onReset(TUNNEL_HOSTNAME),
          })
          : null,
        needsName
          ? h(SettingsValueField, {
            key: 'tunnel-name',
            id: 'codexpro-tunnel-name',
            label: t('tunnelName'),
            hint: t('tunnelNameHint'),
            help: { label: t('helpTunnelNameLabel'), content: t('helpTunnelNameContent') },
            ...commonField(fields.tunnelName, overriddenLabel, resetLabel),
            invalidLabel: t('tunnelNameInvalid'),
            disabled,
            placeholder: 'codexpro',
            onEdit: (text) => onEdit(TUNNEL_NAME, text),
            onReset: () => onReset(TUNNEL_NAME),
          })
          : null,
      ])
      : null,
  ])
}

/**
 * 权限组：bash 模式与写入模式并排。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.onReset 暂存重置
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
function PermissionGroup({ fields, disabled, onEdit, onReset, t }) {
  const overriddenLabel = t('overridden')
  const resetLabel = t('reset')
  const optionField = (key, field, labelKey, hintKey, helpLabelKey, helpContentKey) => h(SettingsSelectField, {
    key,
    id: `codexpro-${key}`,
    label: t(labelKey),
    hint: t(hintKey),
    help: { label: t(helpLabelKey), content: t(helpContentKey) },
    value: field.text,
    options: (key === 'bash' ? BASH_MODES : WRITE_MODES).map((mode) => ({ value: mode, label: mode })),
    overridden: field.overridden,
    invalid: field.invalid,
    overriddenLabel,
    resetLabel,
    disabled,
    onEdit: (next) => onEdit(key === 'bash' ? BASH_MODE : WRITE_MODE, next),
    onReset: () => onReset(key === 'bash' ? BASH_MODE : WRITE_MODE),
  })
  return h(SettingsSection, {
    id: 'codexpro-permission',
    title: t('permissionTitle'),
    note: t('permissionNote'),
  }, h('div', { className: 'cxp-grid' }, [
    optionField('bash', fields.bashMode, 'bashMode', 'bashModeHint', 'helpBashModeLabel', 'helpBashModeContent'),
    optionField('write', fields.writeMode, 'writeMode', 'writeModeHint', 'helpWriteModeLabel', 'helpWriteModeContent'),
  ]))
}

/**
 * 参数字段组：网络 / 权限两组。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.onReset 暂存重置
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
export function OptionsFields({ fields, disabled, onEdit, onReset, t }) {
  return h('div', null, [
    h(NetworkGroup, { key: 'network', fields, disabled, onEdit, onReset, t }),
    h(PermissionGroup, { key: 'permission', fields, disabled, onEdit, onReset, t }),
  ])
}

/**
 * 授权工作区：逐项勾选，整组映射作为一个草稿字段写入。
 *
 * 候选集来自 `catalog` 端点（DSH 工作区注册表），勾选状态来自表单草稿。
 * 复选框点击只改草稿：把整个映射重新序列化后 edit 一次，保存时由官方模型
 * 一次性 mutate；取消全部勾选表达为 clear，让字段回落到 Host 默认值。
 * @param {object} props 组件属性
 * @param {Array<{path: string, title: string, exists: boolean}>} props.workspaces 候选工作区
 * @param {Record<string, boolean>} props.authorized 当前草稿里的授权映射
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
export function WorkspacesField({ workspaces, authorized, disabled, onEdit, t }) {
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
    // 归一化保证同一授权集合总有同一草稿文本：键有序，且 false/缺席等价。
    onEdit(AUTHORIZED, JSON.stringify(normalizeAuthorized(mapped)))
  }

  const list = Array.isArray(workspaces) ? workspaces : []
  // 只数当前候选集：已从注册表删除的旧键仍留在 Config 里，但不属于「本页可选」。
  const selected = list.filter((item) => authorized[item.path] === true).length

  return h(SettingsSection, {
    id: 'codexpro-workspaces',
    title: t('workspacesTitle'),
    note: t('workspacesNote'),
    help: { label: t('helpWorkspacesLabel'), content: t('helpWorkspacesContent') },
    trailing: list.length
      ? t('workspacesCount', { selected, total: list.length })
      : null,
  }, list.length === 0
    ? h('p', { className: 'cxp-empty' }, t('workspacesEmpty'))
    : h('div', { className: 'cxp-list' }, list.map((item, index) => h('div', {
      key: item.path,
      className: 'cxp-list-row',
      'data-missing': !item.exists,
    }, [
      h(Checkbox, {
        key: 'box',
        checked: authorized[item.path] === true,
        disabled: disabled || !item.exists,
        ariaLabel: item.title,
        onChange: (next) => toggle(item.path, next),
      }),
      h('span', { key: 'title', className: 'cxp-row-title' }, item.title),
      h('span', { key: 'path', className: 'cxp-row-path' }, item.path),
      item.exists ? null : h(Tag, { key: 'missing', tone: 'neutral' }, t('missingDirectory')),
    ]))))
}
