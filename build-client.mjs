// build-client.mjs — Client 产物构建：esbuild 打成 dist/client.js，产物提交进 git。
//
// 封装契约：format=cjs + platform=browser，banner/footer 组成
// window.__ModuleLoader__.load({ id, factory: (require) => … }) 惰性工厂；
// 外化 react/react-dom 与 @deepseek-ai/*，运行时经 loader 模块表按 require 解析。
//
// 用法：node build-client.mjs          → 构建并写 dist/client.js
//       node build-client.mjs --check  → 内存构建与现有产物逐字节比对（哨兵，不写盘）

import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ID = 'dsh-codexpro'
const ENTRY = join(here, 'src/client/index.jsx')
const OUTFILE = join(here, 'dist/client.js')

// 外化集合与 package.json 的 dsh.client.inject 声明一致（+ react/react-dom 基线）。
const EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/*']

const BANNER = [
  `window.__ModuleLoader__.load({ id: "${PLUGIN_ID}", factory: (require) => {`,
  'var module = { exports: {} };',
  'var exports = module.exports;',
].join('\n')
const FOOTER = 'return module.exports; } });'

/**
 * 在内存中构建 client 产物。
 * @returns {Promise<string>} 产物文本
 */
async function bundle() {
  const result = await build({
    entryPoints: [ENTRY],
    outfile: OUTFILE,
    // esbuild 把「// <源文件路径>」注释按相对 CWD 计算写入产物，不钉住 absWorkingDir
    // 会让产物文本随调用目录变化，`--check` 的逐字节比对随之假报过期。
    absWorkingDir: here,
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    external: EXTERNALS,
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    banner: { js: BANNER },
    footer: { js: FOOTER },
    write: false,
  })
  return result.outputFiles[0].text
}

/**
 * 入口：构建并按参数决定写盘或比对。
 * @returns {Promise<void>} 完成后结算
 */
async function main() {
  const text = await bundle()
  if (process.argv.includes('--check')) {
    let onDisk = null
    try {
      onDisk = await readFile(OUTFILE, 'utf8')
    } catch (error) {
      // 产物不存在是哨兵的正常输入（视为过期）；读取失败的其他原因（权限等）
      // 说明检查本身不可信，必须上抛而不是报「产物过期」。
      if (error?.code !== 'ENOENT') throw error
    }
    if (onDisk === text) {
      console.log(`client 产物新鲜（${(text.length / 1024).toFixed(1)} KB）`)
      return
    }
    console.error('client 产物过期或不一致：源码与 dist/client.js 不匹配，请运行 pnpm build 并提交产物')
    process.exit(1)
  }
  await mkdir(dirname(OUTFILE), { recursive: true })
  await writeFile(OUTFILE, text, 'utf8')
  console.log(`已产出 dist/client.js（${(text.length / 1024).toFixed(1)} KB）`)
}

main().catch((error) => {
  console.error('client 构建失败：', error && error.errors ? JSON.stringify(error.errors, null, 2) : error)
  process.exit(1)
})
