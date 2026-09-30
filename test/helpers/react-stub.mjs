// react-stub — 最小 React 替身：只实现本插件 Client hook 用到的四个 Hook。
//
// 用途：让 use-config.js 这类 Hook 能在裸 node 下被真实驱动（含 setState 与 effect 语义），
// 从而验证「多次 setState 的先后顺序」这类只有运行期才暴露的行为。
// 边界：仅供测试；不实现渲染、并发、Context 等与本次验证无关的能力。
// 控制面挂在 globalThis.__REACT_STUB__ 上，供测试驱动读取（stub 被打包进产物，无法直接 import）。

const control = {
  /** Hook 槽位（跨「渲染」保留，即 React 的 hook 状态）。 */
  hooks: [],
  /** 当前渲染的 hook 游标。 */
  cursor: 0,
  /** 本轮是否发生过 setState。 */
  dirty: false,
  /** 本轮收集到的 effect。 */
  effects: [],
}
globalThis.__REACT_STUB__ = control

/** 读取控制面（打包后测试仍能访问同一对象）。 */
export function __control() {
  return control
}

/**
 * 比较依赖数组。
 * @param {Array|undefined} previous 上次依赖
 * @param {Array|undefined} next 本次依赖
 * @returns {boolean} 等长且逐项 Object.is 相等时为 true
 */
function depsEqual(previous, next) {
  if (previous === undefined || next === undefined) return false
  if (previous.length !== next.length) return false
  return previous.every((value, index) => Object.is(value, next[index]))
}

/**
 * 状态 Hook。
 * @param {unknown} initial 初值或初值工厂
 * @returns {[unknown, Function]} 当前值与设置函数
 */
export function useState(initial) {
  const index = control.cursor++
  if (control.hooks[index] === undefined) {
    control.hooks[index] = {
      kind: 'state',
      value: typeof initial === 'function' ? initial() : initial,
    }
  }
  const slot = control.hooks[index]
  const setState = (next) => {
    slot.value = typeof next === 'function' ? next(slot.value) : next
    control.dirty = true
  }
  return [slot.value, setState]
}

/**
 * 回调 Hook（依赖不变则复用同一函数引用）。
 * @param {Function} fn 回调
 * @param {Array} deps 依赖
 * @returns {Function} 稳定的回调
 */
export function useCallback(fn, deps) {
  const index = control.cursor++
  const slot = control.hooks[index]
  if (slot !== undefined && slot.kind === 'callback' && depsEqual(slot.deps, deps)) return slot.fn
  control.hooks[index] = { kind: 'callback', fn, deps }
  return fn
}

/**
 * 记忆 Hook。
 * @param {Function} factory 计算函数
 * @param {Array} deps 依赖
 * @returns {unknown} 缓存值
 */
export function useMemo(factory, deps) {
  const index = control.cursor++
  const slot = control.hooks[index]
  if (slot !== undefined && slot.kind === 'memo' && depsEqual(slot.deps, deps)) return slot.value
  const value = factory()
  control.hooks[index] = { kind: 'memo', value, deps }
  return value
}

/**
 * 副作用 Hook（依赖不变则不重跑）。
 * @param {Function} effect 副作用
 * @param {Array} deps 依赖
 * @returns {void}
 */
export function useEffect(effect, deps) {
  const index = control.cursor++
  const slot = control.hooks[index]
  if (slot !== undefined && slot.kind === 'effect' && depsEqual(slot.deps, deps)) return
  control.hooks[index] = { kind: 'effect', deps }
  control.effects.push(effect)
}

/** 其余导出：本插件 Client 不直接用，占位以免打包时报缺失。 */
export function createElement() { return null }
export const Fragment = 'Fragment'
