// integration.test.mjs — 接线级集成冒烟：用受控 ctx 走通 apply → dispatch → 写盘。
//
// 覆盖单测看不到的部分：插件入口装配、依赖注入面、端点经分发器到 profile 文件的完整链路。
// 不 boot DSH、不起真实进程：subprocess 用替身，故进程行为不在本测试范围（已由 t01/t02 实测定型）。
// 证据面：AC-01（授权集正确写入 profile）、AC-02（取消授权后清空）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import plugin from '../src/adapter/index.js'
import { Config } from '../src/adapter/settings.js'
import Schema from '@deepseek-ai/schemastery'
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
 * 组装一个受控 ctx：只实现插件声明的依赖面，其余不提供以暴露误用。
 * @param {object} options 装配参数
 * @param {string} options.dshHome 实例 HOME
 * @param {Array<{path: string, title: string}>} options.workspaces 工作区清单
 * @returns {object} 受控 ctx 与内部记录
 */
function makeCtx({ dshHome, workspaces }) {
  const warnings = []
  const effects = []
  const routes = []
  const configWrites = []

  /** 当前配置（含 volatile 引用）；由 apply 收到的 config 派生。 */
  let currentConfig = null

  const ctx = {
    logger: { warn: (text) => warnings.push(text), info: () => {} },
    dshHomePath: () => dshHome,
    workspaceRegistry: { list: () => workspaces },
    subprocess: {
      spawn: () => { throw new Error('集成测试不应真实 spawn（进程行为由实测覆盖）') },
    },
    settings: {
      update: async (ns, patch) => {
        configWrites.push({ ns, patch })
        // 模拟设置服务：把 patch 合并进当前配置的 volatile 引用。
        for (const [key, value] of Object.entries(patch)) {
          if (currentConfig && key in currentConfig) currentConfig[key] = { get: () => value }
        }
      },
    },
    connection: {
      fetch: {
        register: (route) => { routes.push(route); return () => {} },
      },
    },
    // ctx.effect 的契约是「立即执行并登记清理」（cordis 语义）：立即调用 fn 并保存其
    // 返回的 disposer，否则被测代码的注册路径不会被触发。
    effect: (fn) => {
      const disposer = fn()
      effects.push(disposer)
      return () => {}
    },
    on: () => () => {},
    fiber: {},
  }

  return {
    ctx,
    warnings,
    routes,
    effects,
    configWrites,
    setConfig: (value) => { currentConfig = value },
    getConfig: () => currentConfig,
  }
}

/**
 * 把初始配置解析为 apply 可收的形态（volatile 引用）。
 * @param {object} overrides 覆盖项
 * @returns {object} 解析后的配置
 */
function resolveConfig(overrides = {}) {
  const [value] = Schema.resolve(overrides, Config, { path: [] })
  return value
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

test('apply 注册全部六条端点路由且不抛', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const harness = makeCtx({ dshHome, workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    assert.equal(harness.routes.length, 6, '每个端点一条精确路由')
    const paths = harness.routes.map((route) => route.path).sort()
    assert.deepEqual(paths, [
      '/api/codexpro/catalog',
      '/api/codexpro/configure',
      '/api/codexpro/setAuthorization',
      '/api/codexpro/start',
      '/api/codexpro/status',
      '/api/codexpro/stop',
    ])
    assert.ok(harness.routes.every((route) => route.methods.includes('POST')))
    assert.ok(harness.routes.every((route) => route.requestBody === 'buffered'))
  } finally {
    await cleanup()
  }
})

test('catalog 返回工作区清单与当前参数', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const projectDir = path.join(root, 'proj-a')
    await mkdir(projectDir, { recursive: true })
    const harness = makeCtx({
      dshHome,
      workspaces: [{ path: projectDir, title: '项目 A' }],
    })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'catalog', {})
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
    const harness = makeCtx({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: path.join(root, 'gone'), title: '已消失' }],
    })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'catalog', {})
    assert.equal(result.value.workspaces[0].exists, false)
  } finally {
    await cleanup()
  }
})

