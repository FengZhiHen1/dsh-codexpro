// ui-spec.test.mjs — UI 规格测试：把「与官方设置页同构」这一声称变成可验证的断言。
//
// 覆盖只有运行期才能确认的事：
//   1. 配置页形态（官方规范：不自带卡片壳/页签栏，保存栏归复制的 SettingsForm）；
//   2. 授权工作区复选框：点击只暂存草稿（把整份映射序列化后 edit 一次），不发请求；
//   3. `view: 'summary'` 只给一行说明，不渲染表单与进程区块，也不发 RPC；
//   4. 字段几何、帮助展开、只读禁用与 select 外框；
//   5. 样式无字面颜色、表单根无 max-width。
// 手法：esbuild 打包 card.jsx 与 React 替身，在裸 node 中调用组件函数并检查元素树。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { CLIENT_CSS } from '../src/client/styles.js'
import { zh } from '../src/client/locales.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const stub = path.join(here, 'helpers', 'react-stub.mjs')

/**
 * 以中文词典构造翻译函数，支持 `{name}` 插值。
 * @param {Record<string, string>} dictionary 词典
 * @returns {(key: string, params?: Record<string, unknown>) => string} 翻译函数
 */
function translate(dictionary) {
  return (key, params = {}) => {
    const template = dictionary[key] ?? key
    return String(template).replace(/\{(\w+)\}/g, (match, name) => (
      Object.hasOwn(params, name) ? String(params[name]) : match
    ))
  }
}

