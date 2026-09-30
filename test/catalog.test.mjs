// core 单测：授权候选集变换与授权收敛。
// 证据面：C-03（授权只来自工作区注册表）与「不存在的目录不得写入」两条约束在此被钉住。

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCatalog, normalizeAuthorization, resolveGrantedRoots } from '../src/core/catalog.js'

test('buildCatalog 保留注册表顺序并映射授权状态', () => {
  const workspaces = [
    { path: 'E:\\a', title: 'A' },
    { path: 'E:\\b', title: 'B' },
  ]
  const result = buildCatalog(workspaces, { 'E:\\b': true })
  assert.deepEqual(result.map((item) => item.path), ['E:\\a', 'E:\\b'])
  assert.equal(result[0].authorized, false)
  assert.equal(result[1].authorized, true)
})

test('buildCatalog 在标题缺失时回落为路径末段', () => {
  const result = buildCatalog([{ path: 'E:\\Project\\demo' }], {})
  assert.equal(result[0].title, 'demo')
})

test('buildCatalog 过滤掉无有效路径的条目', () => {
  const result = buildCatalog([{ path: '' }, { title: 'no-path' }, { path: 'E:\\ok' }], {})
  assert.equal(result.length, 1)
  assert.equal(result[0].path, 'E:\\ok')
})

test('buildCatalog 对非数组输入返回空列表（不抛）', () => {
  assert.deepEqual(buildCatalog(null, {}), [])
  assert.deepEqual(buildCatalog(undefined, null), [])
})

test('resolveGrantedRoots 只取已授权且存在的目录', () => {
  const { roots, skipped } = resolveGrantedRoots([
    { path: 'E:\\a', authorized: true, exists: true },
    { path: 'E:\\b', authorized: false, exists: true },
    { path: 'E:\\c', authorized: true, exists: false },
  ])
  assert.deepEqual(roots, ['E:\\a'])
  assert.deepEqual(skipped, [{ path: 'E:\\c', reason: 'not-found' }])
})

test('resolveGrantedRoots 剔除不存在的目录（codexpro 会因此拒绝启动）', () => {
  const { roots } = resolveGrantedRoots([{ path: 'E:\\gone', authorized: true, exists: false }])
  assert.deepEqual(roots, [], '目录不存在时不得写入授权根')
})

test('resolveGrantedRoots 对脏输入不做静默兜底', () => {
  const { roots, skipped } = resolveGrantedRoots([null, 'x', { path: '' }, { path: 'E:\\a', authorized: true, exists: true }])
  assert.deepEqual(roots, ['E:\\a'])
  assert.deepEqual(skipped, [])
})

test('normalizeAuthorization 丢弃候选集之外的键', () => {
  const candidates = [{ path: 'E:\\a' }]
  const result = normalizeAuthorization({ 'E:\\a': true, 'E:\\evil': true }, candidates)
  assert.deepEqual(result, { 'E:\\a': true })
  assert.ok(!('E:\\evil' in result), '不在工作区注册表内的路径必须被丢弃')
})

test('normalizeAuthorization 保留显式取消（false）以区别于未表态', () => {
  const candidates = [{ path: 'E:\\a' }, { path: 'E:\\b' }]
  const result = normalizeAuthorization({ 'E:\\a': false, 'E:\\b': true }, candidates)
  assert.equal(result['E:\\a'], false)
  assert.equal(result['E:\\b'], true)
})

test('normalizeAuthorization 对非对象输入返回空映射', () => {
  assert.deepEqual(normalizeAuthorization(null, [{ path: 'E:\\a' }]), {})
  assert.deepEqual(normalizeAuthorization(['E:\\a'], [{ path: 'E:\\a' }]), {})
})

test('normalizeAuthorization 把非 true 值归为 false', () => {
  const result = normalizeAuthorization({ 'E:\\a': 'yes' }, [{ path: 'E:\\a' }])
  assert.equal(result['E:\\a'], false)
})