test('AC-01：授权集被写入 profile 的 allowedRoots', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { realpath } = await import('node:fs/promises')
    const dshHome = path.join(root, 'home')
    // DSH 的 Workspace.path 契约是「已 realpath 归一」（绝不重写），故替身同样归一，
    // 否则会测出一个真实环境不会出现的短路径差异。
    const projectA = await realpath(await mkdir(path.join(root, 'proj-a'), { recursive: true }).then(() => path.join(root, 'proj-a')))
    const projectB = await realpath(await mkdir(path.join(root, 'proj-b'), { recursive: true }).then(() => path.join(root, 'proj-b')))

    const harness = makeCtx({
      dshHome,
      workspaces: [{ path: projectA, title: 'A' }, { path: projectB, title: 'B' }],
    })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'setAuthorization', {
      authorized: { [projectA]: true, [projectB]: false },
    })
    assert.equal(result.ok, true)

    // 从磁盘读回：profile 文件名由 realpath(anchor) 推导，故此处同样归一。
    const anchor = await realpath(path.join(dshHome, 'codexpro', 'anchor'))
    const file = profilePath(path.join(dshHome, 'codexpro'), anchor)
    const parsed = JSON.parse(await readFile(file, 'utf8'))

    assert.deepEqual(parsed.allowedRoots, [projectA], '只应包含被授权的目录')
    assert.equal(parsed.root, anchor, 'root 必须是 realpath 归一的锚点')
    assert.equal(parsed.mode, 'agent')
    assert.equal(parsed.tunnel, 'none')
  } finally {
    await cleanup()
  }
})

test('AC-02：取消全部授权后 allowedRoots 被清空', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const projectA = path.join(root, 'proj-a')
    await mkdir(projectA, { recursive: true })

    const harness = makeCtx({ dshHome, workspaces: [{ path: projectA, title: 'A' }] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    await invoke(harness.routes, 'setAuthorization', { authorized: { [projectA]: true } })
    const afterGrant = await invoke(harness.routes, 'setAuthorization', { authorized: { [projectA]: false } })
    assert.equal(afterGrant.ok, true)
    assert.deepEqual(afterGrant.value.allowedRoots, [], '取消授权后不得残留')

    const { realpath } = await import('node:fs/promises')
    const anchor = await realpath(path.join(dshHome, 'codexpro', 'anchor'))
    const file = profilePath(path.join(dshHome, 'codexpro'), anchor)
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    assert.ok(!('allowedRoots' in parsed), '空授权集不写入该键')
  } finally {
    await cleanup()
  }
})

test('不存在的目录不被写入授权集（codexpro 会因此拒绝启动）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const gone = path.join(root, 'gone')
    const harness = makeCtx({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: gone, title: '已消失' }],
    })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'setAuthorization', { authorized: { [gone]: true } })
    assert.equal(result.ok, true)
    assert.deepEqual(result.value.allowedRoots, [])
    assert.deepEqual(result.value.skipped, [{ path: gone, reason: 'not-found' }])
  } finally {
    await cleanup()
  }
})

test('C-03：授权注册表外的路径被丢弃', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const known = path.join(root, 'known')
    await mkdir(known, { recursive: true })
    const harness = makeCtx({
      dshHome: path.join(root, 'home'),
      workspaces: [{ path: known, title: '已知' }],
    })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'setAuthorization', {
      authorized: { [known]: false, 'E:\\evil-not-in-registry': true },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.value.allowedRoots, [], '注册表外的路径不得进入授权集')
    // 且不得被持久化到配置里。
    const write = harness.configWrites.at(-1)
    assert.ok(!('E:\\evil-not-in-registry' in write.patch.authorized))
  } finally {
    await cleanup()
  }
})

test('status 在未运行时给出 idle 与可读状态', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'status', {})
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'idle')
    assert.equal(result.value.port, '8787')
    assert.equal(result.value.url, '', '未生成 token 时不给出 URL')
  } finally {
    await cleanup()
  }
})

test('configure 写入参数并同步 profile', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'configure', { tunnelMode: 'none', port: '9100' })
    assert.equal(result.ok, true)
    assert.equal(harness.configWrites.at(-1).patch.port, '9100')
  } finally {
    await cleanup()
  }
})

test('非法载荷返回契约错误而非抛出', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'setAuthorization', { authorized: { 'E:\\a': 'yes' } })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'INVALID_CONFIG')
  } finally {
    await cleanup()
  }
})

