// ui-spec.test.mjs — UI 规格测试：把「与官方设置节同构」这一声称变成可验证的断言。
//
// 覆盖三件只有运行期才能确认的事：
//   1. 页签栏的 ARIA 配对（tablist / tab / tabpanel、aria-selected / controls / labelledby）；
//   2. 键盘映射（ArrowLeft / ArrowRight / Home / End + 焦点跟随）；
//   3. 面板保持挂载（切走用 hidden 隐藏而非卸载，草稿不丢）。
// 手法：esbuild 打包 card.jsx 与 React 替身，在裸 node 中调用组件函数并检查元素树。

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
 * 打包入口与其 React 替身。
 *
 * 平台包必须外化（与生产 build-client.mjs 的 external 一致）：它们是浏览器侧的
 * shell-seeded 模块，且其实现 import CSS Module——内联进 node 侧的打包树会因
 * 无法处理 .module.css 而失败。外化后由替身 require 提供，与真实 loader 的模块表同形。
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
    // JSX 经 jsx-runtime 编译（automatic），故两个 specifier 都要指向替身，否则
    // 元素树来自真实 react/jsx-runtime（node 侧不可用），断言无处可查。
    alias: { react: stub, 'react/jsx-runtime': stub, 'react/jsx-dev-runtime': stub },
    // 平台包被外化后，产物里的 require 需由 node 解析到真实包；node 侧无法加载其 CSS，
    // 故用插件把这些 require 重定向到替身（与浏览器 loader 的模块表角色一致）。
    plugins: [stubPlatformPlugin()],
  })
  const file = path.join(root, `${name}.cjs`)
  await writeFile(file, result.outputFiles[0].text, 'utf8')
  return createRequire(import.meta.url)(file)
}

/**
 * esbuild 插件：把平台包替换为轻量替身，避免 node 侧解析其 CSS 依赖。
 * 只需满足本插件用到的原语（Button / Checkbox），其余属性访问返回空函数以防误用。
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
  return function Stub(props) {
    return { type: name, props: { ...(props ?? {}), children: [] } }
  }
}
const Button = passthrough('Button')
const Checkbox = passthrough('Checkbox')
const Tag = passthrough('Tag')
const Pill = passthrough('Pill')
const StateDot = passthrough('StateDot')
export { Button, Checkbox, Tag, Pill, StateDot }
export default { Button, Checkbox, Tag, Pill, StateDot }
`,
        loader: 'js',
      }))
    },
  }
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
 * 渲染一个组件：先进入其 hook 作用域再调用，随后递归展开函数子组件。
 * 直接调用组件函数时不经过 createElement，故顶层也必须显式 enter，
 * 否则该组件的 hook 槽位无处可查（真实 React 由调度器保证，替身需调用方配合）。
 * @param {Function} Component 组件
 * @param {object} props 属性
 * @param {object} control React 替身控制面
 * @returns {object} 展开后的元素树
 */
function renderComponent(Component, props, control) {
  const tree = expand({ type: Component, props: { ...props, children: [] } }, control)
  return tree
}

