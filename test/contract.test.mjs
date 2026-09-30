// core 单测：RPC 信封与载荷契约。畸形输入必须被显式拒绝，不落未定义分支。
//
// 端点词表只含进程动作：配置读写（授权集与参数）已改走官方 configForms，
// 故 setAuthorization / configure 及其载荷解析器不在此列。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ContractError,
  ENDPOINTS,
  envelopeOf,
  fail,
  isValidEndpoint,
  ok,
  parseEmptyPayload,
  parseEnvelope,
} from '../src/core/contract.js'

test('parseEnvelope 接受合法信封', () => {
  const result = parseEnvelope({ type: 'client-request', rpcId: 'r1', method: 'codexpro/status', payload: {} })
  assert.deepEqual(result, { rpcId: 'r1', method: 'codexpro/status', payload: {} })
})

test('parseEnvelope 拒绝脏信封（返回 undefined 而非抛）', () => {
  const cases = [
    null,
    undefined,
    'string',
    42,
    [],
    { type: 'server-response', rpcId: 'r1', method: 'x' },
    { type: 'client-request', rpcId: '', method: 'x' },
    { type: 'client-request', rpcId: 'r1' },
    { type: 'client-request', method: 'x' },
  ]
  for (const body of cases) {
    assert.equal(parseEnvelope(body), undefined, `应拒绝：${JSON.stringify(body)}`)
  }
})

test('envelopeOf / ok / fail 产出平台信封形状', () => {
  assert.deepEqual(envelopeOf('r1', ok({ a: 1 })), {
    type: 'server-response',
    rpcId: 'r1',
    result: { ok: true, value: { a: 1 } },
  })
  const failure = fail('NOT_FOUND', '无此项')
  assert.equal(failure.ok, false)
  assert.equal(failure.error.code, 'NOT_FOUND')
  assert.equal(failure.error.message, '无此项')
})

test('端点词表只含进程动作（配置读写已归官方 configForms）', () => {
  assert.deepEqual([...ENDPOINTS], ['catalog', 'status', 'start', 'stop'])
  // 这两个端点若复活，说明配置又走回了自建通道——本测试即为该回归的闸门。
  assert.ok(!ENDPOINTS.includes('setAuthorization'), 'setAuthorization 不应再是端点')
  assert.ok(!ENDPOINTS.includes('configure'), 'configure 不应再是端点')
})

test('isValidEndpoint 只认词表内的端点', () => {
  for (const endpoint of ENDPOINTS) assert.ok(isValidEndpoint(endpoint), `${endpoint} 应在词表内`)
  for (const bad of ['', 'nope', '../evil', 'status/../x', null, undefined, 'configure', 'setAuthorization']) {
    assert.equal(isValidEndpoint(bad), false, `${String(bad)} 应被拒`)
  }
})

test('parseEmptyPayload 接受空对象与 undefined，拒绝非对象', () => {
  assert.doesNotThrow(() => parseEmptyPayload({}))
  assert.doesNotThrow(() => parseEmptyPayload(undefined))
  assert.doesNotThrow(() => parseEmptyPayload(null))
  assert.throws(() => parseEmptyPayload('x'), ContractError)
  assert.throws(() => parseEmptyPayload([1]), ContractError)
})

test('ContractError 带字段路径，便于定位失配处', () => {
  try {
    parseEmptyPayload('x')
    assert.fail('应抛出')
  } catch (error) {
    assert.ok(error instanceof ContractError)
    assert.equal(error.path, 'payload')
  }
})
