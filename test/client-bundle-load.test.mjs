// client-bundle-load.test.mjs — Client 产物的可加载性冒烟。
//
// 验证：dist/client.js 作为脚本执行时只注册 factory；真正调用 factory 能返回
// 含 inject/apply 的模块对象。构建成功不等于可加载——惰性工厂里的运行时错误
// 只在物化时暴露，且浏览器端表现为整卡不渲染、无部署层报错。
// 参考：knowledge/client/14 §4；checklists/22 §6。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'dist', 'client.js')

/**
 * 在受控沙箱里执行产物并物化其 factory。
 * @returns {{moduleId: string, exports: object}} 模块 id 与工厂产物
 */
function loadBundle() {
  const source = readFileSync(bundlePath, 'utf8')
  let captured = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (entry) => { captured = entry },
      },
    },
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'client.js' })
  assert.ok(captured !== null, '产物必须调用 window.__ModuleLoader__.load 注册 factory')
  // 替身 require：平台包与 react 由 loader 模块表提供，此处模拟其存在。
  // 断言意图是「产物只 require 已声明的外部依赖」——出现清单外的 id 即说明有内联失败或漏声明。
  const require = (id) => {
    if (id === 'react' || id === 'react/jsx-runtime') return stubReact()
    if (id.startsWith('@deepseek-ai/')) return stubPlatform()
    throw new Error(`未预期的 require：${id}（跨包依赖应经 dsh.client.inject 声明并由平台提供）`)
  }
  const exports = captured.factory(require)
  return { moduleId: captured.id, exports }
}

/**
 * 构造平台 UI 包的替身（只占位，不触达渲染）。
 * @returns {object} 替身模块
 */
function stubPlatform() {
  const noop = () => null
  return new Proxy({}, {
    get: (_target, key) => (key === '__esModule' ? true : noop),
    has: () => true,
  })
}

/**
 * 构造 react 的最小替身（仅需满足模块顶层引用，不触发渲染）。
 * @returns {object} 替身模块
 */
function stubReact() {
  const createElement = () => null
  return { createElement, default: { createElement }, Fragment: 'Fragment', useCallback: (fn) => fn, useEffect: () => {}, useMemo: (fn) => fn(), useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}] }
}

test('client 产物可加载且导出 inject/apply', () => {
  const { moduleId, exports } = loadBundle()
  assert.equal(moduleId, 'dsh-codexpro', 'factory 的 id 必须是包名')
  assert.equal(typeof exports.apply, 'function', 'apply 必须是函数')
  assert.ok(Array.isArray(exports.inject), 'inject 必须是数组')
  assert.ok(exports.inject.includes('slots'), 'inject 必须含 slots')
  assert.ok(exports.inject.includes('configForms'), 'inject 必须含 configForms')
})

test('client 产物不内联跨包实现（纯净度）', () => {
  const source = readFileSync(bundlePath, 'utf8')
  // 外化生效的证据：平台包只以 require 形式出现，其实现体不在产物里。
  const required = /require\(["']@deepseek-ai\/dsh-client-ui-(primitives|slots|settings)["']\)/.test(source)
  assert.ok(required, '平台 UI 包必须外化为 require，不得内联实现')
  // 反向证据：这些包自己的内部标识若出现在产物里，说明被内联了。
  assert.ok(!source.includes('@deepseek-ai/dsh-client-ui-primitives/lib/'), '不得内联平台包实现体')
})