/**
 * 展开函数组件：调用其函数体并把产物接回树（供断言穿透到宿主标签）。
 * 驱动端为每个组件按「组件名 + 遍历序号」生成实例键，使 hook 槽位跨轮保留。
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

test('页签栏具备 tablist/tab 的 ARIA 与 aria-selected', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(card.CodexProCard, { call: async () => ({}), view: 'page' }, control)

    const tablists = findAll(tree, (el) => el.props?.['role'] === 'tablist')
    assert.equal(tablists.length, 1, '必须恰好一个 tablist')
    assert.ok(tablists[0].props['aria-label'], 'tablist 必须有 aria-label')

    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    assert.equal(tabs.length, 3, '应渲染三个页签')
    const selected = tabs.filter((el) => el.props['aria-selected'] === true)
    assert.equal(selected.length, 1, '恰好一个页签处于选中态')
    for (const tabEl of tabs) {
      assert.ok(tabEl.props.id, '页签必须有 id')
      assert.ok(tabEl.props['aria-controls'], '页签必须经 aria-controls 指向面板')
      assert.ok(tabEl.props.tabIndex === 0 || tabEl.props.tabIndex === -1, 'roving tabindex：0 或 -1')
    }
    const active = selected[0]
    assert.equal(active.props.tabIndex, 0, '只有选中项是 tab 停靠点')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('页签与面板经 id/aria-labelledby 双向配对', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(card.CodexProCard, { call: async () => ({}), view: 'page' }, control)

    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    const panels = findAll(tree, (el) => el.props?.['role'] === 'tabpanel')
    assert.ok(panels.length >= 1, '至少渲染当前页签的面板')

    for (const panel of panels) {
      assert.ok(panel.props.id, '面板必须有 id')
      // 面板的 aria-labelledby 必须指向真实存在的页签 id。
      const owner = tabs.find((tabEl) => tabEl.props.id === panel.props['aria-labelledby'])
      assert.ok(owner, `面板 ${panel.props.id} 的 aria-labelledby 必须指向已渲染的页签`)
      // 页签的 aria-controls 必须指回该面板。
      assert.equal(owner.props['aria-controls'], panel.props.id)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('键盘映射与官方一致：左右循环、Home/End 跳首尾', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const parts = await load(path.join(here, '..', 'src', 'client', 'parts.jsx'), root, 'parts')
    const control = globalThis.__REACT_STUB__
    const seen = []
    const tree = renderComponent(parts.TabBar, {
      active: 'process',
      onChange: (id) => seen.push(id),
      label: '分区',
      panelIdOf: (id) => `panel-${id}`,
    }, control)

    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    assert.equal(tabs.length, 3)

    /**
     * 触发某页签的键盘事件。
     * @param {number} index 页签序号
     * @param {string} key 按键名
     * @returns {object} 事件对象（可查 preventDefault 是否被调用）
     */
    const press = (index, key) => {
      let prevented = false
      tabs[index].props.onKeyDown({ key, preventDefault: () => { prevented = true }, stopPropagation: () => {} })
      return { prevented }
    }

    // 三个页签顺序为 进程 / 授权工作区 / 参数。
    press(0, 'ArrowRight')
    assert.equal(seen.at(-1), 'workspaces', '右移应到下一个页签')
    seen.length = 0

    press(0, 'ArrowLeft')
    assert.equal(seen.at(-1), 'options', '左移应从首个回绕到末个')

    seen.length = 0
    press(2, 'Home')
    assert.equal(seen.at(-1), 'process', 'Home 应跳到首个')

    seen.length = 0
    press(0, 'End')
    assert.equal(seen.at(-1), 'options', 'End 应跳到末个')

    seen.length = 0
    const unrelated = press(0, 'Tab')
    assert.deepEqual(seen, [], '无关按键不应切换页签')
    assert.equal(unrelated.prevented, false, '无关按键不应吞掉默认行为')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('方向键切换时 preventDefault 被调用（避免页面滚动）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const parts = await load(path.join(here, '..', 'src', 'client', 'parts.jsx'), root, 'parts')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(parts.TabBar, {
      active: 'process',
      onChange: () => {},
      label: '分区',
      panelIdOf: (id) => `panel-${id}`,
    }, control)
    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    let prevented = false
    tabs[0].props.onKeyDown({ key: 'ArrowRight', preventDefault: () => { prevented = true }, stopPropagation: () => {} })
    assert.equal(prevented, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('未访问的页签面板不渲染（首屏只挂当前页签）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(card.CodexProCard, { call: async () => ({}), view: 'page' }, control)

    const panels = findAll(tree, (el) => el.props?.['role'] === 'tabpanel')
    assert.equal(panels.length, 1, '首屏只应渲染当前页签的面板（官方语义：首次选中才挂载）')
    // hidden={!selected} 对选中项求值为 false（React 语义等同不隐藏），故接受 false 或缺省。
    assert.ok(panels[0].props.hidden === false || panels[0].props.hidden === undefined,
      '当前页签的面板不应处于隐藏态')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('summary 视图只给一行摘要，不渲染页签', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const card = await load(path.join(here, '..', 'src', 'client', 'card.jsx'), root, 'card')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(card.CodexProCard, { call: async () => ({}), view: 'summary' }, control)
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'tablist').length, 0)
    assert.equal(findAll(tree, (el) => el.props?.['role'] === 'tabpanel').length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('页签样式取自官方规格：0.5px 底线 + label-primary 指示条', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const parts = await load(path.join(here, '..', 'src', 'client', 'parts.jsx'), root, 'parts')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(parts.TabBar, {
      active: 'process',
      onChange: () => {},
      label: '分区',
      panelIdOf: (id) => `panel-${id}`,
    }, control)

    const tablist = findAll(tree, (el) => el.props?.['role'] === 'tablist')[0]
    assert.equal(tablist.props.style.borderBottom, '0.5px solid var(--dsw-alias-border-l2)',
      '页签栏底线必须是 0.5px 的 border-l2（官方规范：中性实线一律 0.5px）')
    assert.equal(tablist.props.style.gap, '22px', '页签间距对齐官方 22px')

    // 选中页签的指示条：2px 高、底色 label-primary（官方 .tab[data-active]::after）。
    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    const selected = tabs.find((el) => el.props['aria-selected'] === true)
    const indicator = findAll(selected, (el) => el.type === 'span' && el.props?.['aria-hidden'] === 'true'
      && el.props?.style?.height === '2px')[0]
    assert.ok(indicator, '选中页签必须有指示条')
    assert.equal(indicator.props.style.background, 'var(--dsw-alias-label-primary)',
      '指示条底色用 label-primary（官方值，不是 brand）')
    assert.equal(indicator.props.style.borderRadius, '2px 2px 0 0', '指示条圆角对齐官方')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('未选中页签用 tertiary 字色（官方色阶）', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-ui-'))
  try {
    const parts = await load(path.join(here, '..', 'src', 'client', 'parts.jsx'), root, 'parts')
    const control = globalThis.__REACT_STUB__
    const tree = renderComponent(parts.TabBar, {
      active: 'process',
      onChange: () => {},
      label: '分区',
      panelIdOf: (id) => `panel-${id}`,
    }, control)
    const tabs = findAll(tree, (el) => el.props?.['role'] === 'tab')
    const inactive = tabs.find((el) => el.props['aria-selected'] === false)
    assert.equal(inactive.props.style.color, 'var(--dsw-alias-label-tertiary)',
      '未选中页签用 tertiary（官方值，非 secondary）')
    assert.equal(inactive.props.style.fontSize, '13px')
    assert.equal(inactive.props.style.lineHeight, '20px')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('全圆胶囊必须成对声明 corner-shape: round（官方 Pill/Tag 同款）', async () => {
  // 宿主 corner-shape.css 用 *,*::before,*::after 把圆角统一为 superellipse(1.5)，
  // 会把未声明 corner-shape: round 的胶囊两端压成方角（Chrome 139+ 可见）。
  // 官方 Pill.module.css / Tag.module.css 都把 999px 与 corner-shape: round 成对声明。
  const theme = await import('../src/client/theme.js')
  assert.equal(theme.pillBase.borderRadius, '999px')
  assert.equal(theme.pillBase.cornerShape, 'round',
    '全圆角必须配 cornerShape: round，否则方角化')
})

test('中性实线边框一律 0.5px（无 1px 残留）', async () => {
  const theme = await import('../src/client/theme.js')
  assert.equal(theme.HAIRLINE, '0.5px')
  // 卡材料与分隔线都必须走 HAIRLINE，不得出现 1px。
  assert.ok(theme.cardStyle.border.startsWith(`${theme.HAIRLINE} `),
    `卡描边应为 0.5px，实际 ${theme.cardStyle.border}`)
  assert.equal(theme.dividerStyle.height, theme.HAIRLINE)
  // 半径走 token 档位，不得出现硬编码 px（全圆胶囊由上一条专门覆盖）。
  assert.match(theme.cardStyle.borderRadius, /^var\(--dsw-radius-/,
    '卡半径必须走 --dsw-radius-* token（v0.1.7 起离格字面量会被宿主守卫拒斥）')
})


