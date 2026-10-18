// missing-tunnel.test.mjs — 必填 tunnel 字段的本地前置校验。
//
// Host 的跨字段校验拒绝保存后，官方 configForms 只回一个布尔、不携带原因，页面因此
// 只能在事后显示通用失败文案。本地按同一规则提前标红缺值字段并禁用保存，避免一次
// 必然失败的写入。这里断言规则本身，不依赖 React 渲染。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TUNNEL_HOSTNAME,
  TUNNEL_MODE,
  TUNNEL_NAME,
  missingTunnelField,
} from '../src/client/form.js'

/**
 * 造一份表单投影形状的最小状态。
 * @param {string} mode tunnel 方式
 * @param {string} [hostname] 公网 hostname 草稿
 * @param {string} [name] 隧道名草稿
 * @returns {object} 含三个字段的投影
 */
function state(mode, hostname = '', name = '') {
  return {
    [TUNNEL_MODE]: { text: mode },
    [TUNNEL_HOSTNAME]: { text: hostname },
    [TUNNEL_NAME]: { text: name },
  }
}

test('cloudflare-named 缺隧道名时标红隧道名，hostname 已填不算缺', () => {
  assert.deepEqual(missingTunnelField(state('cloudflare-named', 'codexpro-local.wenran.me')), {
    tunnelHostname: false,
    tunnelName: true,
  })
})

test('cloudflare-named 缺 hostname 时同样标红', () => {
  assert.deepEqual(missingTunnelField(state('cloudflare-named', '', 'codexpro-local')), {
    tunnelHostname: true,
    tunnelName: false,
  })
})

test('ngrok 与 tailscale 只要求 hostname，不要求隧道名', () => {
  for (const mode of ['ngrok', 'tailscale']) {
    assert.deepEqual(missingTunnelField(state(mode, '')), { tunnelHostname: true, tunnelName: false })
    assert.deepEqual(
      missingTunnelField(state(mode, 'dev.example.com')),
      { tunnelHostname: false, tunnelName: false },
    )
  }
})

test('none 与 cloudflare 不要求任何公网字段', () => {
  for (const mode of ['none', 'cloudflare']) {
    assert.deepEqual(missingTunnelField(state(mode)), { tunnelHostname: false, tunnelName: false })
  }
})

test('纯空白按空值处理', () => {
  assert.deepEqual(missingTunnelField(state('cloudflare-named', '  ', '  ')), {
    tunnelHostname: true,
    tunnelName: true,
  })
})