/**
 * 打包入口并加载；React 替身经 alias 注入。
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
    // JSX 经 jsx-runtime 编译（automatic），故两个 specifier 都要指向替身。
    alias: { react: stub, 'react/jsx-runtime': stub, 'react/jsx-dev-runtime': stub },
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
 * 加载 form.js 的字段规格（其引用的模型已在本地复制，无需外化）。
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
  const t = options.t ?? translate(zh)
  const call = async (endpoint) => {
    calls.push(endpoint)
    if (endpoint === 'status' && options.statusError) throw new Error('status 读取失败')
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
    t,
    useCodexProForm: () => form,
    edit: (field, text) => edits.push([field, text]),
    resetField: () => {},
    save: () => {},
    discard: () => {},
  }, control)
}

test('配置页渲染 SettingsForm 形态，且不自带标题/页签/卡片壳', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)
    assert.equal(findAll(tree, (el) => el.props?.className === 'cxp-form').length, 1,
      '配置部分必须由复制的 SettingsForm 承载')
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'tablist').length, 0, '不应自带页签栏')
    assert.equal(findAll(tree, (el) => el.type === 'h2').length, 0, '不应自带标题')
    // 表单根不得写 max-width（宽度归宿主 960px 内容列）。
    const forms = findAll(tree, (el) => el.props?.className === 'cxp-form')
    assert.equal(forms[0].props.style, undefined, '表单根不应带内联宽度约束')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('summary 视图只给一行说明，不渲染表单与进程区块，也不发 RPC', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const calls = []
    const tree = await renderCard(card, control, { view: 'summary', calls })
    assert.equal(findAll(tree, (el) => el.props?.className === 'cxp-form').length, 0)
    assert.equal(findAll(tree, (el) => el.props?.className === 'cxp-process').length, 0,
      'summary 不应渲染进程区块')
    assert.deepEqual(calls, [], 'summary 不应读取 status/catalog')
    assert.equal(textOf(tree), zh.summary)
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
    const buttons = findAll(tree, (el) => el.type === 'button').map(textOf)
    assert.ok(buttons.includes(zh.start), '进程区块应含启动按钮')
    assert.ok(calls.includes('status'), '进程区块应读 status 端点')
    assert.ok(calls.includes('catalog'), '配置页应读 catalog 端点取候选工作区')
    assert.ok(!calls.includes('configure'), '不应调用已下线的 configure 端点')
    assert.ok(!calls.includes('setAuthorization'), '不应调用已下线的 setAuthorization 端点')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('进程区块的启停按钮按状态给出原生 disabled 与可见禁用态', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)
    const buttons = findAll(tree, (el) => el.type === 'button')
    const start = buttons.find((el) => textOf(el) === zh.start)
    const stop = buttons.find((el) => textOf(el) === zh.stop)
    assert.equal(start.props.disabled, false)
    assert.equal(stop.props.disabled, true)
    assert.equal(stop.props.className, 'cxp-button')
    // 禁用态必须可见：官方 Button 的 opacity:.4 规则被复制进样式表。
    assert.match(CLIENT_CSS, /\.cxp-button:disabled\{[^}]*opacity:\.4/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('首次状态读取失败时显示未知，不谎报未启动，且禁用启停', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const tree = await renderCard(card, globalThis.__REACT_STUB__, { statusError: true })
    const tags = findAll(tree, (el) => el.props?.className === 'cxp-tag').map(textOf)
    assert.ok(tags.includes(zh.statusUnknown), `状态应为未知，实际 ${JSON.stringify(tags)}`)
    const buttons = findAll(tree, (el) => el.type === 'button')
    const start = buttons.find((el) => textOf(el) === zh.start)
    const stop = buttons.find((el) => textOf(el) === zh.stop)
    assert.equal(start.props.disabled, true, '状态未知时禁止启动')
    assert.equal(stop.props.disabled, true, '状态未知时禁止停止')
    assert.ok(findAll(tree, (el) => el.props?.className === 'cxp-error').length >= 1,
      '读取失败原因应对用户可见')
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

    const boxes = findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox')
    assert.equal(boxes.length, 2, '每个候选工作区一个复选框')
    boxes[0].props.onChange({ target: { checked: true } })

    // 关键断言：复选框只把整份映射序列化成一次 edit，不触发任何 RPC。
    assert.equal(edits.length, 1, '勾选应产生一次草稿编辑')
    assert.equal(edits[0][0], 'authorized', '编辑的是 authorized 字段')
    assert.deepEqual(JSON.parse(edits[0][1]), { 'E:\\a': true }, '草稿应为整份映射的 JSON')
    assert.ok(!calls.includes('setAuthorization'), '勾选不得发请求（草稿由官方模型在保存时写入）')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('勾选后草稿键有序，同一集合总有同一文本（dirty 判定稳定）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const edits = []
    const tree = await renderCard(card, control, {
      edits,
      form: makeForm({ authorized: { text: JSON.stringify({ 'E:\\b': true }), overridden: true, invalid: false } }),
      workspaces: [
        { path: 'E:\\a', title: 'A', exists: true, authorized: false },
        { path: 'E:\\b', title: 'B', exists: true, authorized: false },
      ],
    })
    const boxes = findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox')
    boxes[0].props.onChange({ target: { checked: true } })
    assert.equal(edits[0][1], JSON.stringify({ 'E:\\a': true, 'E:\\b': true }),
      '新增项后应按路径排序，而不是把新键追加到末尾')
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
    const boxes = findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox')
    assert.equal(boxes[0].props.disabled, true, '目录不存在时禁止勾选')
    const tags = findAll(tree, (el) => el.props?.className === 'cxp-tag')
    assert.ok(tags.some((el) => textOf(el) === zh.missingDirectory), '应给出可见原因')
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
    const boxes = findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox')
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
    assert.equal(findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox').length, 0)
    const texts = findAll(tree, (el) => textOf(el) !== '').map(textOf).join('\n')
    assert.ok(texts.includes(zh.workspacesEmpty), '应说明如何让工作区出现')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('分组结构与两级分隔：标题靠字重，组间比组内更醒目', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)

    const heads = findAll(tree, (el) => el.type === 'h3')
    const headTexts = heads.map(textOf)
    for (const title of [zh.processTitle, zh.networkTitle, zh.permissionTitle, zh.workspacesTitle]) {
      assert.ok(headTexts.includes(title), `应有「${title}」标题，实际 ${JSON.stringify(headTexts)}`)
    }

    // 分组 section 与标题经 aria-labelledby 关联（官方 SubagentCard 同形）。
    const sections = findAll(tree, (el) => el.type === 'section' && el.props?.className === 'cxp-section')
    assert.equal(sections.length, 3, '应恰好三个配置分组')
    for (const section of sections) {
      assert.equal(typeof section.props['aria-labelledby'], 'string')
      const titled = heads.some((head) => head.props.id === section.props['aria-labelledby'])
      assert.ok(titled, `分组 section 应指向存在的标题 id，实际 ${section.props['aria-labelledby']}`)
    }

    // 层级与两级分隔由复制来的 CSS 承担。
    assert.match(CLIENT_CSS, /\.cxp-section-head h3\{[^}]*font-size:13px;[^}]*font-weight:600/)
    assert.match(CLIENT_CSS, /\.cxp-section \+ \.cxp-section\{border-top:\.5px solid var\(--dsw-alias-border-l4\)\}/)
    assert.match(CLIENT_CSS, /\.cxp-field \+ \.cxp-field\{border-top:\.5px solid var\(--dsw-alias-border-l2\)\}/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('每个字段都有可展开的详细引导（点 info）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = await renderCard(card, control)

    const helpButtons = findAll(tree, (el) => el.props?.className === 'cxp-help-button')
    // tunnel / hostname(条件) / port / bash / write / workspaces 分组 —— 至少 5 个常驻入口。
    assert.ok(helpButtons.length >= 5, `每个字段都应有帮助按钮，实际 ${helpButtons.length}`)
    assert.ok(helpButtons.every((el) => el.props['aria-expanded'] === false), '默认应折叠')
    assert.ok(helpButtons.every((el) => typeof el.props['aria-controls'] === 'string'), '应与说明区经 aria-controls 关联')

    // 折叠时不渲染说明正文（点开才占空间）。
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'region').length, 0, '默认不应渲染说明正文')

    // 点开第一个帮助按钮，说明应展开。
    helpButtons[0].props.onClick()
    const expanded = await renderCard(card, control)
    const regions = findAll(expanded, (el) => el.props?.['role'] === 'region')
    assert.ok(regions.length >= 1, '点开后应渲染说明区')
    const body = regions.map((el) => findAll(el, (node) => textOf(node) !== '').map(textOf).join(' ')).join(' ')
    assert.ok(body.length > 60, `说明应足够详细，实际 ${body.length} 字`)
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
    const boxes = findAll(tree, (el) => el.type === 'input' && el.props?.type === 'checkbox')
    assert.equal(boxes[0].props.disabled, true, '只读时配置控件应禁用')
    const buttons = findAll(tree, (el) => el.type === 'button').map(textOf)
    assert.ok(buttons.includes(zh.start), '进程区块仍应渲染')
    const readonly = findAll(tree, (el) => el.props?.className === 'cxp-readonly')
    assert.equal(readonly.length, 1, '只读时应显示官方 readOnly 提示')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('SettingsForm 的保存键遵循 !dirty || invalid || saving 禁用语义', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__

    /** 取保存键。 */
    const saveOf = (tree) => findAll(tree, (el) => el.type === 'button' && el.props?.className === 'cxp-save')[0]

    const clean = await renderCard(card, control)
    assert.equal(saveOf(clean).props.disabled, true, '未修改时保存禁用')
    assert.equal(textOf(saveOf(clean)), zh.save)

    const dirty = await renderCard(card, control, { form: makeForm({ dirty: true }) })
    assert.equal(saveOf(dirty).props.disabled, false, '有改动且合法时可保存')

    const invalid = await renderCard(card, control, { form: makeForm({ dirty: true, invalid: true }) })
    assert.equal(saveOf(invalid).props.disabled, true, '非法草稿禁用保存')

    const saving = await renderCard(card, control, { form: makeForm({ dirty: true, saving: true }) })
    assert.equal(saveOf(saving).props.disabled, true, '保存中禁用保存')
    assert.equal(textOf(saveOf(saving)), zh.saving, '保存中文案固定为「保存中…」')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('下拉框外观由 div 外框承担，select 本体透明（走查事故 2026-09-30）', async () => {
  // 事故：用户环境里 `appearance: none` 之后，`<select>` 自身的 border 直边一个像素都不画
  // （截图像素扫描：顶/底边暗像素 0/191，仅剩圆角弧），而同一页 div 与 input 的边框四边完整。
  // 故外框移到 div，select 只作透明交互层——用经证据证明可靠的元素来画框。
  assert.match(CLIENT_CSS, /\.cxp-select-box\{[^}]*border:\.5px solid var\(--dsw-alias-border-l4\)/)
  assert.match(CLIENT_CSS, /\.cxp-select-box\{[^}]*height:34px/)
  assert.match(CLIENT_CSS, /\.cxp-select\{[^}]*appearance:none/)
  assert.match(CLIENT_CSS, /\.cxp-select\{[^}]*border:0/)
  assert.match(CLIENT_CSS, /\.cxp-select\{[^}]*padding:0 32px 0 12px/)

  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const tree = await renderCard(card, globalThis.__REACT_STUB__)
    const selects = findAll(tree, (el) => el.type === 'select')
    assert.ok(selects.length >= 3, `应有三个下拉框，实际 ${selects.length}`)
    for (const select of selects) {
      assert.equal(select.props.className, 'cxp-select')
      assert.equal(select.props.style, undefined, '外观由样式表承担，不写内联样式')
    }
    const boxes = findAll(tree, (el) => el.props?.className === 'cxp-select-box')
    assert.ok(boxes.length >= 3, `每个下拉框都应有一个 div 外框，实际 ${boxes.length}`)
    assert.ok(findAll(tree, (el) => el.props?.className === 'cxp-chevron').length >= 3,
      '箭头画在外框上，不依赖 select 自身绘制')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('中性实线边框一律 0.5px，半径走 token，样式无字面颜色', async () => {
  // 中性描边应为 0.5px；1px 只允许出现在 save 的透明边框（官方 SettingsForm 同款）。
  assert.doesNotMatch(CLIENT_CSS, /border(?:-[a-z]+)?:1px solid (?!transparent)/,
    '中性描边应为 0.5px，不得使用 1px')
  assert.match(CLIENT_CSS, /\.cxp-field\{[^}]*gap:6px;[^}]*padding:12px 0/)
  assert.match(CLIENT_CSS, /\.cxp-input\{[^}]*height:34px/)
  assert.match(CLIENT_CSS, /\.cxp-save\{[^}]*padding:5px 14px/)
  assert.match(CLIENT_CSS, /\.cxp-footer\{[^}]*padding-top:16px/)
  assert.match(CLIENT_CSS, /border-radius:var\(--dsw-radius-md\)/)
  // 无字面颜色（#hex / rgb / hsl / 颜色名）；所有颜色必须来自 token。
  assert.doesNotMatch(CLIENT_CSS, /#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\(/)
  // 表单根不设宽度上限。
  assert.doesNotMatch(CLIENT_CSS, /\.cxp-form\{[^}]*max-width/)
})

test('隧道名输入框只在 cloudflare-named 下出现（条件字段）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__

    /** 取当前树里的全部文本框占位符，用于判定字段是否出现。 */
    const placeholders = (tree) => findAll(tree, (el) => el.type === 'input' && el.props?.type === 'text')
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
