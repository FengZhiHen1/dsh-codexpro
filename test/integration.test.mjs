// integration.test.mjs — 接线级集成冒烟：用受控 ctx 走通 apply → 路由注册 → dispatch → 写盘。
//
// 覆盖单测看不到的部分：插件入口装配、依赖注入面、端点经分发器到 profile 文件的完整链路。
// 不 boot DSH、不起真实进程：subprocess 用替身，故进程行为不在本测试范围（已由实测探针定型）。
// 证据面：AC-01（授权集正确写入 profile）、AC-02（取消授权后清空）、
//   以及「配置变更经配置变更事件立即投影到磁盘」这条链路。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import plugin from '../src/adapter/index.js'
import { Config } from '../src/adapter/settings.js'
import { profilePath } from '../src/core/profile.js'

/**
 * 造一个临时实例根。
 * @returns {Promise<{root: string, cleanup: () => Promise<void>}>} 临时根
 */
async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-int-'))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * 造一份可热更的配置：每个字段是 volatile 引用，指向一个可替换的盒子。
 *
 * 忠实性要点：真实 loader 提交 volatile 编辑时原地替换引用的快照
 * （packages/settings/settings/tests/live-config.ts 的 `entry.update({config})`），
 * 插件持有的是同一批引用对象。若测试改成整体替换配置对象，插件读到的仍是旧对象，
 * 会测出真实环境不存在的「配置变更不生效」。
 *
 * `Schema.resolve` 产出的 volatile 字段本身就是 `{get}` 引用，故这里只替换其内部值：
 * 先取出解析值，再为每个 volatile 字段装上可写盒子；非 volatile 字段（anchorDir）原样保留。
 * @param {object} [overrides] 初始覆盖项
 * @returns {{config: object, set: (next: object) => void}} 配置与写入面
 */
function mutableConfig(overrides = {}) {
  const [resolved] = Schema.resolve(overrides, Config, { path: [] })
  const boxes = new Map()
  const config = {}
  for (const [key, value] of Object.entries(resolved)) {
    // volatile 字段是引用对象：读它的当前值放进盒子，再用盒子驱动引用。
    const isRef = value !== null && typeof value === 'object' && typeof value.get === 'function'
    if (!isRef) {
      config[key] = value
      continue
    }
    const box = { value: value.get() }
    boxes.set(key, box)
    config[key] = { get: () => box.value }
  }
  /**
   * 直接覆盖若干字段（等价于设置服务接受的 patch）。
   * @param {object} partial 字段补丁
   * @returns {void}
   */
  const patch = (partial) => {
    for (const [key, value] of Object.entries(partial)) {
      const box = boxes.get(key)
      if (box !== undefined) box.value = value
    }
  }
  /**
   * 以一组覆盖项重算并写入；只写入显式给出的键（模拟 loader 的 patch 语义）。
   * @param {object} next 覆盖项
   * @returns {void}
   */
  const set = (next = {}) => {
    const [values] = Schema.resolve(next, Config, { path: [] })
    for (const key of Object.keys(next)) {
      const box = boxes.get(key)
      if (box === undefined) continue
      const raw = values[key]
      box.value = raw !== null && typeof raw === 'object' && typeof raw.get === 'function' ? raw.get() : raw
    }
  }
  return { config, patch, set }
}

/**
 * 组装一个受控 ctx：只实现插件声明的依赖面，其余不提供以暴露误用。
 * @param {object} options 装配参数
 * @param {string} options.dshHome 实例 HOME
 * @param {Array<{path: string, title: string}>} options.workspaces 工作区清单
 * @param {object} options.mutable mutableConfig 的产物（config 与 patch）
 * @returns {object} 受控 ctx 与内部记录
 */
