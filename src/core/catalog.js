// catalog — 授权候选集的纯变换：DSH 工作区列表 → 候选视图 → profile 授权目录。
//
// 边界：不做 IO 与 realpath（工作区路径已由 DSH 归一；目录存在性由 adapter 探测后传入）。
// 授权意图的唯一真相是插件 Config 的 `authorized` 字段（经官方 configForms 读写），
// 本模块只做投影与收敛。单向语义：不读回 codexpro 侧的手工改动（DSR-006）。
// 参考：technical-details/配置与profile投影.md §四；technical-details/RPC通道与设置页.md §六；DSR-006。

/**
 * 把 DSH 工作区列表投影为授权候选视图，供设置页逐项勾选。
 * 不含授权态：授权态来自 Config 快照（客户端草稿或 Host 当前值），本函数只给候选集，
 * 避免同一事实出现两个来源。
 * @param {Array<{path: string, title?: string}>} workspaces DSH 注册表的工作区列表
 * @returns {Array<{path: string, title: string}>} 候选视图，保持注册表顺序
 */
export function buildCatalog(workspaces) {
  const list = Array.isArray(workspaces) ? workspaces : []
  return list
    .filter((workspace) => isPlainObject(workspace) && typeof workspace.path === 'string' && workspace.path !== '')
    .map((workspace) => ({
      path: workspace.path,
      title: typeof workspace.title === 'string' && workspace.title !== ''
        ? workspace.title
        : lastSegment(workspace.path),
    }))
}

/**
 * 判断某候选路径是否被授权。
 * 只认显式 true：映射缺失、值非布尔、路径不在候选集内都视为未授权。
 * 这使 C-03（授权候选只来自工作区注册表）在读取侧机械成立——即使 Config 的
 * `authorized` 被手工塞入注册表外的键，也不会进入 profile 的授权根。
 * @param {unknown} authorized Config 的 authorized 字段
 * @param {string} path 候选路径
 * @returns {boolean} 已授权时为 true
 */
export function authorizationOf(authorized, path) {
  return isPlainObject(authorized) && authorized[path] === true
}

/**
 * 由候选集与存在性探测结果推导本次要写入 profile 的授权目录。
 * 不存在的目录必须剔除：codexpro 对不存在的授权根会直接拒绝启动（其 toRealDir 抛错）。
 * @param {Array<{path: string, exists: boolean}>} candidates 候选集（含存在性与授权态）
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
