// settings-model.test.mjs — 复制来的 SettingsFormModel 的草稿语义。
//
// 覆盖只有运行期才会暴露的边界：一次保存只发一次 revision 围栏的 mutate、
// 非法草稿挡住保存、失败保留草稿、重置表达为 unset、离开页面丢弃。
// 参考：DSH 0.2.1 packages/client/ui-primitives/src/settings-form/form-model.ts。

import test from 'node:test'
import assert from 'node:assert/strict'
import { SettingsFormModel, settingsNumberField, settingsTextField } from '../src/client/settings-model.js'

/**
 * 造一个官方 ConfigForm 形状的 scope。
 * @param {object} [overrides] 初始值覆盖
 * @returns {object} scope 与可观察记录
 */
function makeScope(overrides = {}) {
  const state = {
    status: overrides.status ?? 'ready',
    value: { name: 'base', count: 1, ...overrides.value },
    base: { name: 'base', count: 1, ...overrides.base },
    user: overrides.user ?? {},
    writable: overrides.writable ?? true,
    revision: overrides.revision ?? 3,
  }
  const listeners = new Set()
  const mutations = []
  const scope = {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async mutate(ops, expectedRevision) {
      mutations.push({ ops, expectedRevision })
      if (overrides.landed === false) return false
      for (const op of ops) {
        for (const key of op.path) {
          if (op.op === 'unset') {
            delete state.value[key]
            delete state.user[key]
          } else {
            state.value[key] = op.value
            state.user[key] = op.value
          }
        }
      }
      state.revision += 1
      for (const listener of listeners) listener()
      return true
    },
  }
  return { scope, state, mutations, notify: () => { for (const listener of listeners) listener() } }
}

/** 本测试用的字段规格。 */
const SPECS = [settingsTextField('name'), settingsNumberField('count')]

test('未编辑时不可保存；编辑后只暂存，不写 Host', () => {
  const { scope, mutations } = makeScope()
  const form = new SettingsFormModel(scope, SPECS)
  assert.deepEqual(form.shell(), {
    available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false,
  })
  assert.deepEqual(form.field('name'), { text: 'base', overridden: false, invalid: false })

  form.actions().edit('name', 'next')
  assert.equal(form.shell().dirty, true, '编辑后应变为待保存')
  assert.deepEqual(form.field('name'), { text: 'next', overridden: true, invalid: false })
  assert.equal(mutations.length, 0, '编辑不得直接写 Host')
})

test('保存一次只发一次 mutate，并带上草稿起始 revision', async () => {
  const { scope, mutations, state } = makeScope()
  const form = new SettingsFormModel(scope, SPECS)
  form.actions().edit('name', 'next')
  form.actions().edit('count', '2')
  await form.save()

  assert.equal(mutations.length, 1, '一张卡的多个字段必须一次写入')
  assert.deepEqual(mutations[0].ops, [
    { op: 'set', path: ['name'], value: 'next' },
    { op: 'set', path: ['count'], value: 2 },
  ])
  assert.equal(mutations[0].expectedRevision, 3, '必须围栏草稿起始的 revision')
  assert.equal(state.value.name, 'next')
  assert.equal(form.shell().dirty, false, '保存成功后草稿应清空')
  assert.deepEqual(form.field('name'), { text: 'next', overridden: true, invalid: false },
    '保存后用户层承载该字段，overridden 应回读为 true')
})

test('非法草稿挡住保存，且不静默回落默认值', async () => {
  const { scope, mutations } = makeScope()
  const form = new SettingsFormModel(scope, SPECS)
  form.actions().edit('count', 'abc')
  assert.equal(form.shell().invalid, true)
  assert.deepEqual(form.field('count'), { text: 'abc', overridden: false, invalid: true })
  await form.save()
  assert.equal(mutations.length, 0, '非法草稿不得发出写入')
})

test('Host 拒绝时保留草稿并标记失败', async () => {
  const { scope } = makeScope({ landed: false })
  const form = new SettingsFormModel(scope, SPECS)
  form.actions().edit('name', 'kept')
  await form.save()
  assert.equal(form.shell().failed, true)
  assert.deepEqual(form.field('name'), { text: 'kept', overridden: true, invalid: false },
    '失败后草稿必须保留，便于用户改正重试')
})

test('重置表达为 unset（回落组合层），而不是写入组合层的副本', async () => {
  const { scope, mutations, state } = makeScope({ user: { name: 'overridden' }, value: { name: 'overridden', count: 1 } })
  const form = new SettingsFormModel(scope, SPECS)
  assert.equal(form.field('name').overridden, true, '用户层承载该字段时应显示已覆盖')
  form.actions().resetField('name')
  assert.deepEqual(form.field('name'), { text: 'base', overridden: false, invalid: false },
    '重置后的草稿应回落组合层值')
  await form.save()
  assert.deepEqual(mutations[0].ops, [{ op: 'unset', path: ['name'] }])
  assert.equal(state.user.name, undefined, 'unset 后用户层不再承载该字段')
})

test('discard 丢弃全部草稿并清除失败标记', async () => {
  const { scope } = makeScope({ landed: false })
  const form = new SettingsFormModel(scope, SPECS)
  form.actions().edit('name', 'draft')
  await form.save()
  assert.equal(form.shell().failed, true)
  form.actions().discard()
  assert.equal(form.shell().dirty, false)
  assert.equal(form.shell().failed, false)
})

test('不可用与只读状态由 Host 快照决定', () => {
  const { scope } = makeScope({ writable: false })
  const form = new SettingsFormModel(scope, SPECS)
  assert.equal(form.shell().writable, false)

  const unavailable = makeScope({ status: 'unavailable' })
  const other = new SettingsFormModel(unavailable.scope, SPECS)
  assert.equal(other.shell().available, false)
})

test('投影 store 在草稿或 Host 快照变化时通知订阅者', () => {
  const { scope, notify } = makeScope()
  const form = new SettingsFormModel(scope, SPECS)
  let calls = 0
  const store = form.bind(() => form.shell())
  store.subscribe(() => { calls += 1 })
  form.actions().edit('name', 'x')
  assert.ok(calls >= 1, '草稿变化应通知投影')
  const before = calls
  notify()
  assert.ok(calls > before, 'Host 快照变化应通知投影')
  form.dispose()
})
