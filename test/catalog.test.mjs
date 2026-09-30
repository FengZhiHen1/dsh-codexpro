// core 单测：授权候选集变换与授权态判定。
// 证据面：C-03（授权只来自工作区注册表）与「不存在的目录不得写入」两条约束在此被钉住。

import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizationOf, buildCatalog, resolveGrantedRoots } from '../src/core/catalog.js'

test('buildCatalog 保留注册表顺序并只给候选事实', () => {
  const workspaces = [
    { path: 'E:\\a', title: 'A' },
    { path: 'E:\\b', title: 'B' },
  ]
  const result = buildCatalog(workspaces)
  assert.deepEqual(result.map((item) => item.path), ['E:\\a', 'E:\\b'])
  // 候选集不含授权态：授权态的唯一来源是配置快照，避免同一事实两个来源。
  assert.ok(!('authorized' in result[0]), '候选集不应携带授权态')
})

test('buildCatalog 在标题缺失时回落为路径末段', () => {
  const result = buildCatalog([{ path: 'E:\\Project\\demo' }])
  assert.equal(result[0].title, 'demo')
})

test('buildCatalog 过滤掉无有效路径的条目', () => {
  const result = buildCatalog([{ path: '' }, { title: 'no-path' }, { path: 'E:\\ok' }])
  assert.equal(result.length, 1)
  assert.equal(result[0].path, 'E:\\ok')
})

test('buildCatalog 对非数组输入返回空列表（不抛）', () => {
  assert.deepEqual(buildCatalog(null), [])
  assert.deepEqual(buildCatalog(undefined), [])
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

test('authorizationOf 只认显式 true', () => {
  assert.equal(authorizationOf({ 'E:\\a': true }, 'E:\\a'), true)
  assert.equal(authorizationOf({ 'E:\\a': false }, 'E:\\a'), false, 'false 与缺席等价')
  assert.equal(authorizationOf({}, 'E:\\a'), false)
  assert.equal(authorizationOf({ 'E:\\a': 'yes' }, 'E:\\a'), false, '非布尔值不算授权')
  assert.equal(authorizationOf(null, 'E:\\a'), false)
  assert.equal(authorizationOf(['E:\\a'], 'E:\\a'), false, '数组不是映射')
})

test('C-03：未在注册表内的路径不进入授权根（读取侧机械成立）', () => {
  // 即使配置被手工塞入注册表外的路径，投影只遍历候选集，
  // 故该路径永远不会出现在交给 profile 的授权根里。
  const candidates = buildCatalog([{ path: 'E:\\a' }])
  const authorized = { 'E:\\a': true, 'E:\\evil': true }
  const projected = candidates.map((item) => ({
    ...item,
    authorized: authorizationOf(authorized, item.path),
    exists: true,
  }))
  const { roots } = resolveGrantedRoots(projected)
  assert.deepEqual(roots, ['E:\\a'], '注册表外的路径不得进入授权根')
})

test('授权根保持候选集顺序（profile 内容稳定，避免无谓重写）', () => {
  const candidates = buildCatalog([{ path: 'E:\\b' }, { path: 'E:\\a' }])
  const authorized = { 'E:\\a': true, 'E:\\b': true }
  const { roots } = resolveGrantedRoots(candidates.map((item) => ({ ...item, authorized: true, exists: true })))
  assert.deepEqual(roots, ['E:\\b', 'E:\\a'], '顺序跟随注册表，不另行排序')
  assert.equal(Object.keys(authorized).length, 2)
})