function makeCtx({ dshHome, workspaces, mutable }) {
  const warnings = []
  const effects = []
  const routes = []
  const configWrites = []
  /** 事件名 → 监听器列表（供测试主动触发 instance-local 事件）。 */
  const listeners = new Map()

  const ctx = {
    logger: { warn: (text) => warnings.push(text), info: () => {} },
    dshHomePath: () => dshHome,
    workspaceRegistry: { list: () => workspaces },
    subprocess: {
      spawn: () => { throw new Error('集成测试不应真实 spawn（进程行为由实测覆盖）') },
    },
    settings: {
      update: async (ns, value) => {
        configWrites.push({ ns, patch: value })
        // 设置服务把 patch 提交进 volatile 引用（原地），插件下次现读即可见。
        mutable.patch(value)
      },
    },
    connection: {
      fetch: {
        register: (route) => { routes.push(route); return () => {} },
      },
    },
    // ctx.effect 的契约是「立即执行并登记清理」（cordis 语义）。
    effect: (fn) => {
      const disposer = fn()
      effects.push(disposer)
      return () => {}
    },
    on: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event).push(handler)
      return () => {}
    },
    fiber: {},
  }

  return {
    ctx,
    warnings,
    routes,
    effects,
    configWrites,
    /**
     * 触发某事件的全部监听器（模拟平台派发 instance-local 事件）。
     * @param {string} event 事件名
     * @returns {void}
     */
    emit: (event) => {
      for (const handler of listeners.get(event) ?? []) handler()
    },
  }
}

/**
 * 装配一个已 apply 的插件实例。
 * @param {object} options 装配参数
 * @param {string} options.dshHome 实例 HOME
 * @param {Array<object>} [options.workspaces] 工作区清单
 * @param {object} [options.overrides] 初始配置覆盖项
 * @returns {object} harness 与配置写入面
 */
function setup({ dshHome, workspaces = [], overrides = {} }) {
  const cfg = mutableConfig(overrides)
  const harness = makeCtx({ dshHome, workspaces, mutable: cfg })
  plugin.apply(harness.ctx, cfg.config)
  return { ...harness, cfg }
}

/** 等待配置变更监听器里的异步投影结算（它们由事件同步触发、异步写盘）。 */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 80))
}

/**
 * 以给定载荷调用某端点，返回其 Result。
 * @param {Array<object>} routes 已注册路由
 * @param {string} endpoint 端点名
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result 信封内容
 */
