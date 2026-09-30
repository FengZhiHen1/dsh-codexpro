// use-process — 进程区块的状态与动作：RPC 读状态、启停、错误归集。
//
// 边界：只管进程（本插件唯一不走官方 configForms 的部分——启停是瞬时动作，
// 没有可序列化的配置值，也无「保存」语义，故仍走本插件的 RPC 端点）。
// 配置字段的草稿与写入一律归官方 SettingsFormModel（见 form.js）。
// 参考：technical-details/进程管理.md；technical-details/RPC通道与设置页.md §六。

import { useCallback, useEffect, useState } from 'react'

/**
 * 把任意失败值转为可读消息。
 * @param {unknown} failure 失败值
 * @returns {string} 可读消息
 */
function describeError(failure) {
  return failure instanceof Error ? failure.message : String(failure)
}

/**
 * 进程区块的数据与动作。
 * @param {(endpoint: string, payload?: object) => Promise<unknown>} call RPC 调用门面
 * @returns {object} 状态与动作集合
 */
export function useProcess(call) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 读回进程状态。成功时不清除已有错误——本函数会被动作流程调用，而动作刚设置的错误
   * 正是用户最需要看到的（如未安装 codexpro 的可行动提示）；清除它会让失败静默。
   * @returns {Promise<void>} 完成后结算
   */
  const refresh = useCallback(async () => {
    try {
      setStatus(await call('status'))
    } catch (failure) {
      setError(describeError(failure))
    }
  }, [call])

  useEffect(() => { refresh() }, [refresh])

  /**
   * 执行一次启停动作；失败时保留原因，不刷新（刷新会重读服务端并清空错误）。
   * @param {'start'|'stop'} action 动作名
   * @returns {Promise<void>} 完成后结算
   */
  const act = useCallback(async (action) => {
    setBusy(true)
    setError('')
    let failed = false
    try {
      await call(action)
    } catch (failure) {
      failed = true
      setError(describeError(failure))
    } finally {
      setBusy(false)
    }
    if (!failed) await refresh()
  }, [call, refresh])

  return { status, error, busy, refresh, act }
}
