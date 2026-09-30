// use-process.test.mjs — 驱动器测试：真实执行 use-process.js 的 Hook 逻辑。
//
// 手法：用 esbuild 把 hook 与 React 替身（test/helpers/react-stub.mjs）打包成单文件 CJS，
// 在裸 node 里加载并驱动「渲染 → 跑 effect → 触发动作 → 观察状态」，
// 从而验证 setState 的先后顺序这类只有运行期才暴露的行为。
// 证据面：进程区块的失败原因必须对用户可见（曾经因无条件刷新而被清掉，
//   见提交 583e8f9 修复的缺陷——本测试是该缺陷的回归闸门）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, '..', 'src', 'client', 'use-process.js')
const stub = path.join(here, 'helpers', 'react-stub.mjs')

/**
 * 把 hook 与 React 替身打包为可在裸 node 加载的 CJS。
 * @returns {Promise<string>} 产物代码
 */
async function bundleHook() {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    // 把 react 与其 jsx-runtime 指到替身：受测代码原样 import，不为测试改动生产代码。
    alias: { react: stub, 'react/jsx-runtime': stub, 'react/jsx-dev-runtime': stub },
  })
  return result.outputFiles[0].text
}

/**
 * 加载打包后的 hook，返回 useProcess 与 React 替身控制面。
 * @param {string} root 临时目录
 * @returns {Promise<{useProcess: Function, control: object}>} 加载结果
 */
async function loadHook(root) {
  const code = await bundleHook()
  const file = path.join(root, 'hook.cjs')
  await writeFile(file, code, 'utf8')
  const require = createRequire(import.meta.url)
  const mod = require(file)
  return { useProcess: mod.useProcess, control: globalThis.__REACT_STUB__ }
}

/**
 * 冲刷微任务与宏任务队列，使 effect 内未返回的异步工作得以完成。
 * React 的常规写法是 useEffect(() => { load() }, [deps])，其返回 undefined，
 * 故驱动端需主动等待，不能只依赖 effect 的返回值。
 * @returns {Promise<void>} 队列排空后结算
 */
function flush() {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * 驱动一次「渲染」：进入该 hook 的实例作用域，调用 hook，执行本轮 effect 并冲刷
 * 异步工作，在状态持续更新时重复渲染直到稳定（模拟 React 的 render → effect → render 循环）。
 * @param {Function} useProcess 受测 hook
 * @param {Function} call RPC 门面
 * @param {object} control React 替身控制面
 * @returns {Promise<object>} 稳定后的状态快照
 */
async function render(useProcess, call, control) {
  let state = null
  // 上界 10 轮：每次渲染至多触发一轮 effect，正常路径 2 轮内稳定。
  // 无上界会在状态持续变化时无限循环（真实 React 由调度器保证收敛，替身需自带护栏）。
  for (let round = 0; round < 10; round += 1) {
    control.enter('codexpro-process')
    control.effects = []
    control.dirty = false
    state = useProcess(call)
    while (control.effects.length) {
      const effect = control.effects.shift()
      const result = effect()
      if (result instanceof Promise) await result
      await flush()
    }
    await flush()
    if (!control.dirty) break
  }
  return state
}

/**
 * 构造一个只实现进程端点的 RPC 门面。
 * @param {object} options 行为开关
 * @param {Function} [options.onAction] start/stop 端点的行为
 * @returns {Function} call 门面
 */
function makeCall({ onAction } = {}) {
  return async (endpoint) => {
    if (endpoint === 'status') {
      return { state: 'idle', port: '8787', tunnel: 'none', token: '', url: '', lastError: '' }
    }
    if (endpoint === 'start' || endpoint === 'stop') return onAction ? onAction(endpoint) : {}
    return {}
  }
}

test('初始渲染读回进程状态', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-proc-'))
  try {
    const { useProcess, control } = await loadHook(root)
    const state = await render(useProcess, makeCall(), control)
    assert.ok(state.status !== null, '初始渲染后应已读回 status')
    assert.equal(state.status.state, 'idle')
    assert.equal(state.busy, false)
    assert.equal(state.error, '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动失败的原因必须对用户可见（不被随后的刷新清除）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-proc-'))
  try {
    const { useProcess, control } = await loadHook(root)
    const call = makeCall({
      onAction: () => {
        throw new Error('codexpro 未安装或包结构不符：请执行 npm install -g codexpro 后重试')
      },
    })
    const state = await render(useProcess, call, control)

    // 触发启动（失败）——这是用户点「启动」的真实路径。
    await state.act('start')

    const next = await render(useProcess, call, control)
    assert.ok(next.error !== '', '启动失败后错误必须仍然可见，否则用户无从得知原因')
    assert.ok(next.error.includes('npm install -g codexpro'), '错误应保留可行动的修复信息')
    assert.equal(next.busy, false, '失败后应解除忙碌态')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动成功后清除错误并读回新状态', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-proc-'))
  try {
    const { useProcess, control } = await loadHook(root)
    let running = false
    const call = async (endpoint) => {
      if (endpoint === 'status') {
        return { state: running ? 'running' : 'idle', port: '8787', tunnel: 'none', token: 't', url: 'u', lastError: '' }
      }
      if (endpoint === 'start') { running = true; return {} }
      return {}
    }
    const state = await render(useProcess, call, control)
    await state.act('start')
    const next = await render(useProcess, call, control)
    assert.equal(next.error, '', '成功后应清除错误')
    assert.equal(next.status.state, 'running', '成功后应读回新状态')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('刷新失败时保留上次状态并给出错误', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-proc-'))
  try {
    const { useProcess, control } = await loadHook(root)
    let fail = false
    const call = async (endpoint) => {
      if (endpoint === 'status') {
        if (fail) throw new Error('通道断了')
        return { state: 'idle', port: '8787', tunnel: 'none', token: '', url: '', lastError: '' }
      }
      return {}
    }
    const state = await render(useProcess, call, control)
    assert.equal(state.status.state, 'idle')

    fail = true
    await state.refresh()
    const next = await render(useProcess, call, control)
    assert.ok(next.error.includes('通道断了'), '刷新失败应报错')
    assert.equal(next.status.state, 'idle', '刷新失败时不应清掉上次读到的状态')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
