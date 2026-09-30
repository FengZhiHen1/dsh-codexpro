// card — 插件页本行配置卡：把页签、状态编排与展示组装起来。
//
// 边界：只做组装；读写语义在 use-config.js，展示基元在 parts.jsx，页签内容在 panels.jsx。
// 视图分发：view='summary' 取一行摘要；view='page' 取完整配置页。
// 参考：technical-details/RPC通道与设置页.md §五；knowledge/client/15。

import { createElement as h, useState } from 'react'
import { S, noteText, sectionHead } from './theme.js'
import { SaveBar, TabBar } from './parts.jsx'
import { OptionsPanel, ProcessPanel, WorkspacesPanel } from './panels.jsx'
import { useConfig } from './use-config.js'

/**
 * 配置卡主组件。
 * @param {object} props 组件属性
 * @param {Function} props.call RPC 调用门面（由 Client 入口在 apply 期注入）
 * @param {string} [props.view] 视图类型（summary / page）
 * @returns {object} React 元素
 */
export function CodexProCard({ call, view }) {
  const [tab, setTab] = useState('process')
  const state = useConfig(call)

  if (view === 'summary') {
    return h('div', { style: { fontSize: '12px', color: S.muted.color } },
      '管理 codexpro：授权工作区、控制进程、选择 tunnel 方式')
  }

  return h('div', { style: S.panel }, [
    h('header', { key: 'head' }, [
      h('div', { key: 't', style: { ...sectionHead, fontSize: '15px' } }, 'CodexPro'),
      h('div', { key: 'd', style: { ...noteText, marginTop: '2px' } },
        '把 DSH 工作区授权给 ChatGPT，并托管本地 codexpro 进程。'),
    ]),
    h(TabBar, { key: 'tabs', active: tab, onChange: setTab }),
    renderTab(tab, state),
    renderSaveBar(tab, state),
    h('div', { key: 'note', style: noteText }, [
      h('div', { key: 'a' }, 'codexpro 是本地开发桥，不是操作系统级沙箱：授权一个目录即允许 ChatGPT 在其中读写并执行受控命令。'),
      h('div', { key: 'b' }, '本插件的数据目录与终端手工使用的 ~/.codexpro 相互独立。参数改动需重启进程才生效。'),
    ]),
  ])
}

/**
 * 渲染当前页签内容。
 * @param {string} tab 页签 id
 * @param {object} state useConfig 的返回值
 * @returns {object|null} React 元素
 */
function renderTab(tab, state) {
  if (tab === 'process') {
    return h(ProcessPanel, {
      key: 'process',
      status: state.status,
      busy: state.busy,
      onAction: state.act,
      onRefresh: state.refresh,
    })
  }
  if (tab === 'workspaces') {
    return h(WorkspacesPanel, {
      key: 'workspaces',
      workspaces: state.workspaces,
      draft: state.authDraft ?? {},
      onToggle: state.toggleWorkspace,
      anchorDir: state.catalog?.anchorDir ?? '',
    })
  }
  if (tab === 'options' && state.optionDraft) {
    return h(OptionsPanel, { key: 'options', draft: state.optionDraft, onChange: state.changeOption })
  }
  return null
}

/**
 * 渲染底部保存条（按页签决定保存动作与脏判据）。
 * @param {string} tab 页签 id
 * @param {object} state useConfig 的返回值
 * @returns {object} React 元素
 */
function renderSaveBar(tab, state) {
  if (tab === 'workspaces') {
    return h(SaveBar, {
      key: 'bar',
      dirty: state.authDirty,
      error: state.error,
      busy: state.busy,
      onSave: state.saveAuthorization,
    })
  }
  if (tab === 'options') {
    return h(SaveBar, {
      key: 'bar',
      dirty: state.optionDirty,
      error: state.error,
      busy: state.busy,
      onSave: state.saveOptions,
    })
  }
  // 进程页签没有草稿可存，只呈现错误（如启停失败）。
  return h(SaveBar, { key: 'bar', dirty: false, error: state.error, busy: state.busy, onSave: () => {} })
}
