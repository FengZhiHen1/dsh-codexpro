// adapter 单测：可执行解析、启动参数构造、版本比较与进程管理器接线。
// 证据面：DSR-004（以 node 执行 .mjs 入口，不用裸名）与 DSR-007（不传 --headless）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ProcessManager, buildArgs, compareVersions, probeVersion, resolveEntry } from '../src/adapter/process.js'
import { STATES } from '../src/core/state.js'

/**
 * 造一个临时根。
 * @returns {Promise<{root: string, cleanup: () => Promise<void>}>} 临时根
 */
async function makeTemp() {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-proc-'))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * 在给定目录下造一个假的 codexpro 包结构。
 * @param {string} nodeModules 放置 node_modules 的父目录
 * @param {object} [manifest] 包清单内容
 * @returns {Promise<string>} 入口文件的绝对路径
 */
async function makeFakePackage(nodeModules, manifest = { name: 'codexpro', bin: { codexpro: 'scripts/codexpro.mjs' } }) {
  const pkgDir = path.join(nodeModules, 'codexpro')
  await mkdir(path.join(pkgDir, 'scripts'), { recursive: true })
  await writeFile(path.join(pkgDir, 'package.json'), JSON.stringify(manifest), 'utf8')
  const entry = path.join(pkgDir, 'scripts', 'codexpro.mjs')
  await writeFile(entry, 'export {}\n', 'utf8')
  return entry
}

test('buildArgs 至少包含 start 与核心参数', () => {
  const args = buildArgs({
    anchorDir: 'E:\\anchor',
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
  })
  assert.equal(args[0], 'start')
  assert.ok(args.includes('--root'))
  assert.ok(args.includes('E:\\anchor'))
  assert.ok(args.includes('--port'))
  assert.ok(args.includes('8787'))
  assert.ok(args.includes('--mode'))
  assert.ok(args.includes('agent'))
})

test('buildArgs 绝不含 --headless 与 --token', () => {
  const args = buildArgs({
    anchorDir: 'E:\\anchor',
    port: '8787',
    tunnel: 'ngrok',
    hostname: 'x.ngrok-free.dev',
    bashMode: 'safe',
    writeMode: 'workspace',
  })
  // --headless 会绕开 stdin 控制通道（DSR-007）；--token 会出现在可被同机进程读取的命令行里。
  assert.ok(!args.includes('--headless'), '不得传入 --headless')
  assert.ok(!args.includes('--token'), '不得经命令行传 token')
  assert.ok(args.includes('--hostname'))
  assert.ok(args.includes('x.ngrok-free.dev'))
})

test('buildArgs 无 hostname 时不传该参数', () => {
  const args = buildArgs({
    anchorDir: 'E:\\anchor',
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
  })
  assert.ok(!args.includes('--hostname'))
})

test('resolveEntry 从 node 同级的 node_modules 解析入口', async () => {
  const { root, cleanup } = await makeTemp()
  try {
    const nodeDir = path.join(root, 'nodejs')
    await mkdir(nodeDir, { recursive: true })
    const entry = await makeFakePackage(path.join(nodeDir, 'node_modules'))
    // 模拟 process.execPath 位于 nodeDir 下。
    const resolved = resolveEntry(path.join(nodeDir, 'node.exe'))
    assert.equal(resolved, entry)
  } finally {
    await cleanup()
  }
})

test('resolveEntry 支持父级 lib/node_modules 布局（POSIX 风格全局安装）', async () => {
  const { root, cleanup } = await makeTemp()
  try {
    const nodeDir = path.join(root, 'bin')
    await mkdir(nodeDir, { recursive: true })
    const entry = await makeFakePackage(path.join(root, 'lib', 'node_modules'))
    const resolved = resolveEntry(path.join(nodeDir, 'node'))
    assert.equal(resolved, entry)
  } finally {
    await cleanup()
  }
})

test('resolveEntry 在找不到时抛错且消息可行动', async () => {
  const { root, cleanup } = await makeTemp()
  try {
    assert.throws(
      () => resolveEntry(path.join(root, 'nowhere', 'node.exe')),
      (error) => {
        assert.ok(error instanceof Error)
        assert.ok(error.message.includes('codexpro'), '消息应指明缺什么')
        assert.ok(error.message.includes('npm install -g codexpro'), '消息应给出修复动作')
        return true
      },
    )
  } finally {
    await cleanup()
  }
})

test('resolveEntry 忽略 bin 指向不存在文件的包', async () => {
  const { root, cleanup } = await makeTemp()
  try {
    const nodeDir = path.join(root, 'nodejs')
    const nodeModules = path.join(nodeDir, 'node_modules')
    await mkdir(nodeModules, { recursive: true })
    // bin 指向不存在的相对路径：不得被当作可用入口。
    await makeFakePackage(nodeModules, { name: 'codexpro', bin: { codexpro: 'scripts/missing.mjs' } })
    assert.throws(() => resolveEntry(path.join(nodeDir, 'node.exe')))
  } finally {
    await cleanup()
  }
})

test('compareVersions 比较主次修订号并忽略预发布标签', () => {
  assert.equal(compareVersions('0.30.2', '0.20.0'), 1)
  assert.equal(compareVersions('0.20.0', '0.30.2'), -1)
  assert.equal(compareVersions('0.30.2', '0.30.2'), 0)
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), 0)
  assert.equal(compareVersions('0.19.9', '0.20.0'), -1)
})

