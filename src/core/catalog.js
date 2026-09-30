// catalog — 授权候选集与授权集的纯变换：DSH 工作区列表 → 候选视图 → profile 授权目录。
//
// 边界：不做 IO 与 realpath（工作区路径已由 DSH 归一；目录存在性由 adapter 探测后传入）。
// 单向语义：授权意图只来自本插件的配置；不读回 codexpro 侧的手工改动（DSR-006）。
// 参考：technical-details/配置与profile投影.md §四；DSR-006。

/**
 * 把 DSH 工作区列表变换为候选视图，供设置页逐项勾选。
 * @param {Array<{path: string, title?: string}>} workspaces DSH 注册表的工作区列表
 * @param {Record<string, boolean>} authorized 授权映射（键为目录路径）
 * @returns {Array<{path: string, title: string, authorized: boolean}>} 候选视图，保持注册表顺序
 */
export function buildCatalog(workspaces, authorized) {
  const map = isPlainObject(authorized) ? authorized : {}
  const list = Array.isArray(workspaces) ? workspaces : []
  return list
    .filter((workspace) => isPlainObject(workspace) && typeof workspace.path === 'string' && workspace.path !== '')
    .map((workspace) => ({
      path: workspace.path,
      title: typeof workspace.title === 'string' && workspace.title !== ''
        ? workspace.title
        : lastSegment(workspace.path),
      authorized: map[workspace.path] === true,
    }))
}

/**
 * 由候选集与存在性探测结果推导本次要写入 profile 的授权目录。
 * 不存在的目录必须剔除：codexpro 对不存在的授权根会直接拒绝启动（其 toRealDir 抛错）。
 * @param {Array<{path: string, exists: boolean}>} candidates 候选集（含存在性标记）
 * @returns {{roots: string[], skipped: Array<{path: string, reason: string}>}}
 *   roots 为待写目录；skipped 为被剔除项及原因
 */
export function resolveGrantedRoots(candidates) {
  const roots = []
  const skipped = []
  const list = Array.isArray(candidates) ? candidates : []
  for (const item of list) {
    if (!isPlainObject(item) || typeof item.path !== 'string' || item.path === '') continue
    if (!item.authorized) continue
    if (item.exists !== true) {
      skipped.push({ path: item.path, reason: 'not-found' })
      continue
    }
    roots.push(item.path)
  }
  return { roots, skipped }
}

/**
 * 把设置页提交的授权映射收敛为仅含合法键的映射。
 * 只接受「候选集里出现过的工作区路径」：这使 C-03（授权候选只来自工作区注册表）
 * 得到机械保证，而不是靠调用方自觉。
 * @param {unknown} submitted 设置页提交的映射
 * @param {Array<{path: string}>} candidates 候选集
 * @returns {Record<string, boolean>} 仅含候选路径的布尔映射
 */
export function normalizeAuthorization(submitted, candidates) {
  const allowed = new Set(
    (Array.isArray(candidates) ? candidates : [])
      .filter((item) => isPlainObject(item) && typeof item.path === 'string')
      .map((item) => item.path),
  )
  const result = {}
  if (!isPlainObject(submitted)) return result
  for (const [key, value] of Object.entries(submitted)) {
    if (!allowed.has(key)) continue
    result[key] = value === true
  }
  return result
}

/**
 * 判断值是否为普通对象（排除 null 与数组）。
 * @param {unknown} value 待判值
 * @returns {boolean} 是普通对象时为 true
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 取路径的最后一段作为回落标题。
 * @param {string} value 路径
 * @returns {string} 最后一段；无分隔符时返回原值
 */
function lastSegment(value) {
  const parts = value.split(/[\\/]/).filter((part) => part !== '')
  return parts.length ? parts[parts.length - 1] : value
}
