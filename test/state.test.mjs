// core 单测：进程状态机。矩阵式遍历「状态 × 事件」，合法迁移断言结果、非法迁移断言拒绝。
// 证据面：词表完整性（每个状态与事件都有定义）与拒绝路径显式化（CORE-01/CORE-02）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS, STATES, canStart, canStop, transition } from '../src/core/state.js'

const ALL_STATES = Object.values(STATES)
const ALL_EVENTS = Object.values(EVENTS)

test('状态与事件词表非空且互不重叠', () => {
  assert.ok(ALL_STATES.length >= 5)
  assert.ok(ALL_EVENTS.length >= 5)
  const overlap = ALL_STATES.filter((state) => ALL_EVENTS.includes(state))
  assert.deepEqual(overlap, [], '状态名与事件名不得重名，否则表键会产生歧义')
})

test('每个「状态 × 事件」组合都返回显式结果（不抛、不静默）', () => {
  for (const state of ALL_STATES) {
    for (const event of ALL_EVENTS) {
      const result = transition(state, event)
      assert.equal(typeof result.ok, 'boolean', `${state} --${event}--> 必须返回带 ok 的结果`)
      if (result.ok) {
        assert.ok(ALL_STATES.includes(result.state), `转换目标 ${result.state} 必须在词表内`)
      } else {
        assert.ok(typeof result.reason === 'string' && result.reason !== '', '拒绝必须带原因')
      }
    }
  }
})

test('正常生命周期 idle → starting → running → stopping → idle', () => {
  let state = STATES.idle
  for (const event of [EVENTS.start, EVENTS.healthy, EVENTS.stop, EVENTS.exited]) {
    const result = transition(state, event)
    assert.ok(result.ok, `${state} --${event}--> 应被接受`)
    state = result.state
  }
  assert.equal(state, STATES.idle)
})

test('启动失败路径 idle → starting → failed，且可从 failed 重试', () => {
  const starting = transition(STATES.idle, EVENTS.start)
  assert.ok(starting.ok)
  const failed = transition(starting.state, EVENTS.fail)
  assert.ok(failed.ok)
  assert.equal(failed.state, STATES.failed)
  const retry = transition(STATES.failed, EVENTS.start)
  assert.ok(retry.ok, '失败后必须允许重试')
  assert.equal(retry.state, STATES.starting)
})

test('启动中可被中止（starting --stop--> stopping）', () => {
  const result = transition(STATES.starting, EVENTS.stop)
  assert.ok(result.ok)
  assert.equal(result.state, STATES.stopping)
})

test('未运行时的停止请求被拒绝（不静默成功）', () => {
  const result = transition(STATES.idle, EVENTS.stop)
  assert.equal(result.ok, false, 'idle 下 stop 必须被显式拒绝')
  assert.ok(result.reason.includes('rejected'))
})

test('运行中的启动请求被拒绝（防重入）', () => {
  const result = transition(STATES.running, EVENTS.start)
  assert.equal(result.ok, false)
})

test('过渡态拒绝重复触发同一动作', () => {
  assert.equal(transition(STATES.starting, EVENTS.start).ok, false, 'starting 下再次 start 应被拒')
  assert.equal(transition(STATES.stopping, EVENTS.stop).ok, false, 'stopping 下再次 stop 应被拒')
})

test('运行中进程退出回落 idle（异常退出不谎报运行中）', () => {
  const result = transition(STATES.running, EVENTS.exited)
  assert.ok(result.ok)
  assert.equal(result.state, STATES.idle)
})

test('failed 状态可被 stop 收敛为 idle', () => {
  const result = transition(STATES.failed, EVENTS.stop)
  assert.ok(result.ok)
  assert.equal(result.state, STATES.idle)
})

test('词表外的状态或事件抛错（编码错误不静默兜底）', () => {
  assert.throws(() => transition('bogus', EVENTS.start), TypeError)
  assert.throws(() => transition(STATES.idle, 'bogus'), TypeError)
})

test('canStart / canStop 与转换表同源', () => {
  assert.equal(canStart(STATES.idle), true)
  assert.equal(canStart(STATES.running), false)
  assert.equal(canStart(STATES.failed), true)
  assert.equal(canStop(STATES.running), true)
  assert.equal(canStop(STATES.idle), false)
})