async function invoke(routes, endpoint, payload) {
  const route = routes.find((item) => item.path.endsWith(`/${endpoint}`))
  assert.ok(route, `端点 ${endpoint} 应已注册路由`)
  const request = new Request(`http://127.0.0.1${route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: 'test-1',
      method: `codexpro/${endpoint}`,
      payload,
    }),
  })
  const response = await route.fetch(request)
  const body = await response.json()
  return body.result
}

/**
 * 读回磁盘上的 profile。
 * @param {string} dshHome 实例 HOME
 * @returns {Promise<object>} 解析后的 profile
 */
async function readProfile(dshHome) {
  const home = path.join(dshHome, 'codexpro')
  const anchor = await realpath(path.join(dshHome, 'codexpro', 'anchor'))
  return JSON.parse(await readFile(profilePath(home, anchor), 'utf8'))
}

/**
 * 造一个真实存在的目录并返回其 realpath（DSH 的工作区路径契约是已归一）。
 * @param {string} target 目标路径
 * @returns {Promise<string>} realpath
 */
async function makeDir(target) {
  await mkdir(target, { recursive: true })
  return realpath(target)
}

test('apply 注册四条进程端点路由且不抛', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({ dshHome: path.join(root, 'home') })
    assert.equal(routes.length, 4, '每个端点一条精确路由')
    assert.deepEqual(routes.map((route) => route.path).sort(), [
      '/api/codexpro/catalog',
      '/api/codexpro/start',
      '/api/codexpro/status',
      '/api/codexpro/stop',
    ])
    assert.ok(routes.every((route) => route.methods.includes('POST')))
    assert.ok(routes.every((route) => route.requestBody === 'buffered'))
  } finally {
    await cleanup()
  }
})

test('apply 挂载配置变更监听，且挂载期不写盘', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { configWrites, effects, routes } = setup({ dshHome: path.join(root, 'home') })
    // 挂载期不写：profile 由 start 或配置变更触发，避免无谓 IO 与半成品文件。
    assert.equal(configWrites.length, 0, '挂载期不得写配置')
    // 一处进程清理 effect + 每条端点路由一处（随行卸载摘除路由）。
    assert.equal(effects.length, 1 + routes.length)
  } finally {
    await cleanup()
  }
})

test('catalog 返回工作区清单、存在性与当前参数', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const projectDir = await makeDir(path.join(root, 'proj-a'))
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: projectDir, title: '项目 A' }],
    })
    const result = await invoke(routes, 'catalog', {})
    assert.equal(result.ok, true)
    assert.equal(result.value.workspaces.length, 1)
    assert.equal(result.value.workspaces[0].title, '项目 A')
    assert.equal(result.value.workspaces[0].authorized, false)
    assert.equal(result.value.workspaces[0].exists, true, '存在的目录应被标记可用')
    assert.equal(result.value.port, '8787')
    assert.equal(result.value.tunnelMode, 'none')
    assert.ok(result.value.anchorDir.includes('codexpro'))
  } finally {
    await cleanup()
  }
})

test('catalog 把不存在的目录标记为不可用', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: path.join(root, 'gone'), title: '已消失' }],
    })
    const result = await invoke(routes, 'catalog', {})
    assert.equal(result.value.workspaces[0].exists, false)
  } finally {
    await cleanup()
  }
})

test('catalog 的授权态取自配置（授权意图的唯一来源）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const projectDir = await makeDir(path.join(root, 'proj-a'))
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: projectDir, title: 'A' }],
      overrides: { authorized: { [projectDir]: true } },
    })
    const result = await invoke(routes, 'catalog', {})
    assert.equal(result.value.workspaces[0].authorized, true, '授权态应来自配置')
  } finally {
    await cleanup()
  }
})

test('C-03：配置里注册表外的路径不算授权', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const known = await makeDir(path.join(root, 'known'))
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: known, title: '已知' }],
      // 配置被手工塞入注册表外的路径：投影只遍历候选集，故它不会进授权根。
      overrides: { authorized: { [known]: true, 'E:\\evil-not-in-registry': true } },
    })
    const result = await invoke(routes, 'catalog', {})
    assert.equal(result.value.workspaces.length, 1)
    assert.ok(!result.value.workspaces.some((item) => item.path.includes('evil')), '注册表外的路径不得出现在候选集')
  } finally {
    await cleanup()
  }
})

test('AC-01：start 把配置里的授权集写入 profile 的 allowedRoots', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const projectA = await makeDir(path.join(root, 'proj-a'))
    const projectB = await makeDir(path.join(root, 'proj-b'))
    const { routes } = setup({
      dshHome,
      workspaces: [{ path: projectA, title: 'A' }, { path: projectB, title: 'B' }],
      overrides: { authorized: { [projectA]: true } },
    })

    // spawn 替身会抛错，但 profile 写入发生在 spawn 之前——这正是要验证的顺序：
    // 配置投影先就绪，故一次失败的启动不会留下「未投影」的半成品。
    await invoke(routes, 'start', {})

    const parsed = await readProfile(dshHome)
    assert.deepEqual(parsed.allowedRoots, [projectA], '只应包含被授权的目录')
    assert.equal(parsed.mode, 'agent')
    assert.equal(parsed.tunnel, 'none')
  } finally {
    await cleanup()
  }
})

test('AC-02：取消全部授权后 profile 的 allowedRoots 被清空', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const projectA = await makeDir(path.join(root, 'proj-a'))
    const { routes, emit, cfg } = setup({
      dshHome,
      workspaces: [{ path: projectA, title: 'A' }],
      overrides: { authorized: { [projectA]: true } },
    })
    await invoke(routes, 'start', {})
    assert.deepEqual((await readProfile(dshHome)).allowedRoots, [projectA])

    // 模拟用户在设置页取消勾选后保存：配置被改写，平台派发 volatile-update。
    cfg.set({ authorized: {} })
    emit('loader/volatile-update')
    await settle()

    const parsed = await readProfile(dshHome)
    assert.ok(!('allowedRoots' in parsed), '空授权集不写入该键')
  } finally {
    await cleanup()
  }
})

test('配置变更经配置变更事件立即投影到磁盘（无需重启）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const projectA = await makeDir(path.join(root, 'proj-a'))
    const { routes, emit, cfg } = setup({
      dshHome,
      workspaces: [{ path: projectA, title: 'A' }],
      overrides: { port: '8787' },
    })

    // 先由 start 建立一次投影。
    await invoke(routes, 'start', {})
    assert.equal((await readProfile(dshHome)).port, '8787')

    // 用户在设置页改端口并保存 → 平台派发 volatile-update。
    cfg.set({ port: '9100' })
    emit('loader/volatile-update')
    await settle()

    const parsed = await readProfile(dshHome)
    assert.equal(parsed.port, '9100', '端口变更应立即落到磁盘')
    assert.ok(parsed.token, 'token 不应因参数变更而丢失')
  } finally {
    await cleanup()
  }
})

test('配置变更投影时剔除不存在的授权根且不抛出', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const gone = path.join(root, 'gone')
    const { emit, cfg } = setup({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: gone, title: '已消失' }],
    })
    cfg.set({ authorized: { [gone]: true } })
    assert.doesNotThrow(() => emit('loader/volatile-update'))
    await settle()
    // 不存在的授权根必须被剔除：codexpro 对它直接拒绝启动。
    const parsed = await readProfile(path.join(root, 'home'))
    assert.ok(!('allowedRoots' in parsed), '不存在的授权根不得写入')
  } finally {
    await cleanup()
  }
})

test('status 在未运行时给出 idle 与可读状态', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({ dshHome: path.join(root, 'home') })
    const result = await invoke(routes, 'status', {})
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'idle')
    assert.equal(result.value.port, '8787')
    assert.equal(result.value.url, '', '未生成 token 时不给出 URL')
  } finally {
    await cleanup()
  }
})

test('status 呈现 token 与拼好的 Server URL', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      overrides: { httpToken: 'abc123', tunnelMode: 'none' },
    })
    const result = await invoke(routes, 'status', {})
    assert.equal(result.value.token, 'abc123')
    assert.equal(result.value.url, 'http://127.0.0.1:8787/mcp?codexpro_token=abc123')
  } finally {
    await cleanup()
  }
})

test('具名 tunnel 下 URL 使用公网 hostname', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({
      dshHome: path.join(root, 'home'),
      overrides: { httpToken: 'abc123', tunnelMode: 'ngrok', tunnelHostname: 'demo.ngrok-free.dev' },
    })
    const result = await invoke(routes, 'status', {})
    assert.equal(result.value.url, 'https://demo.ngrok-free.dev/mcp?codexpro_token=abc123')
  } finally {
    await cleanup()
  }
})

test('ensureToken 只在 token 为空时生成并持久化', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes, configWrites } = setup({
      dshHome: path.join(root, 'home'),
      overrides: { httpToken: 'pre-existing-token' },
    })
    await invoke(routes, 'start', {})
    assert.deepEqual(configWrites.filter((write) => 'httpToken' in write.patch), [],
      'token 已存在时不得重新生成（否则连接器会失效）')
  } finally {
    await cleanup()
  }
})

test('start 在无 token 时先生成 token 再尝试启动', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes, configWrites } = setup({ dshHome: path.join(root, 'home') })
    const result = await invoke(routes, 'start', {})
    // spawn 替身抛错 ⇒ 启动失败；但 token 应已生成并持久化。
    assert.equal(result.ok, false)
    const tokenWrites = configWrites.filter((write) => 'httpToken' in write.patch)
    assert.equal(tokenWrites.length, 1, '应在启动前生成 token')
    assert.equal(tokenWrites[0].ns, 'codexpro')
    assert.match(tokenWrites[0].patch.httpToken, /^[0-9a-f]{48}$/, 'token 应为 24 字节十六进制')
  } finally {
    await cleanup()
  }
})

test('start 失败后 token 与 profile 仍已就绪（配置投影先于进程启动）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const { routes, configWrites } = setup({ dshHome })
    await invoke(routes, 'start', {})
    const tokenWrites = configWrites.filter((write) => 'httpToken' in write.patch)
    assert.equal(tokenWrites.length, 1)
    const parsed = await readProfile(dshHome)
    assert.equal(parsed.token, tokenWrites[0].patch.httpToken, 'token 应已写入 profile')
  } finally {
    await cleanup()
  }
})

test('RPC 路由处理非 POST 与非 JSON 请求时按契约拒绝', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({ dshHome: path.join(root, 'home') })
    const route = routes.find((item) => item.path.endsWith('/status'))

    const getResponse = await route.fetch(new Request(`http://127.0.0.1${route.path}`, { method: 'GET' }))
    assert.equal(getResponse.status, 404, '非 POST 一律 404')

    const plainResponse = await route.fetch(new Request(`http://127.0.0.1${route.path}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x',
    }))
    assert.equal(plainResponse.status, 415, '非 JSON content-type 一律 415')

    const badJsonResponse = await route.fetch(new Request(`http://127.0.0.1${route.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    }))
    assert.equal(badJsonResponse.status, 400, '非法 JSON 一律 400')
  } finally {
    await cleanup()
  }
})

test('端点名与路径不一致时拒绝（400）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({ dshHome: path.join(root, 'home') })
    const route = routes.find((item) => item.path.endsWith('/status'))
    const response = await route.fetch(new Request(`http://127.0.0.1${route.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'r', method: 'codexpro/catalog', payload: {} }),
    }))
    assert.equal(response.status, 400)
  } finally {
    await cleanup()
  }
})

test('已下线的端点不再有路由（配置已改走官方 configForms）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { routes } = setup({ dshHome: path.join(root, 'home') })
    assert.equal(routes.find((route) => route.path.endsWith('/configure')), undefined)
    assert.equal(routes.find((route) => route.path.endsWith('/setAuthorization')), undefined)
  } finally {
    await cleanup()
  }
})

test('配置校验失败使行挂载失败（响亮而非静默）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const cfg = mutableConfig({ port: 'abc' })
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [], mutable: cfg })
    assert.throws(() => plugin.apply(harness.ctx, cfg.config), /port/)
  } finally {
    await cleanup()
  }
})

test('非 web 载体（无 connection.fetch）安静降级：不注册、不抛', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const cfg = mutableConfig()
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [], mutable: cfg })
    harness.ctx.connection = {}
    assert.doesNotThrow(() => plugin.apply(harness.ctx, cfg.config))
    assert.equal(harness.routes.length, 0)
    assert.ok(harness.warnings.some((text) => text.includes('fetch')), '降级应留下告警')
  } finally {
    await cleanup()
  }
})

test('dispose 经 ctx.effect 注册清理（卸载时回收进程与路由）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { effects, routes } = setup({ dshHome: path.join(root, 'home') })
    assert.equal(effects.length, 1 + routes.length, '每处注册都应经 ctx.effect 登记清理')
    for (const disposer of effects) {
      assert.equal(typeof disposer, 'function')
      const result = disposer()
      if (result instanceof Promise) await result
    }
  } finally {
    await cleanup()
  }
})
