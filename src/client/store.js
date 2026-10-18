// store — 最小快照 store：getSnapshot / subscribe / set，供官方表单模型的 bind 投影使用。
//
// 边界：只做观察者分发，不做选择器、持久化或 React 绑定；选择器 hook 由宿主 renderer
// 依据 slot inject 的 hooks 合成。实现刻意保持极小，避免把 Harness Client 包引入 bundle。
// 参考：@deepseek-ai/dsh-client-store 的 createSnapshotStore（仅取其同步 set 语义）。

/**
 * 创建快照 store。
 * @param {unknown} initial 初始快照
 * @returns {{getSnapshot: () => unknown, subscribe: (listener: () => void) => (() => void), set: (next: unknown) => void}} store
 */
export function createSnapshotStore(initial) {
  let state = initial
  const listeners = new Set()

  /**
   * 广播一次快照变化；单个订阅者抛错不阻断其余订阅者。
   * @returns {void}
   */
  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        console.error('dsh-codexpro: snapshot subscriber failed', error)
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      if (Object.is(next, state)) return
      state = next
      notify()
    },
  }
}
