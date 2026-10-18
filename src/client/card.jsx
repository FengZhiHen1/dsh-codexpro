// card — 本行配置页：进程区块（自建）+ 官方形态的配置表单。
//
// 边界：只做组装与呈现；字段规格与草稿模型在 form.js / settings-model.js，进程状态在
// use-process.js，展示基元在 parts.jsx。页面外壳（行标题/图标/面包屑）由 Plugins 页自绘，
// 故本页不自带卡片壳、标题、页签栏或「未保存」徽标；只有保存才写入。
// 进程区块是页内非配置内容：启停不是配置写入，不能走 configForms。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」；官方 ShellCard.tsx。

import { createElement as h } from 'react'
import { SettingsForm } from './fields.jsx'
import { CLIENT_CSS } from './styles.js'
import { ErrorNote, StatusTag } from './parts.jsx'
import { ActionButton } from './controls.jsx'
import { AUTHORIZED, BASH_MODE, PORT, TUNNEL_HOSTNAME, TUNNEL_MODE, TUNNEL_NAME, WRITE_MODE, authorizedOfText } from './form.js'
import { OptionsFields, WorkspacesField } from './panels.jsx'
import { useCatalog } from './use-catalog.js'
import { useProcess } from './use-process.js'

/**
 * 本行配置页（`plugins.row.config` 的 keyed 槽位组件）。
 *
 * 官方契约（ui-plugin-manager/src/client/PluginManagerPage.tsx:648-690）：
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
 * @param {Function} props.t 本页 locale 命名空间的翻译函数
 * @returns {object} React 元素
 */
export function CodexProCard(props) {
  // summary 由官方对每个行卡片索取：只给一行说明，不建立表单订阅、不发 RPC。
  if (props.view === 'summary') return h('span', null, props.t('summary'))
  return h(CodexProPage, props)
}

/**
 * 配置页主体。hooks 只在 page 视图执行，避免 summary 触发状态与候选集读取。
 * @param {object} props 组件属性（同 CodexProCard）
 * @returns {object} React 元素
 */
function CodexProPage(props) {
  // `hooks` 里的每个成员由 renderer 消费成 `use<Name>` 选择器 hook，
  // 且不会把 `hooks` 本身传进 props；页面传的 `form` prop 是一次性快照，故不用于草稿。
  const form = props.useCodexProForm((snapshot) => snapshot)
  const process = useProcess(props.call)
  const { catalog } = useCatalog(props.call)
  const t = props.t

  // 表单不可用时官方 SettingsForm 会自己渲染提示行；进程区块仍应可读，
  // 因为进程状态不依赖设置面，且用户需要知道进程是否在跑。
  const disabled = !form.writable || form.saving

  return h('div', { className: 'cxp-settings' }, [
    h('style', { key: 'styles' }, CLIENT_CSS),
    h(ProcessBlock, {
      key: 'process',
      status: process.status,
      error: process.error,
      busy: process.busy,
      onAction: process.act,
      onRefresh: process.refresh,
      t,
    }),
    h(SettingsForm, {
      key: 'form',
      labels: {
        unavailable: t('unavailable'),
        readOnly: t('readOnly'),
        saveFailed: t('saveFailed'),
        save: t('save'),
        saving: t('saving'),
      },
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
        t,
      }),
      h(WorkspacesField, {
        key: 'workspaces',
        workspaces: catalog?.workspaces ?? [],
        authorized: authorizedOfText(form[AUTHORIZED]?.text ?? ''),
        disabled,
        onEdit: props.edit,
        t,
      }),
      h('p', { key: 'note', className: 'cxp-note' }, t('restartNote')),
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
 * @param {Function} props.t 翻译函数
 * @returns {object} React 元素
 */
function ProcessBlock({ status, error, busy, onAction, onRefresh, t }) {
  // 首次读取失败时不能谎报「未启动」：没有状态就用未知，禁用瞬时的启停动作。
  const state = status?.state ?? (error ? 'unknown' : 'idle')
  const canStart = state === 'idle' || state === 'failed'
  const canStop = state === 'running' || state === 'starting'
  return h('section', {
    className: 'cxp-process',
    'aria-labelledby': 'codexpro-process-title',
  }, [
    h('div', { key: 'head', className: 'cxp-process-head' }, [
      h('div', { key: 'status', className: 'cxp-process-status' }, [
        h('h3', { key: 'title', id: 'codexpro-process-title' }, t('processTitle')),
        h(StatusTag, { key: 'tag', state, t }),
        status
          ? h('p', { key: 'meta', className: 'cxp-process-meta' }, t('processMeta', {
            port: status.port,
            tunnel: status.tunnel,
          }))
          : null,
      ]),
      h('div', { key: 'actions', className: 'cxp-toolbar' }, [
        h(ActionButton, {
          key: 'start',
          label: t('start'),
          variant: 'primary',
          disabled: busy || !canStart,
          onClick: () => onAction('start'),
        }),
        h(ActionButton, {
          key: 'stop',
          label: t('stop'),
          variant: 'outline',
          disabled: busy || !canStop,
          onClick: () => onAction('stop'),
        }),
        h(ActionButton, {
          key: 'refresh',
          label: t('refresh'),
          variant: 'ghost',
          disabled: busy,
          onClick: onRefresh,
        }),
      ]),
    ]),
    h('div', { key: 'url' }, [
      h('p', { key: 'label', className: 'cxp-url-label' }, t('serverUrlLabel')),
      h('code', { key: 'value', className: 'cxp-url' }, status?.url || t('serverUrlEmpty')),
    ]),
    error ? h(ErrorNote, { key: 'error', message: error }) : null,
    status?.lastError ? h(ErrorNote, { key: 'last', message: status.lastError }) : null,
  ])
}
