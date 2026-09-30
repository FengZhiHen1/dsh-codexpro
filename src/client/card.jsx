// card — 本行配置页：进程区块（自建）+ 官方配置表单（SettingsForm）。
//
// 边界：只做组装与呈现；字段规格与草稿模型在 form.js，进程状态在 use-process.js，
// 展示基元在 parts.jsx。
// 形态遵循官方规范（knowledge/client/15 §4）：配置页只渲染官方表单，不自带卡片壳——
// 行标题/图标/面包屑由 Plugins 页自绘；官方 SettingsForm 自带保存栏，故本页没有
// 自建的保存条、页签栏，也没有「未保存」徽标（官方范式是「只有保存会写入」）。
// 进程区块是页内非配置内容：启停不是配置写入，不能走 configForms。
// 参考：knowledge/client/15 §4；docs/cookbook/adding-a-settings-card.md；
//   官方范本 ui-settings-shell/src/client/ShellCard.tsx。

import { createElement as h } from 'react'
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives'
import { HAIRLINE, R, S, T, cardStyle, captionText, noteText } from './theme.js'
import { Divider, ErrorBar, StatePill } from './parts.jsx'
import { AUTHORIZED, BASH_MODE, PORT, TUNNEL_HOSTNAME, TUNNEL_MODE, TUNNEL_NAME, WRITE_MODE, authorizedOfText } from './form.js'
import { OptionsFields, WorkspacesField } from './panels.jsx'
import { useCatalog } from './use-catalog.js'
import { useProcess } from './use-process.js'

/** SettingsForm 的框架文案（官方 SettingsFormLabels；五个键都必填）。 */
const LABELS = {
  unavailable: '本 profile 未提供该配置项（插件行未激活或设置面只读），当前按插件行配置工作。',
  readOnly: '当前 profile 的设置面只读，无法保存。',
  saveFailed: '保存未生效：Host 未接受（校验未通过或版本冲突），已回读当前生效值；草稿保留，请调整后重试。',
  save: '保存',
  saving: '保存中…',
}

/**
 * 本行配置页（`plugins.row.config` 的 keyed 槽位组件）。
 *
 * 官方契约（ui-plugin-manager/src/client/PluginManagerPage.tsx:491-495）：
 * 页面对本 entry 先要 `view: 'summary'` 作为行的一行说明，再要 `view: 'page'` 作为
 * 行页面的主体；主体由官方渲染在自己的 <section> 内。
 * @param {object} props 组件属性
 * @param {'summary'|'page'} props.view 视图类型
 * @param {(endpoint: string, payload?: object) => Promise<unknown>} props.call RPC 门面
 * @param {Function} props.useCodexProForm 官方 renderer 绑定的投影选择器 hook
 * @param {Function} props.edit 暂存某字段草稿
 * @param {Function} props.resetField 暂存某字段的清除
 * @param {Function} props.save 写入全部草稿
 * @param {Function} props.discard 丢弃全部草稿
 * @returns {object} React 元素
 */
