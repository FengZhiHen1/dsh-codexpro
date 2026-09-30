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
   * @returns {Promise<void>} 完成后结算
   */
  const refresh = useCallback(async () => {
    try {
      const [statusData, catalogData] = await Promise.all([call('status'), call('catalog')])
      setStatus(statusData)
      setCatalog(catalogData)
      setAuthDraft(authorizationOf(catalogData))
      const options = optionsOf(catalogData)
      setOptionDraft(options)
      setOptionBaseline(options)
      setError('')
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

  /**
   * 统一包裹一次写动作：置忙、清错、执行、刷新。
   * @param {() => Promise<unknown>} action 动作
   * @returns {Promise<void>} 完成后结算
   */
  const run = useCallback(async (action) => {
    setBusy(true)
    try {
      await action()
      setError('')
    } catch (failure) {
      setError(describeError(failure))
    } finally {
      setBusy(false)
      await refresh()
    }
  }, [refresh])

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
    /** 启停进程。 @param {'start'|'stop'} action 动作 @returns {Promise<void>} 完成后结算 */
    act: (action) => run(() => call(action)),
    /** 保存授权集。 @returns {Promise<void>} 完成后结算 */
    saveAuthorization: () => run(() => call('setAuthorization', { authorized: authDraft ?? {} })),
    /** 保存参数。 @returns {Promise<void>} 完成后结算 */
    saveOptions: () => run(() => call('configure', optionDraft)),
    /** 切换某工作区授权草稿。 @param {string} path 路径 @param {boolean} next 新值 @returns {void} */
    toggleWorkspace: (path, next) => setAuthDraft((prev) => ({ ...(prev ?? {}), [path]: next })),
    /** 变更参数字段草稿。 @param {string} field 字段 @param {string} value 新值 @returns {void} */
    changeOption: (field, value) => setOptionDraft((prev) => (prev === null ? prev : { ...prev, [field]: value })),
  }
}