test('probeVersion 解析输出并判断支持下限', async () => {
  const ok = await probeVersion('entry.mjs', async () => '0.30.2\n')
  assert.equal(ok.version, '0.30.2')
  assert.equal(ok.supported, true)

  const old = await probeVersion('entry.mjs', async () => '0.1.0\n')
  assert.equal(old.supported, false)
})

test('probeVersion 在执行失败时返回空版本而非抛错', async () => {
  const result = await probeVersion('entry.mjs', async () => { throw new Error('boom') })
  assert.equal(result.version, '')
  assert.equal(result.supported, false)
  assert.equal(result.error, 'boom')
})

test('probeVersion 解析带前缀的输出（取最后一个词）', async () => {
  const result = await probeVersion('entry.mjs', async () => 'codexpro 0.31.0')
  assert.equal(result.version, '0.31.0')
})

test('ProcessManager 初始为 idle 且无句柄', () => {
  const manager = new ProcessManager({ subprocess: {}, logger: { warn: () => {} } })
  assert.equal(manager.state, STATES.idle)
  assert.equal(manager.handle, null)
  assert.deepEqual(manager.snapshot().state, STATES.idle)
})

test('ProcessManager 在 idle 下 stop 是幂等成功', async () => {
  const manager = new ProcessManager({ subprocess: {}, logger: { warn: () => {} } })
  const result = await manager.stop()
  assert.equal(result.ok, true)
  assert.equal(manager.state, STATES.idle)
})

test('ProcessManager 拒绝重复启动', async () => {
  const warnings = []
  const manager = new ProcessManager({ subprocess: {}, logger: { warn: (text) => warnings.push(text) } })
  manager.state = STATES.running
  const result = await manager.start({ entry: 'x', argv: [], cwd: '.', home: '.', port: 1, token: '' })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'ALREADY_RUNNING')
  assert.ok(warnings.length > 0, '被拒的转换应留下日志')
})

test('ProcessManager 在 spawn 抛错时落入 failed 并返回可读原因', async () => {
  const manager = new ProcessManager({
    subprocess: { spawn: () => { throw new Error('spawn boom') } },
    logger: { warn: () => {} },
  })
  const result = await manager.start({ entry: 'x', argv: [], cwd: '.', home: '.', port: 1, token: '' })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'SPAWN_FAILED')
  assert.ok(result.message.includes('spawn boom'))
  assert.equal(manager.state, STATES.failed)
})

/**
 * 构造一个最小可用的句柄替身。
 * @param {object} [options] 行为开关
 * @param {boolean} [options.healthy] 是否让进程立即表现为健康
 * @returns {object} 替身句柄
 */
function fakeHandle({ healthy = false } = {}) {
  let terminated = false
  const handle = {
    stdin: { write: () => {} },
    collected: {},
    done: healthy ? new Promise(() => {}) : Promise.resolve({ exitCode: 1, signal: null }),
    terminate: () => { terminated = true },
    waitForExit: async () => true,
    /** 测试读取终止标记。 */
    get terminated() { return terminated },
  }
  return handle
}

test('ProcessManager 就绪探测失败时终止进程并落入 failed', async () => {
  const handle = fakeHandle({ healthy: false })
  const manager = new ProcessManager({
    subprocess: { spawn: () => handle },
    logger: { warn: () => {} },
  })
  // 进程立即以退出码 1 结算 ⇒ 就绪等待应立即失败而不是等满超时。
  const started = Date.now()
  const result = await manager.start({ entry: 'x', argv: [], cwd: '.', home: '.', port: 1, token: '' })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'START_FAILED')
  assert.ok(Date.now() - started < 5000, '提前退出应立即判定，不等满就绪超时')
  assert.equal(manager.state, STATES.failed)
})

test('ProcessManager stop 在主路径失败后走兜底终止', async () => {
  const handle = fakeHandle({ healthy: false })
  const manager = new ProcessManager({
    subprocess: { spawn: () => handle },
    logger: { warn: () => {} },
  })
  manager.handle = handle
  manager.state = STATES.running
  manager.settled = true
  const result = await manager.stop()
  assert.equal(result.ok, true)
  assert.equal(manager.state, STATES.idle)
  assert.equal(manager.handle, null)
})

test('ProcessManager dispose 在无句柄时立即返回', async () => {
  const manager = new ProcessManager({ subprocess: {}, logger: { warn: () => {} } })
  await manager.dispose()
  assert.equal(manager.handle, null)
})
