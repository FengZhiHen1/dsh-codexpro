// profile-sync — profile 投影的生成与写入：路径解析 → 锚点就绪 → payload 构造 → 原子写盘。
//
// 边界：不判断授权意图（候选集由调用方经 core/catalog.js 决定）；不持有进程（进程在 process.js）。
// 锚点的两步 IO 都是硬要求：codexpro 对不存在的 --root 拒绝启动；而 profile 文件名由
// realpath(root) 的哈希决定，不归一就会算出与 codexpro 不同的文件名。
// 参考：technical-details/配置与profile投影.md §二/§三；DSR-001、DSR-003、DSR-006。

import { mkdir, realpath } from 'node:fs/promises'
import { anchorDir, codexproHome } from '../core/anchor.js'
import { resolveGrantedRoots } from '../core/catalog.js'
import { DEFAULTS, FIXED_MODE } from '../core/codexpro.js'
import { buildProfile } from '../core/profile.js'
import { writeProfile } from './profile-writer.js'

/** 锚点目录权限：仅属主可访问。 */
const ANCHOR_DIR_MODE = 0o700

/**
 * 创建 profile 同步器：把「当前配置 + 候选集」投影为磁盘上的 profile 文件。
 * @param {object} deps
 * @param {() => string} deps.dshHome 实例的 $DSH_HOME
 * @param {() => object} deps.snapshot 读当前配置快照
 * @returns {{resolvePaths: () => {home: string, anchor: string},
 *   ensureAnchor: (anchor: string) => Promise<string>,
 *   sync: (candidates: Array<object>) => Promise<object>}} 同步器
 */
export function createProfileSync({ dshHome, snapshot }) {
  /**
   * 解析数据目录与锚点目录路径（不做 IO）。
   * @returns {{home: string, anchor: string}} 路径
   */
  const resolvePaths = () => {
    const home = codexproHome(dshHome())
    return { home, anchor: anchorDir(dshHome(), snapshot().anchorDir) }
  }

  /**
   * 确保锚点目录存在并返回其 realpath。
   * @param {string} anchor 锚点目录
   * @returns {Promise<string>} realpath 归一后的锚点
   */
  const ensureAnchor = async (anchor) => {
    await mkdir(anchor, { recursive: true, mode: ANCHOR_DIR_MODE })
    return realpath(anchor)
  }

  /**
   * 由当前配置生成 profile 内容并写入。
   * @param {Array<object>} candidates 候选集（含授权与存在性）
   * @returns {Promise<{path: string, written: boolean, allowedRoots: string[],
   *   skipped: Array<{path: string, reason: string}>}>} 写入结果
   */
  const sync = async (candidates) => {
    const paths = resolvePaths()
    const values = snapshot()
    const realAnchor = await ensureAnchor(paths.anchor)
    const { roots, skipped } = resolveGrantedRoots(candidates)
    const payload = buildProfile({
      realAnchor,
      allowedRoots: roots,
      port: pick(values, 'port', DEFAULTS.port),
      tunnel: pick(values, 'tunnelMode', DEFAULTS.tunnel),
      hostname: pick(values, 'tunnelHostname', ''),
      bashMode: pick(values, 'bashMode', DEFAULTS.bash),
      writeMode: pick(values, 'writeMode', DEFAULTS.write),
      token: pick(values, 'httpToken', ''),
      updatedAt: new Date().toISOString(),
      mode: FIXED_MODE,
    })
    const result = await writeProfile({ home: paths.home, realAnchor, payload })
    return { ...result, allowedRoots: roots, skipped }
  }

  return { resolvePaths, ensureAnchor, sync }
}

/**
 * 从配置快照取字符串字段，缺失时回落默认值。
 * @param {object} values 配置快照
 * @param {string} key 字段名
 * @param {string} fallback 默认值
 * @returns {string} 字段值
 */
export function pick(values, key, fallback) {
  const value = values[key]
  return value === undefined || value === null || value === '' ? fallback : String(value)
}
