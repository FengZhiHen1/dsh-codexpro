// react-stub — 最小 React 替身：供本插件的 Client Hook 与组件在裸 node 下被驱动。
//
// 用途：验证「多次 setState 的先后顺序」「元素树的 ARIA 属性与键盘映射」这类
// 只有运行期才暴露的行为。渲染产物是最小对象树，测试可直接检查其 props。
// hook 按「组件实例键」隔离：父子组件各有自己的槽位，不会互相覆盖（真实 React 亦如此）。
// 边界：仅供测试；不实现渲染、并发、Context 等与本次验证无关的能力。
// 控制面挂在 globalThis.__REACT_STUB__ 上（stub 经 esbuild 打进产物后无法直接 import）。

const control = {
  /** 实例键 → hook 槽位数组。 */
  store: new Map(),
  /** 当前组件实例键。 */
  key: null,
  /** 当前实例内的 hook 游标。 */
  cursor: 0,
  /** 本轮是否发生过 setState。 */
  dirty: false,
  /** 本轮收集到的 effect。 */
  effects: [],
}
globalThis.__REACT_STUB__ = control

/**
 * 进入某个组件实例的渲染作用域（重置该实例的游标）。
 * @param {string} key 实例键（调用方按树中位置生成，保证同一实例跨轮稳定）
 * @returns {void}
 */
function enter(key) {
  control.key = key
  control.cursor = 0
  if (!control.store.has(key)) control.store.set(key, [])
}
// 挂到控制面上：测试经 globalThis.__REACT_STUB__ 即可驱动，无需额外 import。
control.enter = enter

/** 读取控制面（打包后测试仍能访问同一对象）。 */
export function __control() {
  return control
}

/**
 * 取当前实例的 hook 槽位。
 * @param {number} index 槽位序号
 * @param {Function} create 槽位不存在时的构造器
 * @returns {object} 槽位
 */
function slot(index, create) {
  const hooks = control.store.get(control.key)
  if (hooks[index] === undefined) hooks[index] = create()
  return hooks[index]
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
  const s = slot(index, () => ({ kind: 'state', value: typeof initial === 'function' ? initial() : initial }))
  const setState = (next) => {
    s.value = typeof next === 'function' ? next(s.value) : next
    control.dirty = true
  }
  return [s.value, setState]
}

/**
 * 引用 Hook。返回稳定对象，赋给 .current 即可（组件用它持 DOM 引用）。
 * @param {unknown} initial 初值
 * @returns {{current: unknown}} 稳定引用对象
 */
export function useRef(initial) {
  const index = control.cursor++
  return slot(index, () => ({ kind: 'ref', ref: { current: initial } })).ref
}

/**
 * 回调 Hook（依赖不变则复用同一函数引用）。
 * @param {Function} fn 回调
 * @param {Array} deps 依赖
 * @returns {Function} 稳定的回调
 */
export function useCallback(fn, deps) {
  const index = control.cursor++
  const s = slot(index, () => ({ kind: 'callback', fn, deps }))
  if (s.kind === 'callback' && depsEqual(s.deps, deps)) return s.fn
  s.kind = 'callback'
  s.fn = fn
  s.deps = deps
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
  const s = slot(index, () => ({ kind: 'memo', value: undefined, deps: undefined }))
  if (s.kind === 'memo' && depsEqual(s.deps, deps)) return s.value
  s.kind = 'memo'
  s.value = factory()
  s.deps = deps
  return s.value
}

/**
 * 副作用 Hook（依赖不变则不重跑）。
 * @param {Function} effect 副作用
 * @param {Array} deps 依赖
 * @returns {void}
 */
export function useEffect(effect, deps) {
  const index = control.cursor++
  const s = slot(index, () => ({ kind: 'effect', deps: undefined }))
  if (s.kind === 'effect' && depsEqual(s.deps, deps)) return
  s.kind = 'effect'
  s.deps = deps
  control.effects.push(effect)
}

/**
 * 创建元素。返回最小对象树：函数组件记其类型与 props（测试可继续调用它展开），
 * 宿主标签记 tag 与 props。
 * @param {Function|string} type 组件或标签名
 * @param {object|null} props 属性
 * @param {...unknown} children 子节点
 * @returns {object} 元素描述
 */
export function createElement(type, props, ...children) {
  const flat = children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false)
  return { type, props: { ...(props ?? {}), children: flat } }
}

/**
 * jsx-runtime 的 jsx 接口（automatic JSX 编译目标）。子节点在 props.children 里。
 * @param {Function|string} type 组件或标签名
 * @param {object} props 属性（含 children）
 * @returns {object} 元素描述
 */
export function jsx(type, props) {
  return createElement(type, props)
}

/** jsx-runtime 的 jsxs 接口（多子节点形态，语义与 jsx 相同）。 */
export const jsxs = jsx

/** jsx-dev-runtime 的开发态接口，与 jsx 同形即可满足驱动需要。 */
export const jsxDEV = jsx

export const Fragment = 'Fragment'
export default { createElement, jsx, jsxs, jsxDEV, Fragment }
