// ui-spec.test.mjs — UI 规格测试：把「与官方设置页同构」这一声称变成可验证的断言。
//
// 覆盖只有运行期才能确认的事：
//   1. 配置页形态（官方规范：不自带卡片壳/页签栏，保存栏归官方 SettingsForm）；
//   2. 授权工作区复选框：点击只暂存草稿（把整份映射序列化后 edit 一次），不发请求；
//   3. `view: 'summary'` 只给一行说明，不渲染表单与进程区块。
// 手法：esbuild 打包 card.jsx 与 React 替身，在裸 node 中调用组件函数并检查元素树。
// 参考：knowledge/client/15 §4；docs/cookbook/adding-a-settings-card.md。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const stub = path.join(here, 'helpers', 'react-stub.mjs')

/**
 * esbuild 插件：把平台包替换为轻量替身，避免 node 侧解析其 CSS 依赖。
 * 只需满足本插件用到的原语（SettingsForm / Checkbox / Tag），其余导出返回空函数以防误用。
 * @returns {object} esbuild 插件
 */
function stubPlatformPlugin() {
  return {
    name: 'stub-platform',
    setup(build) {
      build.onResolve({ filter: /^@deepseek-ai\// }, (args) => ({ path: args.path, namespace: 'platform-stub' }))
      build.onLoad({ filter: /.*/, namespace: 'platform-stub' }, () => ({
        contents: `
function passthrough(name) {
  // 必须保留 props.children：SettingsForm 的子节点就是被测的字段控件，
  // 丢掉它们会让断言只看到空壳（曾把「找不到复选框」误判为产品缺陷）。
  return function Stub(props) {
    const children = props && props.children !== undefined ? props.children : []
    return { type: name, props: { ...(props ?? {}), children } }
  }
}
const SettingsForm = passthrough('SettingsForm')
const SettingsValueField = passthrough('SettingsValueField')
const SettingsSecretField = passthrough('SettingsSecretField')
const SettingsFormModel = class StubFormModel {
  constructor(scope, specs) { this.scope = scope; this.specs = specs }
  bind(project) { this.project = project; return { get: () => project() } }
  shell() { return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false } }
  field(field) { const spec = this.specs.find((s) => s.field === field); return { text: spec ? spec.format(undefined) : '', overridden: false, invalid: false } }
  actions() { return { edit: () => {}, resetField: () => {}, save: () => {}, discard: () => {} } }
  dispose() {}
}
function settingsTextField(field) {
  return { field, format: (v) => (typeof v === 'string' ? v : ''), parse: (t) => (String(t).trim() === '' ? { kind: 'clear' } : { kind: 'set', value: String(t).trim() }) }
}
const Checkbox = passthrough('Checkbox')
const Tag = passthrough('Tag')
const Button = passthrough('Button')
const Pill = passthrough('Pill')
// 图标原语：官方以函数组件形态导出，自绘字段的帮助按钮要用。
const IconInfoOutlineRegular = passthrough('IconInfoOutlineRegular')
export { SettingsForm, SettingsValueField, SettingsSecretField, SettingsFormModel, settingsTextField, Checkbox, Tag, Button, Pill, IconInfoOutlineRegular }
export default { SettingsForm, SettingsValueField, SettingsSecretField, SettingsFormModel, settingsTextField, Checkbox, Tag, Button, Pill, IconInfoOutlineRegular }
`,
        loader: 'js',
      }))
    },
  }
}

/**
 * 打包入口与其 React 替身。
 *
 * 平台包必须外化（与生产 build-client.mjs 的 external 一致）：它们是浏览器侧的
 * shell-seeded 模块，且其实现 import CSS Module——内联进 node 侧的打包树会因
 * 无法处理 .module.css 而失败。外化后由替身提供，与真实 loader 的模块表同形。
 * @param {string} entry 源码入口
 * @param {string} root 临时目录
 * @param {string} name 产物名
 * @returns {Promise<object>} 模块导出
 */
async function load(entry, root, name) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    external: ['@deepseek-ai/*'],
    // JSX 经 jsx-runtime 编译（automatic），故两个 specifier 都要指向替身。
    alias: { react: stub, 'react/jsx-runtime': stub, 'react/jsx-dev-runtime': stub },
    plugins: [stubPlatformPlugin()],
  })
  const file = path.join(root, `${name}.cjs`)
  await writeFile(file, result.outputFiles[0].text, 'utf8')
  return createRequire(import.meta.url)(file)
}

