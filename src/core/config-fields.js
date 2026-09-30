// config-fields — 配置面与槽位键的单一事实源（Host 与 Client 两半侧共享）。
//
// 边界：只放常量，不放逻辑。key 的两段分别等于 package.json 的 name 与
// cordis.patch.yml 的 insert 行 id：任一段写错，该行不出现「配置」控件且无任何报错。
// 参考：technical-details/RPC通道与设置页.md §五。

/** 本插件 loader 行的 id，同时是设置命名空间。 */
export const CONFIG_NS = 'codexpro'

/** 包名（plugins.row.config 的 key 前段）。 */
export const PACKAGE_NAME = 'dsh-codexpro'

/** `plugins.row.config` 的 key = `<包名>#<行 id>`。 */
export const ROW_CONFIG_KEY = `${PACKAGE_NAME}#${CONFIG_NS}`