export function CodexProCard(props) {
  // `hooks` 里的每个成员由 renderer 消费成 `use<Name>` 选择器 hook，
  // 且不会把 `hooks` 本身传进 props；页面传的 `form` prop 是一次性快照，故不用于草稿。
  const form = props.useCodexProForm((snapshot) => snapshot)
  const process = useProcess(props.call)
  const { catalog } = useCatalog(props.call)

  if (props.view === 'summary') {
    return h('span', null, '管理 codexpro：授权工作区、控制进程、选择 tunnel 方式')
  }

  // 表单不可用时官方 SettingsForm 会自己渲染提示行；进程区块仍应可读，
  // 因为进程状态不依赖设置面，且用户需要知道进程是否在跑。
  const disabled = !form.writable || form.saving

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
    h(ProcessBlock, { key: 'process', status: process.status, error: process.error, busy: process.busy, onAction: process.act, onRefresh: process.refresh }),
    h(SettingsForm, {
      key: 'form',
      labels: LABELS,
      state: form,
      onSave: props.save,
      onDiscard: props.discard,
    }, [
      h(OptionsFields, {
        key: 'options',
        fields: {
          tunnelMode: form[TUNNEL_MODE],
          tunnelHostname: form[TUNNEL_HOSTNAME],
          tunnelName: form[TUNNEL_NAME],
          port: form[PORT],
          bashMode: form[BASH_MODE],
          writeMode: form[WRITE_MODE],
        },
        disabled,
        onEdit: props.edit,
        onReset: props.resetField,
      }),
      h(WorkspacesField, {
        key: 'workspaces',
        workspaces: catalog?.workspaces ?? [],
        authorized: authorizedOfText(form[AUTHORIZED]?.text ?? ''),
        disabled,
        onEdit: props.edit,
      }),
      h('p', { key: 'note', style: captionText },
        '授权与参数改动需重启进程才生效；「保存」写入本 profile 的行配置（cordis.patch.yml）。'),
    ]),
  ])
}

/**
 * 进程区块：状态、启停与 Server URL。
 *
 * 这是页内唯一不走官方表单的部分：启停是瞬时动作，没有可序列化的配置值，
 * 也没有「保存」语义，故保留本插件的 RPC 端点。
 * @param {object} props 组件属性
 * @param {object|null} props.status 状态快照
 * @param {string} props.error 错误消息
 * @param {boolean} props.busy 是否忙
 * @param {Function} props.onAction 启停动作
 * @param {Function} props.onRefresh 刷新状态
 * @returns {object} React 元素
 */
function ProcessBlock({ status, error, busy, onAction, onRefresh }) {
  const state = status?.state ?? 'idle'
  const canStart = state === 'idle' || state === 'failed'
  const canStop = state === 'running' || state === 'starting'
  return h('section', { style: cardStyle }, [
    h('div', { key: 'head', style: { ...S.listRow, justifyContent: 'space-between' } }, [
      h('div', { key: 'left', style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        h(StatePill, { key: 'pill', state }),
        h('span', { key: 'meta', style: noteText }, status ? `端口 ${status.port} · tunnel ${status.tunnel}` : ''),
      ]),
      h('div', { key: 'actions', style: S.toolbar }, [
        h(ActionButton, { key: 'start', label: '启动', primary: true, disabled: busy || !canStart, onClick: () => onAction('start') }),
        h(ActionButton, { key: 'stop', label: '停止', disabled: busy || !canStop, onClick: () => onAction('stop') }),
        h(ActionButton, { key: 'refresh', label: '刷新状态', disabled: busy, onClick: onRefresh }),
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
          fontSize: '12px',
          lineHeight: '18px',
          borderRadius: R.sm,
          background: T.bgModulePlatform,
          color: T.labelSecondary,
          wordBreak: 'break-all',
        },
      }, status?.url || '（未运行或尚未生成 token）'),
    ]),
    error ? h(ErrorBar, { key: 'err', message: error }) : null,
    status?.lastError ? h(ErrorBar, { key: 'last', message: status.lastError }) : null,
  ])
}

/**
 * 行内按钮：无伪类表达，故按状态算样式（disabled 必须给出可见的禁用态）。
 * @param {object} props 组件属性
 * @param {string} props.label 文案
 * @param {boolean} [props.primary] 是否主按钮
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onClick 点击处理
 * @returns {object} React 元素
 */
function ActionButton({ label, primary, disabled, onClick }) {
  return h('button', {
    type: 'button',
    disabled,
    onClick,
    style: {
      border: primary ? 'none' : `${HAIRLINE} solid ${T.borderL2}`,
      borderRadius: R.sm,
      background: primary ? T.labelPrimary : 'transparent',
      color: primary ? T.bgLayer3 : T.labelSecondary,
      font: 'inherit',
      fontSize: '13px',
      padding: '4px 12px',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    },
  }, label)
}
