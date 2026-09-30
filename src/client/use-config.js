// use-config — 卡片的读写状态编排：读快照、维护草稿、提交并处理失败。
//
// 边界：把 RPC 调用与草稿语义集中一处，组件只消费返回值与回调；
// 不在渲染期发请求，不在失败时静默（错误经 error 字段交给 UI 呈现）。
// 参考：technical-details/RPC通道与设置页.md §五/§六。

import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * 从 catalog 快照提取授权映射。
 * @param {object|null} catalog catalog 端点返回的快照
 * @returns {Record<string, boolean>} 路径到授权状态的映射
 */
function authorizationOf(catalog) {
  const list = catalog?.workspaces
  if (!Array.isArray(list)) return {}
  return Object.fromEntries(list.map((item) => [item.path, item.authorized === true]))
}

/**
 * 从 catalog 快照提取参数草稿。
 * @param {object|null} catalog catalog 端点返回的快照
 * @returns {object|null} 参数字段草稿；快照缺失时为 null
 */
function optionsOf(catalog) {
  if (!catalog) return null
  return {
    tunnelMode: catalog.tunnelMode,
    tunnelHostname: catalog.tunnelHostname,
    port: catalog.port,
    bashMode: catalog.bashMode,
    writeMode: catalog.writeMode,
  }
}

/**
 * 把任意失败值转为可读消息。
 * @param {unknown} failure 失败值
 * @returns {string} 可读消息
 */
function describeError(failure) {
  return failure instanceof Error ? failure.message : String(failure)
}

/**
 * 把一次读回的数据写进各状态槽。
 *
 * 抽为模块级函数而非留在 hook 内：每个读回字段对应一个 setter，留在 hook 里会让
 * 函数体被样板代码撑长，而这里没有需要 hook 上下文的分支。
 * @param {object} setters 状态设置函数集合
 * @param {object} statusData status 端点返回
 * @param {object} catalogData catalog 端点返回
 * @returns {void}
 */
function applySnapshot(setters, statusData, catalogData) {
  setters.setStatus(statusData)
  setters.setCatalog(catalogData)
  setters.setAuthDraft(authorizationOf(catalogData))
  const options = optionsOf(catalogData)
  setters.setOptionDraft(options)
  setters.setOptionBaseline(options)
}

/**
 * 卡片的数据与动作编排。
 * @param {(endpoint: string, payload?: object) => Promise<unknown>} call RPC 调用门面
 * @returns {object} 状态与动作集合
 */
export function useConfig(call) {
  const [status, setStatus] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [authDraft, setAuthDraft] = useState(null)
  const [optionDraft, setOptionDraft] = useState(null)
  const [optionBaseline, setOptionBaseline] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 读回状态与候选集。
   *
   * 成功时不清除已有错误：本函数会被动作流程的 finally 调用，而动作刚设置的错误
   * 正是用户最需要看到的（如「未安装 codexpro，请执行 …」）。清除它会让失败静默。
   * 错误只在两种情况下被清：动作自身成功时（见 run），或下一次动作开始时。
   * @returns {Promise<void>} 完成后结算
   */
  const refresh = useCallback(async () => {
    const setters = { setStatus, setCatalog, setAuthDraft, setOptionDraft, setOptionBaseline }
    try {
      const [statusData, catalogData] = await Promise.all([call('status'), call('catalog')])
      applySnapshot(setters, statusData, catalogData)
    } catch (failure) {
      setError(describeError(failure))
    }
  }, [call])

  useEffect(() => { refresh() }, [refresh])

  const optionDirty = useMemo(() => {
    if (!optionDraft || !optionBaseline) return false
    return Object.keys(optionDraft).some((key) => optionDraft[key] !== optionBaseline[key])
  }, [optionDraft, optionBaseline])

  const workspaces = catalog?.workspaces ?? []
  const authDirty = workspaces.some((item) => (authDraft?.[item.path] === true) !== (item.authorized === true))

  const actions = buildActions({
    call,
    refresh,
    setters: { setBusy, setError, setAuthDraft, setOptionDraft },
    state: { authDraft, optionDraft },
  })

  return {
    status,
    catalog,
    workspaces,
    authDraft,
    optionDraft,
    optionDirty,
    authDirty,
    error,
    busy,
    refresh,
    ...actions,
  }
}

/**
 * 构造对外暴露的动作集合。
 *
 * 抽为模块级函数：动作集合由「统一包裹器 + 若干一行委托」构成，留在 hook 内
 * 只让 hook 函数体变长（触发复杂度告警），而这里没有需要 hook 上下文的分支。
 * @param {object} deps 依赖
 * @param {Function} deps.call RPC 门面
 * @param {Function} deps.refresh 读回函数（动作成功后调用）
 * @param {object} deps.setters 状态设置函数（setBusy / setError / setAuthDraft / setOptionDraft）
 * @param {object} deps.state 当前草稿（authDraft / optionDraft）
 * @returns {object} 动作集合
 */
function buildActions({ call, refresh, setters, state }) {
  /**
   * 统一包裹一次写动作：置忙、清错、执行、成功则刷新。
   *
   * 失败时不刷新：刷新会重读服务端并清空错误，使失败对用户不可见；
   * 且失败后状态多未变化，读回的价值低于保留原因。
   * @param {() => Promise<unknown>} action 动作
   * @returns {Promise<void>} 完成后结算
   */
  const run = async (action) => {
    setters.setBusy(true)
    setters.setError('')
    let failed = false
    try {
      await action()
    } catch (failure) {
      failed = true
      setters.setError(describeError(failure))
    } finally {
      setters.setBusy(false)
    }
    if (!failed) await refresh()
  }

  return {
    /** 启停进程。 @param {'start'|'stop'} action 动作 @returns {Promise<void>} 完成后结算 */
    act: (action) => run(() => call(action)),
    /** 保存授权集。 @returns {Promise<void>} 完成后结算 */
    saveAuthorization: () => run(() => call('setAuthorization', { authorized: state.authDraft ?? {} })),
    /** 保存参数。 @returns {Promise<void>} 完成后结算 */
    saveOptions: () => run(() => call('configure', state.optionDraft)),
    /** 切换某工作区授权草稿。 @param {string} path 路径 @param {boolean} next 新值 @returns {void} */
    toggleWorkspace: (path, next) => setters.setAuthDraft((prev) => ({ ...(prev ?? {}), [path]: next })),
    /** 变更参数字段草稿。 @param {string} field 字段 @param {string} value 新值 @returns {void} */
    changeOption: (field, value) => setters.setOptionDraft((prev) => (prev === null ? prev : { ...prev, [field]: value })),
  }
}