/**
 * 取元素的文本内容。
 *
 * 替身的 createElement 把子节点统一收进数组（与真实 React 的 props.children 同形），
 * 故文本比较必须展平后再比——直接 `children === '文案'` 永远不成立。
 * @param {object} element 元素
 * @returns {string} 文本
 */
function textOf(element) {
  const children = element?.props?.children
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.filter((child) => typeof child === 'string').join('')
  return ''
}

/**
 * 深度遍历元素树，收集满足谓词的元素。
 * @param {object|Array} node 元素或元素数组
 * @param {Function} predicate 谓词
 * @param {Array} [out] 收集容器
 * @returns {Array} 命中的元素
 */
function findAll(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, predicate, out)
    return out
  }
  if (predicate(node)) out.push(node)
  findAll(node.props?.children, predicate, out)
  return out
}

/**
 * 加载 form.js 的字段规格（它顶层 import 平台原语，故须经打包与外化）。
 * @param {string} root 临时目录
 * @returns {Promise<object>} form 模块导出
 */
async function loadForm(root) {
  return load(path.join(here, '..', 'src', 'client', 'form.js'), root, 'form')
}

/**
 * 展开函数组件：调用其函数体并把产物接回树（供断言穿透到宿主标签）。
 * @param {object} tree 元素树
 * @param {object} control React 替身控制面
 * @returns {object} 展开后的树
 */
