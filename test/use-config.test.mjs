// use-config.test.mjs — 驱动器测试：真实执行 use-config.js 的 Hook 逻辑。
//
// 手法：用 esbuild 把 hook 与 React 替身（test/helpers/react-stub.mjs）打包成单文件 CJS，
// 在裸 node 里加载并驱动「渲染 → 跑 effect → 触发动作 → 观察状态」，
// 从而验证 setState 的先后顺序这类只有运行期才暴露的行为。
// 参考：technical-details/RPC通道与设置页.md §六（失败语义必须可见）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, '..', 'src', 'client', 'use-config.js')
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
    // 把 react 指到替身：受测代码原样 import 'react'，不为其改动生产代码。
    alias: { react: stub },
  })
  return result.outputFiles[0].text
}

/**
 * 加载打包后的 hook，返回 useConfig 与 React 替身控制面。
 * @param {string} root 临时目录
 * @returns {Promise<{useConfig: Function, control: object, cleanup: () => Promise<void>}>} 加载结果
 */
async function loadHook(root) {
  const code = await bundleHook()
  const file = path.join(root, 'hook.cjs')
  await writeFile(file, code, 'utf8')
  const require = createRequire(import.meta.url)
  const mod = require(file)
  return { useConfig: mod.useConfig, control: globalThis.__REACT_STUB__ }
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
 * 驱动一次「渲染」：进入该组件实例的 hook 作用域，调用 hook，执行本轮 effect 并冲刷
 * 异步工作，在状态持续更新时重复渲染直到稳定（模拟 React 的 render → effect → render 循环）。
 * @param {Function} useConfig 受测 hook
 * @param {Function} call RPC 门面
 * @param {object} control React 替身控制面（含 enter）
 * @returns {Promise<object>} 稳定后的状态快照
 */
async function render(useConfig, call, control) {
  let state = null
  // 上界 10 轮：每次渲染至多触发一轮 effect，正常路径 2 轮内稳定。
  // 无上界会在状态持续变化时无限循环（真实 React 由调度器保证收敛，替身需自带护栏）。
  for (let round = 0; round < 10; round += 1) {
    control.enter('codexpro-card')
    control.effects = []
    control.dirty = false
    state = useConfig(call)
    while (control.effects.length) {
      const effect = control.effects.shift()
      const result = effect()
      if (result instanceof Promise) await result
      // effect 体通常不返回 Promise（花括号写法），故需主动冲刷其发起的异步工作。
      await flush()
    }
    await flush()
    if (!control.dirty) break
  }
  return state
}

/**
 * 构造一个只实现所需端点的 RPC 门面。
 * @param {object} options 行为开关
 * @param {Function} [options.onStart] start 端点的行为
 * @returns {Function} call 门面
 */
function makeCall({ onStart }) {
  return async (endpoint, payload) => {
    if (endpoint === 'status') return { state: 'idle', port: '8787', tunnel: 'none', token: '', url: '', lastError: '', anchorDir: 'E:\\anchor' }
    if (endpoint === 'catalog') return { workspaces: [], anchorDir: 'E:\\anchor', tunnelMode: 'none', tunnelHostname: '', port: '8787', bashMode: 'safe', writeMode: 'workspace' }
    if (endpoint === 'start') return onStart(payload)
    return {}
  }
}

test('初始渲染读取状态与候选集', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-hook-'))
  try {
    const { useConfig, control } = await loadHook(root)
    // refresh 是异步的：effect 内发起的读取在 effect 返回后才结算，
    // 故需在 effect 执行后等待微任务队列排空，再取稳定快照。
    const state = await render(useConfig, makeCall({ onStart: async () => ({}) }), control)
    assert.ok(state.status !== null, '初始渲染后应已读回 status')
    assert.equal(state.status.state, 'idle')
    assert.equal(state.busy, false)
    assert.equal(state.error, '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('启动失败的错误必须对用户可见（不被随后的刷新清除）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-hook-'))
  try {
    const { useConfig, control } = await loadHook(root)
    const call = makeCall({
      onStart: async () => {
        throw new Error('codexpro 未安装或包结构不符：请执行 npm install -g codexpro 后重试')
      },
    })
    const state = await render(useConfig, call, control)

    // 触发启动（失败）——这是用户点「启动」的真实路径。
    const afterAct = await state.act('start')
    void afterAct

    // 重新渲染取最新状态。
    const next = await render(useConfig, call, control)
    assert.ok(next.error !== '', '启动失败后错误必须仍然可见，否则用户无从得知原因')
    assert.ok(next.error.includes('npm install -g codexpro'), '错误应保留可行动的修复信息')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('保存成功的错误态被清除', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-hook-'))
  try {
    const { useConfig, control } = await loadHook(root)
    const call = makeCall({ onStart: async () => ({}) })
    const state = await render(useConfig, call, control)
    await state.saveOptions()
    const next = await render(useConfig, call, control)
    assert.equal(next.error, '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
