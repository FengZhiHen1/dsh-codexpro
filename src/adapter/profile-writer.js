// profile-writer — 全包唯一持久写出口：把 profile 内容原子写入 codexpro 数据目录。
//
// 边界：只写 profile 文件与该目录；不判断授权意图（由调用方经 core/catalog.js 决定）。
// 原子性：先写同目录临时文件再 rename，避免 codexpro 读到半截 JSON。
// 幂等：内容未变则不写盘，避免无谓的 mtime 变化触发上游重读。
// 参考：technical-details/配置与profile投影.md §三；DSR-006。

import fs from 'node:fs/promises'
import path from 'node:path'
import { profileEquivalent, profilePath, serializeProfile } from '../core/profile.js'
import { PROFILES_SEGMENT } from '../core/anchor.js'

/** 目录权限：与 codexpro 自身一致（仅属主可读写执行）。 */
const DIR_MODE = 0o700

/** 文件权限：与 codexpro 自身一致（仅属主可读写）。 */
const FILE_MODE = 0o600

/**
 * 写一次 profile 投影。
 * @param {object} input
 * @param {string} input.home codexpro 数据目录
 * @param {string} input.realAnchor 已 realpath 归一的锚点路径
 * @param {object} input.payload buildProfile 的产物
 * @returns {Promise<{path: string, written: boolean}>} 写入路径与是否实际写盘
 * @throws {Error} 目录创建或写入失败时抛出（含路径上下文）
 */
export async function writeProfile({ home, realAnchor, payload }) {
  const filePath = profilePath(home, realAnchor)
  const text = serializeProfile(payload)

  let existing = ''
  try {
    existing = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    // 文件不存在是首次写入的正常路径；其它读取错误（权限等）不应被吞掉，
    // 否则会把「读不到」误判为「首次写」而静默覆盖。
    if (/** @type {any} */ (error)?.code !== 'ENOENT') throw error
  }
  if (profileEquivalent(existing, text)) return { path: filePath, written: false }

  const dir = path.join(home, PROFILES_SEGMENT)
  await fs.mkdir(dir, { recursive: true, mode: DIR_MODE })

  const tempPath = `${filePath}.${process.pid}.tmp`
  try {
    await fs.writeFile(tempPath, text, { mode: FILE_MODE })
    await fs.rename(tempPath, filePath)
  } catch (error) {
    // 失败即清理临时文件：留下半截文件会被 codexpro 当作有效 profile 读取。
    // 清理本身失败不掩盖原始失败——把两条信息都带进抛出物，调用方能看到全貌。
    try {
      await fs.rm(tempPath, { force: true })
    } catch (cleanupError) {
      throw new Error(
        `profile 写入失败（${messageOf(error)}），且临时文件清理失败（${messageOf(cleanupError)}）：${tempPath}`,
      )
    }
    throw error
  }
  return { path: filePath, written: true }
}

/**
 * 从任意值提取可读消息。
 * @param {unknown} error 任意错误值
 * @returns {string} 可读消息
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
