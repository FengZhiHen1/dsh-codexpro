// locale-metadata.test.mjs — 包级展示文案与插件清单的静态门禁。
//
// 覆盖 0.2.1 的易误判点：无 locale 元数据时标题静默回退为包名/模块名；
// 目录里混入非法语言文件名会让整段元数据读取失败；Client 内部包不得再出现在依赖面。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「展示文案」「Client 半区构建」。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** 语言文件名文法（与 Host package-meta 一致）。 */
const LANGUAGE_FILE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*\.json$/

test('版本号与 0.1 版本线一致（0.1.1）', () => {
  assert.equal(manifest.version, '0.1.1')
})

test('声明 DSH 0.2.1 基线并导出 locale/icon 资源', () => {
  assert.equal(manifest.engines?.dsh, '^0.2.1-rc.2')
  assert.equal(manifest.exports?.['./locale/*.json'], './locale/*.json')
  assert.equal(manifest.exports?.['./icon'], './icon.svg')
  assert.ok(manifest.files.includes('locale/*.json'))
  assert.ok(manifest.files.includes('icon.svg'))
  assert.ok(manifest.files.includes('cordis.patch.yml'))
})

test('包级 locale 元数据齐全且语言文件文法合法', () => {
  const files = readdirSync(join(root, 'locale')).filter((name) => !name.startsWith('.'))
  assert.deepEqual(files.sort(), ['en.json', 'zh.json'], '同一语言只允许一个文件，且必须是语言 id')
  for (const file of files) assert.match(file, LANGUAGE_FILE)
  for (const file of files) {
    const text = JSON.parse(readFileSync(join(root, 'locale', file), 'utf8'))
    assert.equal(typeof text.meta?.title, 'string', `${file} 缺 meta.title`)
    assert.equal(typeof text.meta?.description, 'string', `${file} 缺 meta.description`)
    assert.ok(text.meta.title.trim() !== '', `${file} 的 meta.title 不得为空`)
    assert.ok(text.meta.description.trim() !== '', `${file} 的 meta.description 不得为空`)
  }
})

test('icon 是包内可读的 SVG，且不超过 256 KiB', () => {
  const file = join(root, 'icon.svg')
  assert.ok(statSync(file).isFile(), 'icon 必须是常规文件')
  assert.ok(statSync(file).size < 256 * 1024, 'icon 不得超过 256 KiB')
  assert.match(readFileSync(file, 'utf8'), /^<svg[\s>]/)
})

test('Client 依赖面不再包含 Harness Client 包', () => {
  const declared = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]
  assert.deepEqual(declared.filter((name) => name.startsWith('@deepseek-ai/dsh-client-')), [],
    'Harness Client 包不向插件提供兼容承诺；配置页实现须复制进 bundle')
})

test('dsh.client.inject 只列真实 Client 模块（顺序依赖），不含纯库或 primitives', () => {
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-plugin-manager',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-locale',
  ])
  // ui-slots 是纯核心库（无 dsh.client 清单），不能作为 Client 模块排序项。
  assert.ok(!manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-slots'))
  assert.deepEqual(manifest.dsh.bundle.patch, './cordis.patch.yml')
})

test('bundle patch 的行 id 与配置槽位 key 的两段一致', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  const id = /-\s+id:\s*(\S+)/.exec(patch)?.[1]
  assert.equal(id, 'codexpro')
  const fields = readFileSync(join(root, 'src', 'core', 'config-fields.js'), 'utf8')
  assert.match(fields, /CONFIG_NS = 'codexpro'/)
  assert.match(fields, /PACKAGE_NAME = 'dsh-codexpro'/)
  assert.match(fields, /ROW_CONFIG_KEY = `\$\{PACKAGE_NAME\}#\$\{CONFIG_NS\}`/)
  assert.equal(manifest.name, 'dsh-codexpro')
})
