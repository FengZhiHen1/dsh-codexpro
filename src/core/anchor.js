// anchor — 锚点目录与 codexpro 数据目录的纯推导（无 IO、无平台分支）。
//
// 边界：只做路径字符串推导；目录创建与存在性检查由 adapter 层做。
// 为何锚点独立于授权集：profile 文件名由锚点路径的哈希决定，锚点若随勾选变化
// 就会每次改动换一个 profile 文件，旧文件残留且配置看似丢失。见 DSR-001。
// 参考：technical-details/配置与profile投影.md §二；DSR-001、DSR-003。

import path from 'node:path'

/** 数据目录在 $DSH_HOME 下的相对位置。 */
const HOME_SEGMENT = 'codexpro'

/** 默认锚点在数据目录下的相对位置。 */
const ANCHOR_SEGMENT = 'anchor'

/**
 * codexpro 数据目录（`CODEXPRO_HOME`）：每实例独立，与终端手工使用的 `~/.codexpro` 不互通。
 * @param {string} dshHome 实例的 `$DSH_HOME` 绝对路径
 * @returns {string} 数据目录绝对路径
 */
export function codexproHome(dshHome) {
  return path.join(dshHome, HOME_SEGMENT)
}

/**
 * 锚点目录：codexpro 的 `--root`，决定 profile 文件名与 ChatGPT 的默认上下文。
 * @param {string} dshHome 实例的 `$DSH_HOME` 绝对路径
 * @param {string} [override] 配置中的覆盖值；非空时以它为锚点
 * @returns {string} 锚点目录绝对路径
 */
export function anchorDir(dshHome, override = '') {
  const trimmed = typeof override === 'string' ? override.trim() : ''
  return trimmed === '' ? path.join(codexproHome(dshHome), ANCHOR_SEGMENT) : path.resolve(trimmed)
}

/** 数据目录下的 profile 子目录名（codexpro 自身约定）。 */
export const PROFILES_SEGMENT = 'profiles'

/** 数据目录下的 runtime 子目录名（codexpro 自身约定）。 */
export const RUNTIME_SEGMENT = 'runtime'