function expand(tree, control) {
  let counter = 0
  /**
   * 递归展开。
   * @param {object} node 元素
   * @returns {object} 展开后的元素
   */
  const walk = (node) => {
    if (node === null || node === undefined || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(walk)
    if (typeof node.type === 'function') {
      // 实例键 = 组件名 + 在树中的遍历序号；同一结构跨轮稳定，故 hook 状态得以保留。
      const key = `${node.type.name || 'Anon'}#${counter++}`
      control.enter(key)
      return walk(node.type(node.props))
    }
    return { ...node, props: { ...node.props, children: walk(node.props?.children) } }
  }
  return walk(tree)
}

/** 冲刷微任务与宏任务队列，使 effect 内未返回的异步工作得以完成。 */
function flush() {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * 渲染一个组件并驱动其 effect，直至稳定。
 *
 * 必须真的执行 effect：组件的 useEffect 会发起异步读取（status/catalog），
 * 不执行它们，断言就看不到由读取结果驱动的分支（曾把「读不到端点」误判为产品缺陷）。
 * @param {Function} Component 组件
 * @param {object} props 属性
 * @param {object} control React 替身控制面
 * @returns {Promise<object>} 稳定后的元素树
 */
async function renderComponent(Component, props, control) {
  let tree = null
  // 上界 8 轮：每轮展开一次树并跑一轮 effect，正常路径 2 轮内稳定。
  for (let round = 0; round < 8; round += 1) {
    control.effects = []
    control.dirty = false
    tree = expand({ type: Component, props: { ...props, children: [] } }, control)
    while (control.effects.length) {
      const effect = control.effects.shift()
      const result = effect()
      if (result instanceof Promise) await result
      await flush()
    }
    await flush()
    if (!control.dirty) break
  }
  return tree
}

/** 造一份表单状态（各字段的官方状态形状）。 */
function makeForm(overrides = {}) {
  const base = {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    tunnelMode: { text: 'none', overridden: false, invalid: false },
    tunnelHostname: { text: '', overridden: false, invalid: false },
    tunnelName: { text: '', overridden: false, invalid: false },
    port: { text: '8787', overridden: false, invalid: false },
    bashMode: { text: 'safe', overridden: false, invalid: false },
    writeMode: { text: 'workspace', overridden: false, invalid: false },
    authorized: { text: '{}', overridden: false, invalid: false },
  }
  return { ...base, ...overrides }
}

/**
 * 渲染配置页并驱动其 effect。
 * @param {object} card 已加载的 card 模块
 * @param {object} control React 替身控制面
 * @param {object} [options] 覆盖项
 * @returns {Promise<object>} 元素树
 */
function renderCard(card, control, options = {}) {
  const form = options.form ?? makeForm()
  const calls = options.calls ?? []
  const edits = options.edits ?? []
  const call = async (endpoint) => {
    calls.push(endpoint)
    if (endpoint === 'status') return { state: 'idle', port: '8787', tunnel: 'none', token: '', url: '', lastError: '' }
    if (endpoint === 'catalog') {
      return {
        workspaces: options.workspaces ?? [],
        anchorDir: 'E:\\anchor',
        port: '8787',
        tunnelMode: 'none',
        tunnelHostname: '',
        bashMode: 'safe',
        writeMode: 'workspace',
      }
    }
    return {}
  }
  return renderComponent(card.CodexProCard, {
    view: options.view ?? 'page',
    call,
    useCodexProForm: () => form,
    edit: (field, text) => edits.push([field, text]),
    resetField: () => {},
    save: () => {},
    discard: () => {},
  }, control)
}

test('配置页渲染官方 SettingsForm（配置部分不自带卡片壳）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)
    const forms = findAll(tree, (el) => el.type === 'SettingsForm')
    assert.equal(forms.length, 1, '配置部分必须由官方 SettingsForm 承载')
    // 官方规范：页面的行标题/图标/面包屑由 Plugins 页自绘，插件侧不自带。
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'tablist').length, 0, '不应自带页签栏')
    assert.equal(findAll(tree, (el) => el.type === 'h2').length, 0, '不应自带标题')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('summary 视图只给一行说明，不渲染表单与进程区块', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control, { view: 'summary' })
    assert.equal(findAll(tree, (el) => el.type === 'SettingsForm').length, 0)
    assert.equal(findAll(tree, (el) => el.type === 'section').length, 0, 'summary 不应渲染进程区块')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('进程区块独立于配置表单（启停不走 configForms）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const calls = []
    const tree = await renderCard(card, control, { calls })
    // 进程区块是唯一含启停按钮的区块；配置字段按组包在 <section> 里，故不能按 section 计数。
    const buttons = findAll(tree, (el) => el.type === 'button').map(textOf)
    assert.ok(buttons.includes('启动'), '进程区块应含启动按钮')
    assert.ok(calls.includes('status'), '进程区块应读 status 端点')
    assert.ok(calls.includes('catalog'), '配置页应读 catalog 端点取候选工作区')
    // 配置读的不是本插件端点：那两个端点已下线。
    assert.ok(!calls.includes('configure'), '不应调用已下线的 configure 端点')
    assert.ok(!calls.includes('setAuthorization'), '不应调用已下线的 setAuthorization 端点')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('进程区块的启停按钮按状态给出可见禁用态', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)
    const buttons = findAll(tree, (el) => el.type === 'button')
    const labels = buttons.map(textOf)
    assert.ok(labels.includes('启动'), `应有启动按钮，实际 ${JSON.stringify(labels)}`)
    assert.ok(labels.includes('停止'), '应有停止按钮')
    // 未运行时：启动可用、停止禁用；且禁用态必须有可见视觉（不能只 disable）。
    const start = buttons.find((el) => textOf(el) === '启动')
    const stop = buttons.find((el) => textOf(el) === '停止')
    assert.equal(start.props.disabled, false)
    assert.equal(stop.props.disabled, true)
    assert.equal(stop.props.style.opacity, 0.4, '禁用必须给出可见禁用态')
    assert.equal(stop.props.style.cursor, 'default')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('授权工作区逐项勾选，点击只暂存草稿（不发请求）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const edits = []
    const calls = []
    const tree = await renderCard(card, control, {
      edits,
      calls,
      workspaces: [
        { path: 'E:\\a', title: 'A', exists: true, authorized: false },
        { path: 'E:\\b', title: 'B', exists: true, authorized: false },
      ],
    })

    const boxes = findAll(tree, (el) => el.type === 'Checkbox')
    assert.equal(boxes.length, 2, '每个候选工作区一个复选框')
    boxes[0].props.onChange(true)

    // 关键断言：复选框只把整份映射序列化成一次 edit，不触发任何 RPC。
    assert.equal(edits.length, 1, '勾选应产生一次草稿编辑')
    assert.equal(edits[0][0], 'authorized', '编辑的是 authorized 字段')
    assert.deepEqual(JSON.parse(edits[0][1]), { 'E:\\a': true }, '草稿应为整份映射的 JSON')
    assert.ok(!calls.includes('setAuthorization'), '勾选不得发请求（草稿由官方模型在保存时写入）')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('不存在的目录禁止勾选且带可见标记', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control, {
      workspaces: [{ path: 'E:\\gone', title: '已消失', exists: false, authorized: false }],
    })
    const boxes = findAll(tree, (el) => el.type === 'Checkbox')
    assert.equal(boxes[0].props.disabled, true, '目录不存在时禁止勾选')
    const tags = findAll(tree, (el) => el.type === 'Tag')
    assert.ok(tags.some((el) => textOf(el) === '目录不存在'), '应给出可见原因')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('草稿里的授权态驱动复选框选中（单一来源）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control, {
      form: makeForm({ authorized: { text: JSON.stringify({ 'E:\\a': true }), overridden: true, invalid: false } }),
      workspaces: [
        { path: 'E:\\a', title: 'A', exists: true, authorized: false },
        { path: 'E:\\b', title: 'B', exists: true, authorized: false },
      ],
    })
    const boxes = findAll(tree, (el) => el.type === 'Checkbox')
    assert.equal(boxes[0].props.checked, true, '草稿里已授权的项应显示为勾选')
    assert.equal(boxes[1].props.checked, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('无工作区时给出可行动提示而非空列表', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control, { workspaces: [] })
    assert.equal(findAll(tree, (el) => el.type === 'Checkbox').length, 0)
    const texts = findAll(tree, (el) => textOf(el) !== '').map(textOf).join('\n')
    assert.ok(texts.includes('还没有工作区'), '应说明如何让工作区出现')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('字段按组分隔：每组有小标题，组内字段有相邻分隔线', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)

    // 分组标题：h3（官方设置节的 groupTitle 形态）
    const heads = findAll(tree, (el) => el.type === 'h3').map(textOf)
    assert.ok(heads.includes('网络接入'), `应有「网络接入」分组，实际 ${JSON.stringify(heads)}`)
    assert.ok(heads.includes('权限'), '应有「权限」分组')
    assert.ok(heads.includes('授权工作区'), '应有「授权工作区」分组')

    // 相邻分隔线：每个分组内首个字段无顶线，其余有 0.5px border-l2 顶线。
    // 官方用 CSS 相邻选择器，内联样式表达不了，故这是显式控制的——漏掉它整片字段会连成一团。
    const dividers = findAll(tree, (el) => typeof el.props?.style?.borderTop === 'string'
      && el.props.style.borderTop.includes('0.5px'))
    assert.ok(dividers.length >= 2, `组内非首字段应有分隔线，实际命中 ${dividers.length}`)
    assert.ok(dividers.every((el) => el.props.style.borderTop.includes('--dsw-alias-border-l2')),
      '分隔线应走官方 border-l2 且为 0.5px')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('每个字段都有可展开的详细引导（点「?」）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)

    const helpButtons = findAll(tree, (el) => el.props?.['aria-label'] === '字段说明')
    // tunnel / hostname(可选) / port / bash / write / authorized —— 至少 5 个常驻字段。
    assert.ok(helpButtons.length >= 5, `每个字段都应有帮助按钮，实际 ${helpButtons.length}`)
    assert.ok(helpButtons.every((el) => el.props['aria-expanded'] === false), '默认应折叠')
    assert.ok(helpButtons.every((el) => typeof el.props['aria-controls'] === 'string'), '应与说明区经 aria-controls 关联')

    // 折叠时不渲染说明正文（点开才占空间）。
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'region').length, 0, '默认不应渲染说明正文')

    // 点开第一个帮助按钮，说明应展开。
    const before = control.effects.length
    helpButtons[0].props.onClick()
    const expanded = await renderCard(card, control)
    const regions = findAll(expanded, (el) => el.props?.['role'] === 'region')
    assert.ok(regions.length >= 1, '点开后应渲染说明区')
    // 引导文案要够详细：tunnel 的说明逐项解释了各取值，不该只有一句话。
    const body = regions.map((el) => findAll(el, (node) => textOf(node) !== '').map(textOf).join(' ')).join(' ')
    assert.ok(body.length > 60, `说明应足够详细，实际 ${body.length} 字`)
    assert.ok(before >= 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('表单不可写时禁用配置控件，但进程区块仍可读', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control, {
      form: makeForm({ writable: false }),
      workspaces: [{ path: 'E:\\a', title: 'A', exists: true, authorized: false }],
    })
    const boxes = findAll(tree, (el) => el.type === 'Checkbox')
    assert.equal(boxes[0].props.disabled, true, '只读时配置控件应禁用')
    // 进程状态不依赖设置面：只读时仍应渲染并读到状态（按启停按钮判定，不按 section 计数）。
    const buttons = findAll(tree, (el) => el.type === 'button').map(textOf)
    assert.ok(buttons.includes('启动'), '进程区块仍应渲染')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('全圆胶囊必须成对声明 corner-shape: round（官方 Pill/Tag 同款）', async () => {
  // 宿主 corner-shape.css 用 *,*::before,*::after 把圆角统一为 superellipse(1.5)，
  // 会把未声明 corner-shape: round 的胶囊两端压成方角（Chrome 139+ 可见）。
  const theme = await import('../src/client/theme.js')
  assert.equal(theme.pillBase.borderRadius, '999px')
  assert.equal(theme.pillBase.cornerShape, 'round', '全圆角必须配 cornerShape: round，否则方角化')
})

test('中性实线边框一律 0.5px，半径走 token（无离格字面量）', async () => {
  const theme = await import('../src/client/theme.js')
  assert.equal(theme.HAIRLINE, '0.5px')
  assert.ok(theme.cardStyle.border.startsWith(`${theme.HAIRLINE} `),
    `卡描边应为 0.5px，实际 ${theme.cardStyle.border}`)
  assert.equal(theme.dividerStyle.height, theme.HAIRLINE)
  assert.match(theme.cardStyle.borderRadius, /^var\(--dsw-radius-/,
    '卡半径必须走 --dsw-radius-* token（v0.1.7 起离格字面量会被宿主守卫拒斥）')
})

test('隧道名输入框只在 cloudflare-named 下出现（条件字段）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__

    /** 取当前树里的全部文本框占位符，用于判定字段是否出现。 */
    const placeholders = (tree) => findAll(tree, (el) => el.type === 'input')
      .map((el) => el.props?.placeholder)
      .filter(Boolean)

    // none：既无 hostname 也无隧道名。
    const none = await renderCard(card, control)
    assert.ok(!placeholders(none).includes('codexpro'), 'none 下不应出现隧道名输入框')

    // ngrok：有 hostname，无隧道名（隧道名只对 cloudflare-named 有意义）。
    const ngrok = await renderCard(card, control, {
      form: makeForm({ tunnelMode: { text: 'ngrok', overridden: false, invalid: false } }),
    })
    assert.ok(placeholders(ngrok).includes('your-domain.ngrok-free.dev'), 'ngrok 下应出现 hostname')
    assert.ok(!placeholders(ngrok).includes('codexpro'), 'ngrok 下不应出现隧道名')

    // cloudflare-named：两者都出现（这是原先缺失的字段）。
    const named = await renderCard(card, control, {
      form: makeForm({ tunnelMode: { text: 'cloudflare-named', overridden: false, invalid: false } }),
    })
    const namedFields = placeholders(named)
    assert.ok(namedFields.includes('your-domain.ngrok-free.dev'), 'cloudflare-named 下应出现 hostname')
    assert.ok(namedFields.includes('codexpro'), 'cloudflare-named 下应出现隧道名输入框（原缺失）')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('隧道名字段有 128 上限的本地校验文案', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const form = await loadForm(root)
    const spec = form.SPECS.find((item) => item.field === 'tunnelName')
    assert.ok(spec, '应有 tunnelName 字段规格')
    assert.deepEqual(spec.parse(''), { kind: 'clear' }, '空值表达为 clear')
    assert.deepEqual(spec.parse('  codexpro  '), { kind: 'set', value: 'codexpro' }, '应去空白')
    assert.equal(spec.parse('x'.repeat(129)), undefined, '超 128 应挡住保存')
    assert.deepEqual(spec.parse('x'.repeat(128)), { kind: 'set', value: 'x'.repeat(128) })
    // 条件字段判定与 core 词表同源。
    assert.equal(form.needsTunnelName('cloudflare-named'), true)
    for (const mode of ['none', 'cloudflare', 'ngrok', 'tailscale']) {
      assert.equal(form.needsTunnelName(mode), false, `${mode} 不需要隧道名`)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('字段规格：枚举取自 core 词表、端口限范围、授权集只留 true 且键有序', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const form = await loadForm(root)
    const core = await import('../src/core/codexpro.js')

    // 1) 字段齐全，且枚举取值来自 core 权威词表（不硬编码副本）。
    const fields = form.SPECS.map((spec) => spec.field)
    for (const name of ['tunnelMode', 'tunnelHostname', 'port', 'bashMode', 'writeMode', 'authorized']) {
      assert.ok(fields.includes(name), `应包含字段 ${name}`)
    }
    const tunnel = form.SPECS.find((spec) => spec.field === 'tunnelMode')
    assert.equal(tunnel.parse('nope'), undefined, '词表外取值应被拒（镜像 Host 的 union(const)）')
    assert.deepEqual(tunnel.parse(core.TUNNEL_MODES[1]), { kind: 'set', value: core.TUNNEL_MODES[1] })

    // 2) 端口：只接受范围内的整数（空值、非数字、越界、非整数都挡住保存）。
    const port = form.SPECS.find((spec) => spec.field === 'port')
    assert.deepEqual(port.parse('9000'), { kind: 'set', value: '9000' }, 'Host schema 是字符串，写回字符串')
    assert.equal(port.parse(''), undefined, '空值不算合法端口')
    assert.equal(port.parse('abc'), undefined)
    assert.equal(port.parse('70000'), undefined, '越界应被拒')
    assert.equal(port.parse('8787.5'), undefined, '非整数应被拒')

    // 3) 授权集：空集合表达为 clear（回落默认值，不写空气对象）；键排序使同一集合总有同一草稿文本。
    const spec = form.SPECS.find((item) => item.field === 'authorized')
    assert.deepEqual(spec.parse('{}'), { kind: 'clear' })
    assert.deepEqual(spec.parse('{"E:\\\\b":true,"E:\\\\a":true}'), {
      kind: 'set',
      value: { 'E:\\a': true, 'E:\\b': true },
    })
    assert.deepEqual(spec.parse('{"E:\\\\a":false}'), { kind: 'clear' }, 'false 与缺席等价')
    assert.equal(spec.parse('{ bad json'), undefined, '非法 JSON 应挡住保存')
    assert.equal(spec.parse('["E:\\\\a"]'), undefined, '数组不是映射')
    assert.equal(spec.parse('{"E:\\\\a":"yes"}'), undefined, '非布尔值会被 Host 拒，本地同样拒')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
