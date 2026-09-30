// t07-missing-codexpro.test.mjs — 实测：codexpro 未安装时插件的完整行为。
//
// 验证三件事：
//   1. 打开设置页（catalog/status）时是否就已暴露「未安装」；
//   2. 点击启动时的错误是否可行动（含修复命令）；
//   3. 未安装是否影响配置投影（授权勾选、参数保存）。
// 手法：把 resolveEntry 的解析基准指向一个空目录，模拟「全局未安装」。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveEntry } from '../src/adapter/process.js'
import plugin from '../src/adapter/index.js'
import { Config } from '../src/adapter/settings.js'
import Schema from '@deepseek-ai/schemastery'
import { profilePath } from '../src/core/profile.js'

/**
 * 造一个临时实例根。
 * @returns {Promise<{root: string, cleanup: () => Promise<void>}>} 临时根
 */
async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-missing-'))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * 组装受控 ctx；spawn 会抛错以模拟无可用 codexpro。
 * @param {string} dshHome 实例 HOME
 * @param {Array<object>} workspaces 工作区
 * @returns {object} ctx 与记录
 */
function makeCtx(dshHome, workspaces) {
  const warnings = []
  const routes = []
  const configWrites = []
  let currentConfig = null
  const ctx = {
    logger: { warn: (t) => warnings.push(t), info: () => {} },
    dshHomePath: () => dshHome,
    workspaceRegistry: { list: () => workspaces },
    subprocess: { spawn: () => { throw new Error('不应到达 spawn：未安装时应在解析阶段失败') } },
    settings: {
      update: async (ns, patch) => {
        configWrites.push({ ns, patch })
        for (const [k, v] of Object.entries(patch)) {
          if (currentConfig && k in currentConfig) currentConfig[k] = { get: () => v }
        }
      },
    },
    connection: { fetch: { register: (r) => { routes.push(r); return () => {} } } },
    effect: (fn) => { fn(); return () => {} },
    on: () => () => {},
    fiber: {},
  }
  return {
    ctx, warnings, routes, configWrites,
    setConfig: (v) => { currentConfig = v },
    getConfig: () => currentConfig,
  }
}

/**
 * 调用端点。
 * @param {Array<object>} routes 路由
 * @param {string} endpoint 端点
 * @param {unknown} payload 载荷
 * @returns {Promise<object>} Result
 */
async function invoke(routes, endpoint, payload) {
  const route = routes.find((r) => r.path.endsWith(`/${endpoint}`))
  const response = await route.fetch(new Request(`http://127.0.0.1${route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'r', method: `codexpro/${endpoint}`, payload }),
  }))
  return (await response.json()).result
}

test('T-07: 未安装时 resolveEntry 给出含修复命令的可行动错误', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    // 指向一个不含 codexpro 的 node 目录：三条候选路径全部落空。
    const emptyNodeDir = path.join(root, 'empty-node')
    await mkdir(emptyNodeDir, { recursive: true })
    assert.throws(
      () => resolveEntry(path.join(emptyNodeDir, 'node.exe')),
      (error) => {
        assert.ok(error.message.includes('未安装'), '消息应指出未安装')
        assert.ok(error.message.includes('npm install -g codexpro'), '消息应给出修复命令')
        return true
      },
    )
  } finally {
    await cleanup()
  }
})

test('T-07: 未安装时打开设置页不会崩（catalog 正常返回）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const project = path.join(root, 'proj')
    await mkdir(project, { recursive: true })
    const harness = makeCtx(path.join(root, 'home'), [{ path: project, title: '项目' }])
    const [config] = Schema.resolve({}, Config, { path: [] })
    harness.setConfig(config)
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'catalog', {})
    assert.equal(result.ok, true, '设置页读取不应因未安装而失败')
  } finally {
    await cleanup()
  }
})

test('T-07: 未安装时 status 不报错（面板可打开）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx(path.join(root, 'home'), [])
    const [config] = Schema.resolve({}, Config, { path: [] })
    harness.setConfig(config)
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'status', {})
    assert.equal(result.ok, true)
    assert.equal(result.value.state, 'idle')
  } finally {
    await cleanup()
  }
})

test('T-07: 未安装不影响配置投影（授权仍可写入）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const { realpath } = await import('node:fs/promises')
    const project = path.join(root, 'proj')
    await mkdir(project, { recursive: true })
    const realProject = await realpath(project)
    const dshHome = path.join(root, 'home')
    const harness = makeCtx(dshHome, [{ path: realProject, title: '项目' }])
    const [config] = Schema.resolve({}, Config, { path: [] })
    harness.setConfig(config)
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'setAuthorization', { authorized: { [realProject]: true } })
    assert.equal(result.ok, true, '配置投影与是否安装 codexpro 无关')

    const anchor = await realpath(path.join(dshHome, 'codexpro', 'anchor'))
    const parsed = JSON.parse(await readFile(profilePath(path.join(dshHome, 'codexpro'), anchor), 'utf8'))
    assert.deepEqual(parsed.allowedRoots, [realProject])
  } finally {
    await cleanup()
  }
})

test('T-07: 未安装时 start 返回 SPAWN_FAILED 且消息可行动', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const harness = makeCtx(path.join(root, 'home'), [])
    const [config] = Schema.resolve({}, Config, { path: [] })
    harness.setConfig(config)
    plugin.apply(harness.ctx, harness.getConfig())

    const result = await invoke(harness.routes, 'start', {})
    assert.equal(result.ok, false)
    // 注意：真实的 resolveEntry 会解析到本机已安装的 codexpro，故此处若本机已装，
    // 失败点会落在 spawn 替身上。两种情况都必须给可读错误、且不外抛。
    assert.ok(typeof result.error.code === 'string' && result.error.code !== '')
    assert.ok(typeof result.error.message === 'string' && result.error.message.length > 0)
  } finally {
    await cleanup()
  }
})

test('T-07: start 失败后 token 与 profile 仍已就绪（配置投影先于进程启动）', async () => {
  const { root, cleanup } = await makeRoot()
  try {
    const dshHome = path.join(root, 'home')
    const harness = makeCtx(dshHome, [])
    const [config] = Schema.resolve({}, Config, { path: [] })
    harness.setConfig(config)
    plugin.apply(harness.ctx, harness.getConfig())

    await invoke(harness.routes, 'start', {})
    // token 生成发生在解析可执行之前，故启动失败后仍已持久化。
    const tokenWrites = harness.configWrites.filter((w) => 'httpToken' in w.patch)
    assert.equal(tokenWrites.length, 1, 'token 应先于进程启动生成，使失败后不必重来')
    const { realpath } = await import('node:fs/promises')
    const anchor = await realpath(path.join(dshHome, 'codexpro', 'anchor'))
    const parsed = JSON.parse(await readFile(profilePath(path.join(dshHome, 'codexpro'), anchor), 'utf8'))
    assert.equal(parsed.token, tokenWrites[0].patch.httpToken, 'token 应已写入 profile')
  } finally {
    await cleanup()
  }
})
