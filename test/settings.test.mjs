// adapter 单测：配置边界（schema 形状、跨字段校验、volatile 读取）。
// 证据面：volatile 必须加在 dict 节点本身（加在值 schema 上会抛），以及跨字段约束的拒绝路径。

import test from 'node:test'
import assert from 'node:assert/strict'
import Schema from '@deepseek-ai/schemastery'
import { Config, configReader, readConfig, validateConfig } from '../src/adapter/settings.js'

test('Config 可被 schemastery 解析并填默认值', () => {
  const [value] = Schema.resolve({}, Config, { path: [] })
  assert.equal(value.port.get(), '8787')
  assert.equal(value.tunnelMode.get(), 'none')
  assert.equal(value.bashMode.get(), 'safe')
  assert.equal(value.writeMode.get(), 'workspace')
  assert.deepEqual(value.authorized.get(), {})
  assert.equal(value.anchorDir, '', 'anchorDir 非 volatile，应是普通值')
})

test('authorized 是 dict 且 volatile 加在 dict 节点本身', () => {
  const [value] = Schema.resolve({ authorized: { 'E:\\a': true } }, Config, { path: [] })
  assert.equal(typeof value.authorized.get, 'function', 'authorized 必须是 volatile 引用')
  assert.deepEqual(value.authorized.get(), { 'E:\\a': true })
})

test('readConfig 把 volatile 引用读成纯数据', () => {
  const [value] = Schema.resolve({ port: '9000', authorized: { 'E:\\a': true } }, Config, { path: [] })
  const plain = readConfig(value)
  assert.equal(plain.port, '9000')
  assert.deepEqual(plain.authorized, { 'E:\\a': true })
  assert.equal(plain.anchorDir, '')
})

test('readConfig 对普通对象与脏输入不做兜底式改写', () => {
  assert.deepEqual(readConfig({ port: '1', anchorDir: 'E:\\x' }), { port: '1', anchorDir: 'E:\\x' })
  assert.deepEqual(readConfig(null), {})
  assert.deepEqual(readConfig([]), {})
  assert.deepEqual(readConfig('x'), {})
})

test('configReader 每次现读，反映 volatile 的最新值', () => {
  const [value] = Schema.resolve({ port: '8787' }, Config, { path: [] })
  const reader = configReader(value)
  assert.equal(reader.get().port, '8787')
})

test('validateConfig 接受合法配置', () => {
  assert.doesNotThrow(() => validateConfig({
    port: '8787', tunnelMode: 'none', tunnelHostname: '', bashMode: 'safe', writeMode: 'workspace',
  }))
})

test('validateConfig 拒绝越界或非整数端口', () => {
  for (const port of ['0', '65536', 'abc', '80.5', '-1']) {
    assert.throws(() => validateConfig({ port, tunnelMode: 'none', bashMode: 'safe', writeMode: 'workspace' }), /port/)
  }
})

test('validateConfig 要求具名 tunnel 提供 hostname', () => {
  for (const tunnel of ['ngrok', 'cloudflare-named', 'tailscale']) {
    assert.throws(
      () => validateConfig({ port: '8787', tunnelMode: tunnel, tunnelHostname: '', bashMode: 'safe', writeMode: 'workspace' }),
      /tunnelHostname/,
    )
    assert.doesNotThrow(() => validateConfig({
      port: '8787', tunnelMode: tunnel, tunnelHostname: 'x.example.com', bashMode: 'safe', writeMode: 'workspace',
    }))
  }
})

test('validateConfig 对 none 与 cloudflare 不要求 hostname', () => {
  for (const tunnel of ['none', 'cloudflare']) {
    assert.doesNotThrow(() => validateConfig({
      port: '8787', tunnelMode: tunnel, tunnelHostname: '', bashMode: 'safe', writeMode: 'workspace',
    }))
  }
})

test('validateConfig 拒绝枚举外的 tunnel / bash / write', () => {
  assert.throws(() => validateConfig({ port: '8787', tunnelMode: 'bogus', bashMode: 'safe', writeMode: 'workspace' }), /tunnelMode/)
  assert.throws(() => validateConfig({ port: '8787', tunnelMode: 'none', bashMode: 'bogus', writeMode: 'workspace' }), /bashMode/)
  assert.throws(() => validateConfig({ port: '8787', tunnelMode: 'none', bashMode: 'safe', writeMode: 'bogus' }), /writeMode/)
})

test('Config schema 本身拒绝枚举外的取值（加载期拦截）', () => {
  assert.throws(() => Schema.resolve({ tunnelMode: 'bogus' }, Config, { path: [] }))
  assert.throws(() => Schema.resolve({ bashMode: 'bogus' }, Config, { path: [] }))
})
