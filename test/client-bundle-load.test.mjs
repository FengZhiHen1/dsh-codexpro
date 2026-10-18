// client-bundle-load.test.mjs — Client 产物的可加载性与纯净度冒烟。
//
// 验证：dist/client.js 作为脚本执行时只注册 factory；真正调用 factory 能返回
// 含 inject/apply 的模块对象；产物不 require 任何 Harness Client 包。
// 构建成功不等于可加载——惰性工厂里的运行时错误只在物化时暴露，且浏览器端表现为
// 整卡不渲染、无部署层报错。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「Client 半区构建」「Client UI 引用」。

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
  // 替身 require：React 由 loader 模块表提供，此处模拟其存在。
  // 断言意图是「产物只 require 已声明的外部依赖」——出现清单外的 id 即说明有内联失败或漏声明。
  const require = (id) => {
    if (id === 'react' || id === 'react/jsx-runtime') return stubReact()
    throw new Error(`未预期的 require：${id}（插件不得引用 Harness Client 包）`)
  }
  const exports = captured.factory(require)
  return { moduleId: captured.id, exports }
}

/**
 * 构造 react 的最小替身（仅需满足模块顶层引用，不触发渲染）。
 * @returns {object} 替身模块
 */
function stubReact() {
  const createElement = () => null
  return {
    createElement,
    default: { createElement },
    Fragment: 'Fragment',
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  }
}

test('client 产物可加载且导出 inject/apply', () => {
  const { moduleId, exports } = loadBundle()
  assert.equal(moduleId, 'dsh-codexpro', 'factory 的 id 必须是包名')
  assert.equal(typeof exports.apply, 'function', 'apply 必须是函数')
  assert.ok(Array.isArray(exports.inject), 'inject 必须是数组')
  for (const name of ['slots', 'locale', 'configForms', 'connection']) {
    assert.ok(exports.inject.includes(name), `inject 必须含 ${name}`)
  }
})

test('client 产物不引用任何 Harness Client 包', () => {
  const source = readFileSync(bundlePath, 'utf8')
  assert.doesNotMatch(source, /require\(["']@deepseek-ai\/dsh-client-[^"']+["']\)/,
    'Harness Client 包不是插件可依赖面，配置页须复制实现')
  assert.doesNotMatch(source, /@deepseek-ai\/dsh-client-ui-primitives/,
    '不得出现 primitives 的引用或实现体')
  // 反向证据：React 仍经模块表外化，没有被内联。
  assert.match(source, /require\(["']react["']\)/, 'React 必须外化为 require')
})
