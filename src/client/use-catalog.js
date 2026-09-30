// use-catalog — 授权候选集的读取：DSH 工作区注册表经 Host 归一后的清单。
//
// 边界：只读候选集（路径/标题/存在性）；不持有授权意图——授权意图是官方表单草稿
// （见 form.js 的 authorized 字段），本 hook 不缓存它，避免同一事实出现两个来源。
// 授权态的候选集读取与进程状态分开：进程状态随启停频繁变化，候选集只在打开页面时读一次。
// 参考：technical-details/配置与profile投影.md §四。

import { useCallback, useEffect, useState } from 'react'

/**
 * 读取授权候选工作区。
 * @param {(endpoint: string, payload?: object) => Promise<unknown>} call RPC 调用门面
 * @returns {{catalog: object|null, anchorDir: string, error: string, refresh: Function}} 候选集与元信息
 */
export function useCatalog(call) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')

  /**
   * 读回候选集。失败只记录，不清空已有数据：页面仍可显示上次读到的清单。
   * @returns {Promise<void>} 完成后结算
   */
  const refresh = useCallback(async () => {
    try {
      setCatalog(await call('catalog'))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }, [call])

  useEffect(() => { refresh() }, [refresh])

  return { catalog, anchorDir: catalog?.anchorDir ?? '', error, refresh }
}
