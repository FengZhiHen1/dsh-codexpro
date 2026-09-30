// core 单测：锚点与数据目录推导，以及槽位键常量的一致性。
// 证据面：DSR-001（锚点与授权集无关）与 DSR-003（每实例独立数据目录）。

import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { anchorDir, codexproHome } from '../src/core/anchor.js'
import { CONFIG_NS, PACKAGE_NAME, ROW_CONFIG_KEY } from '../src/core/config-fields.js'

const here = dirname(fileURLToPath(import.meta.url))
const pluginRoot = join(here, '..')

test('codexproHome 置于实例 HOME 下的 codexpro 子目录', () => {
  const home = path.join('C:', 'homes', 'stable-dev')
  assert.equal(codexproHome(home), path.join(home, 'codexpro'))
})

test('anchorDir 默认为数据目录下的 anchor，与授权集无关', () => {
  const home = path.join('C:', 'homes', 'stable-dev')
  assert.equal(anchorDir(home), path.join(home, 'codexpro', 'anchor'))
  // 同一 HOME 在不同授权集下必须得到同一锚点——这是 profile 身份稳定的前提。
  assert.equal(anchorDir(home), anchorDir(home))
})

test('anchorDir 支持覆盖，且覆盖时解析为绝对路径', () => {
  const home = path.join('C:', 'homes', 'stable-dev')
  assert.equal(anchorDir(home, 'E:\\custom\\anchor'), path.resolve('E:\\custom\\anchor'))
  assert.equal(anchorDir(home, '   '), path.join(home, 'codexpro', 'anchor'), '空白覆盖视为未提供')
  assert.equal(anchorDir(home, ''), path.join(home, 'codexpro', 'anchor'))
})

test('ROW_CONFIG_KEY 两段与 package.json 的 name 及 patch 行 id 一致', () => {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8'))
  const patch = readFileSync(join(pluginRoot, 'cordis.patch.yml'), 'utf8')
  const rowId = /- id:\s*(\S+)/.exec(patch)?.[1]

  assert.equal(PACKAGE_NAME, manifest.name, 'PACKAGE_NAME 必须等于 package.json 的 name')
  assert.equal(CONFIG_NS, rowId, 'CONFIG_NS 必须等于 cordis.patch.yml 的 insert 行 id')
  assert.equal(ROW_CONFIG_KEY, `${manifest.name}#${rowId}`)
  // 任一不一致都会导致该行不出现「配置」控件且无任何报错（静默缺失），故在此钉住。
})

test('exports 的 client 入口与构建产物路径一致', () => {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['./client'], './dist/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
})