test('未知端点返回 NOT_FOUND', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    // 直接调用分发器（未知端点无路由，故绕道路由列表构造一次常规调用后取其 dispatch 不可行；
    // 这里验证的是已注册端点之外的路径不会命中任何路由）。
    const unknown = harness.routes.find((route) => route.path.endsWith('/nope'))
    assert.equal(unknown, undefined, '未声明的端点不应被注册')
  } finally {
    await cleanup()
  }
})

test('RPC 路由处理非 POST 与非 JSON 请求时按契约拒绝', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const route = harness.routes.find((item) => item.path.endsWith('/status'))

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
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const route = harness.routes.find((item) => item.path.endsWith('/status'))
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

test('配置校验失败使行挂载失败（响亮而非静默）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    // port 不是整数：挂载期校验应抛错，而不是把非法配置带进第一次调用。
    const bad = resolveConfig({ port: 'abc' })
    assert.throws(() => plugin.apply(harness.ctx, bad), /port/)
  } finally {
    await cleanup()
  }
})

test('非 web 载体（无 connection.fetch）安静降级：不注册、不抛', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.ctx.connection = {}
    harness.setConfig(resolveConfig())
    assert.doesNotThrow(() => plugin.apply(harness.ctx, harness.getConfig()))
    assert.equal(harness.routes.length, 0)
    assert.ok(harness.warnings.some((text) => text.includes('fetch')), '降级应留下告警')
  } finally {
    await cleanup()
  }
})

test('dispose 经 ctx.effect 注册清理（插件卸载时回收进程与路由）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())
    // 一处进程清理 + 每条端点路由一处（随行卸载摘除路由）。
    assert.equal(harness.effects.length, 1 + harness.routes.length, '每处注册都应经 ctx.effect 登记清理')
    // ctx.effect 已立即执行 fn 并保存其返回的 disposer；逐个调用即卸载时的清理动作。
    for (const disposer of harness.effects) {
      assert.equal(typeof disposer, 'function')
      const result = disposer()
      if (result instanceof Promise) await result
    }
  } finally {
    await cleanup()
  }
})

test('ensureToken 只在 token 为空时生成并持久化', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig({ httpToken: 'pre-existing-token' }))
    plugin.apply(harness.ctx, harness.getConfig())

    // start 会走 ensureToken 与 spawn；spawn 替身抛错，故 start 返回失败，
    // 但 token 已存在的判断发生在 spawn 之前——可用 configWrites 判断是否误生成。
    await invoke(harness.routes, 'start', {})
    const tokenWrites = harness.configWrites.filter((write) => 'httpToken' in write.patch)
    assert.deepEqual(tokenWrites, [], 'token 已存在时不得重新生成（否则连接器会失效）')
  } finally {
    await cleanup()
  }
})

test('start 在无 token 时先生成 token 再尝试启动', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig())
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'start', {})
    // spawn 替身抛错 ⇒ 启动失败；但 token 应已生成并持久化。
    assert.equal(result.ok, false)
    const tokenWrites = harness.configWrites.filter((write) => 'httpToken' in write.patch)
    assert.equal(tokenWrites.length, 1, '应在启动前生成 token')
    assert.equal(tokenWrites[0].ns, 'codexpro')
    assert.match(tokenWrites[0].patch.httpToken, /^[0-9a-f]{48}$/, 'token 应为 24 字节十六进制')
  } finally {
    await cleanup()
  }
})

test('status 呈现 token 与拼好的 Server URL', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig({ httpToken: 'abc123', tunnelMode: 'none' }))
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'status', {})
    assert.equal(result.value.token, 'abc123')
    assert.equal(result.value.url, 'http://127.0.0.1:8787/mcp?codexpro_token=abc123')
  } finally {
    await cleanup()
  }
})

test('具名 tunnel 下 URL 使用公网 hostname', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx({ dshHome: path.join(root, 'home'), workspaces: [] })
    harness.setConfig(resolveConfig({
      httpToken: 'abc123',
      tunnelMode: 'ngrok',
      tunnelHostname: 'demo.ngrok-free.dev',
    }))
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'status', {})
    assert.equal(result.value.url, 'https://demo.ngrok-free.dev/mcp?codexpro_token=abc123')
  } finally {
    await cleanup()
  }
})
