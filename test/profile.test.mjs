// core 单测：身份推导、payload 构造、幂等判定。不 boot DSH，纯函数级。
// 证据面：profile 文件名必须与 codexpro 自算一致——这是承重一致性，写错则配置进无人读的文件。

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash } from 'node:crypto'
import {
  buildProfile,
  normalizeAllowedRoots,
  profileEquivalent,
  profileId,
  profilePath,
  serializeProfile,
} from '../src/core/profile.js'

test('profileId 取 sha256 前 24 位十六进制', () => {
  const root = 'E:\\Project\\example'
  const expected = createHash('sha256').update(root).digest('hex').slice(0, 24)
  assert.equal(profileId(root), expected)
  assert.equal(profileId(root).length, 24)
})

test('profilePath 落在 profiles 子目录下且以 .json 结尾', () => {
  const home = path.join('C:', 'tmp', 'codexpro')
  const root = 'E:\\Project\\example'
  const result = profilePath(home, root)
  assert.equal(result, path.join(home, 'profiles', `${profileId(root)}.json`))
})

test('normalizeAllowedRoots 去重并排序，保证同输入同字节输出', () => {
  const input = ['E:\\b', 'E:\\a', 'E:\\b']
  assert.deepEqual(normalizeAllowedRoots(input), ['E:\\a', 'E:\\b'])
  // 顺序不同的等价输入必须得到同一结果，否则幂等判定会误报变化。
  assert.deepEqual(normalizeAllowedRoots(['E:\\b', 'E:\\a']), normalizeAllowedRoots(['E:\\a', 'E:\\b']))
})

test('buildProfile 与默认一致的字段不写入', () => {
  const payload = buildProfile({
    realAnchor: 'E:\\anchor',
    allowedRoots: [],
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  })
  assert.equal(payload.mode, 'agent')
  assert.equal(payload.tunnel, 'none')
  assert.ok(!('bash' in payload), 'bash 等于默认值时不写入')
  assert.ok(!('write' in payload), 'write 等于默认值时不写入')
  assert.ok(!('token' in payload), 'token 为空时不写入')
  assert.ok(!('allowedRoots' in payload), '授权为空时不写入该键')
})

test('buildProfile 只在 cloudflare-named 下写入隧道名', () => {
  const common = {
    realAnchor: 'E:\\anchor',
    allowedRoots: [],
    port: '8787',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  }
  // 与 codexpro 同规则（dist/http.js:313）：隧道名只在具名 tunnel 下有意义。
  const named = buildProfile({
    ...common, tunnel: 'cloudflare-named', hostname: 'x.example.com', tunnelName: 'codexpro',
  })
  assert.equal(named.tunnelName, 'codexpro')

  // 切到其他 tunnel 时陈旧名必须被丢弃，否则 codexpro 读到的 profile 里会留下无效键。
  for (const tunnel of ['none', 'cloudflare', 'ngrok', 'tailscale']) {
    const hostname = tunnel === 'none' || tunnel === 'cloudflare' ? '' : 'x.example.com'
    const payload = buildProfile({ ...common, tunnel, hostname, tunnelName: 'stale' })
    assert.ok(!('tunnelName' in payload), `tunnel=${tunnel} 时不应写入隧道名`)
  }

  // 具名 tunnel 但名为空：不写入该键（由 Host 校验在挂载期拦住，见 settings.test.mjs）。
  const empty = buildProfile({ ...common, tunnel: 'cloudflare-named', hostname: 'x.example.com', tunnelName: '' })
  assert.ok(!('tunnelName' in empty))
})

test('buildProfile 写入非默认字段与授权列表', () => {
  const payload = buildProfile({
    realAnchor: 'E:\\anchor',
    allowedRoots: ['E:\\b', 'E:\\a'],
    port: '9000',
    tunnel: 'ngrok',
    hostname: 'example.ngrok-free.dev',
    bashMode: 'full',
    writeMode: 'off',
    token: 'secret-token',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  })
  assert.equal(payload.port, '9000')
  assert.equal(payload.hostname, 'example.ngrok-free.dev')
  assert.equal(payload.bash, 'full')
  assert.equal(payload.write, 'off')
  assert.equal(payload.token, 'secret-token')
  assert.deepEqual(payload.allowedRoots, ['E:\\a', 'E:\\b'])
})

test('buildProfile 不含 hostname 时不写入该键', () => {
  const payload = buildProfile({
    realAnchor: 'E:\\anchor',
    allowedRoots: [],
    port: '8787',
    tunnel: 'none',
    hostname: '',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  })
  assert.ok(!('hostname' in payload))
})

test('profileEquivalent 忽略 updatedAt 的值', () => {
  const base = {
    realAnchor: 'E:\\anchor',
    allowedRoots: ['E:\\a'],
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: 't',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  }
  const first = serializeProfile(buildProfile(base))
  const second = serializeProfile(buildProfile({ ...base, updatedAt: '2026-06-06T06:06:06.000Z' }))
  assert.ok(profileEquivalent(first, second), '仅 updatedAt 不同应视为等价，从而跳过写盘')
})

test('profileEquivalent 在内容变化时判为不等价', () => {
  const base = {
    realAnchor: 'E:\\anchor',
    allowedRoots: ['E:\\a'],
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: 't',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  }
  const first = serializeProfile(buildProfile(base))
  const changed = serializeProfile(buildProfile({ ...base, allowedRoots: ['E:\\a', 'E:\\b'] }))
  assert.ok(!profileEquivalent(first, changed))
})

test('profileEquivalent 对空文本返回 false（触发首次写入）', () => {
  const payload = serializeProfile(buildProfile({
    realAnchor: 'E:\\anchor',
    allowedRoots: [],
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
    token: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  }))
  assert.equal(profileEquivalent('', payload), false)
})

test('serializeProfile 以换行结尾且缩进两空格', () => {
  const text = serializeProfile({ version: 1, root: 'E:\\a' })
  assert.ok(text.endsWith('\n'))
  assert.ok(text.includes('\n  "root"'))
})
