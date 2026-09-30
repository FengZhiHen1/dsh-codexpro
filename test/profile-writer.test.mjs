// adapter 单测：profile 写盘。用真实文件系统 + 临时目录（无内存 fs helper）。
// 证据面：原子性（不残留临时文件）、幂等（内容未变不写盘）、首次写入路径。

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeProfile } from '../src/adapter/profile-writer.js'
import { buildProfile, profilePath, serializeProfile } from '../src/core/profile.js'

/**
 * 造一个临时根并返回其路径与清理函数。
 * @returns {Promise<{home: string, anchor: string, cleanup: () => Promise<void>}>} 临时根
 */
async function makeTemp() {
  const root = await mkdtemp(path.join(tmpdir(), 'codexpro-test-'))
  const home = path.join(root, 'home')
  const anchor = path.join(root, 'anchor')
  return { home, anchor, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * 构造一份测试用 profile。
 * @param {string} anchor 锚点
 * @param {string[]} [roots] 授权目录
 * @param {string} [token] token
 * @returns {object} payload
 */
function payloadFor(anchor, roots = [], token = '') {
  return buildProfile({
    realAnchor: anchor,
    allowedRoots: roots,
    port: '8787',
    tunnel: 'none',
    bashMode: 'safe',
    writeMode: 'workspace',
    token,
    updatedAt: '2026-01-01T00:00:00.000Z',
    mode: 'agent',
  })
}

test('首次写入创建 profiles 目录并落盘', async () => {
  const { home, anchor, cleanup } = await makeTemp()
  try {
    const result = await writeProfile({ home, realAnchor: anchor, payload: payloadFor(anchor, ['E:\\a']) })
    assert.equal(result.written, true)
    assert.equal(result.path, profilePath(home, anchor))
    const text = await readFile(result.path, 'utf8')
    const parsed = JSON.parse(text)
    assert.deepEqual(parsed.allowedRoots, ['E:\\a'])
    assert.equal(parsed.mode, 'agent')
  } finally {
    await cleanup()
  }
})

test('内容未变时不写盘（幂等，避免无谓 mtime 变化）', async () => {
  const { home, anchor, cleanup } = await makeTemp()
  try {
    const payload = payloadFor(anchor, ['E:\\a'])
    const first = await writeProfile({ home, realAnchor: anchor, payload })
    assert.equal(first.written, true)
    // 同一内容再次写入：只有 updatedAt 会不同，等价判定应使其跳过。
    const second = await writeProfile({
      home,
      realAnchor: anchor,
      payload: { ...payload, updatedAt: '2026-12-31T23:59:59.000Z' },
    })
    assert.equal(second.written, false, '内容等价的重复写入必须被跳过')
  } finally {
    await cleanup()
  }
})

test('内容变化时真实写盘', async () => {
  const { home, anchor, cleanup } = await makeTemp()
  try {
    await writeProfile({ home, realAnchor: anchor, payload: payloadFor(anchor, ['E:\\a']) })
    const changed = await writeProfile({ home, realAnchor: anchor, payload: payloadFor(anchor, ['E:\\a', 'E:\\b']) })
    assert.equal(changed.written, true)
    const parsed = JSON.parse(await readFile(changed.path, 'utf8'))
    assert.deepEqual(parsed.allowedRoots, ['E:\\a', 'E:\\b'])
  } finally {
    await cleanup()
  }
})

test('写盘不残留临时文件', async () => {
  const { home, anchor, cleanup } = await makeTemp()
  try {
    await writeProfile({ home, realAnchor: anchor, payload: payloadFor(anchor) })
    const entries = await readdir(path.join(home, 'profiles'))
    const temp = entries.filter((name) => name.includes('.tmp'))
    assert.deepEqual(temp, [], `不得残留临时文件，实际 ${temp.join(', ')}`)
    assert.equal(entries.length, 1)
  } finally {
    await cleanup()
  }
})

test('已存在的损坏 JSON 不会被当作等价而跳过（内容不同即重写）', async () => {
  const { home, anchor, cleanup } = await makeTemp()
  try {
    const target = profilePath(home, anchor)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, '{ this is not json', 'utf8')
    const payload = payloadFor(anchor, ['E:\\a'])
    const result = await writeProfile({ home, realAnchor: anchor, payload })
    assert.equal(result.written, true, '损坏文件必须被有效内容覆盖')
    const parsed = JSON.parse(await readFile(target, 'utf8'))
    assert.deepEqual(parsed.allowedRoots, ['E:\\a'])
  } finally {
    await cleanup()
  }
})

test('同一 payload 两次序列化得到逐字节相同文本', async () => {
  const { anchor, cleanup } = await makeTemp()
  try {
    const payload = payloadFor(anchor, ['E:\\b', 'E:\\a'])
    assert.equal(serializeProfile(payload), serializeProfile(payload))
  } finally {
    await cleanup()
  }
})
