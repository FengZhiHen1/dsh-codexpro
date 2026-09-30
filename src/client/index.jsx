// index — Client 入口：把本行配置卡注册进侧栏插件页的 plugins.row.config 槽位。
//
// 边界：宿主加载的是 dist/client.js 产物；本文件导出 inject 与 apply 两项。
// 槽位：`plugins.row.config`（keyed），key = `<包名>#<行 id>`，该行因此多出「配置」入口。
// 注册只在 Host 服务该命名空间期间存活；未挂本行的部署不在插件页留下痕迹。
// 参考：knowledge/client/15 §4；technical-details/RPC通道与设置页.md §五。

import { CONFIG_NS, ROW_CONFIG_KEY } from '../core/config-fields.js'
import { createCall } from './api.js'
import { CodexProCard } from './card.jsx'

// 客户端 remote 命名空间按 traced service 暴露，取属性前必须在 inject 里声明，
// 否则运行时抛 cannot get property "..." without inject。
export const inject = ['slots', 'configForms', 'connection']

/**
 * Client apply：注册配置卡槽位。
 * @param {object} ctx Client 插件上下文
 * @returns {void}
 */
export function apply(ctx) {
  // 调用门面在 apply 期建好并注入，组件不接触 ctx（与既有插件的接线形态一致）。
  const call = createCall(ctx)
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () =>
    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        { name: 'plugins.row.config', key: ROW_CONFIG_KEY, inject: () => ({ call }) },
        CodexProCard,
      ),
    )), 'dsh-codexpro: row config slot')
}
