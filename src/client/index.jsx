// index — Client 入口：注册配置页文案，并把本行配置页注册进 plugins.row.config。
//
// 边界：宿主加载的是 dist/client.js 产物；本文件导出 inject 与 apply 两项。
// 槽位：`plugins.row.config`（keyed），key = `<包名>#<行 id>`，该行因此多出「配置」入口。
// 位置依据（官方）：`plugins.item` 是官方设置页专属（slot-contract.ts 标注 OCCUPIED），
// 第三方 bundle 的行配置应注册 `plugins.bundle.config` 或 `plugins.row.config`。
// 配置读写走官方 `configForms`（Config 的 volatile 字段 + profile patch 持久化），
// 草稿/revision 围栏/保存后回读归本地复制的 SettingsFormModel（见 form.js）。
// 注册只在 Host 服务该命名空间期间存活：未挂本行的部署不在插件页留下痕迹。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md；DSR-009、DSR-010。

import { CONFIG_NS, ROW_CONFIG_KEY } from '../core/config-fields.js'
import { createCall } from './api.js'
import { CodexProCard } from './card.jsx'
import { createController } from './form.js'
import { NS, en, zh } from './locales.js'

// 客户端 remote 命名空间按 traced service 暴露，取属性前必须在 inject 里声明，
// 否则运行时抛 cannot get property "..." without inject。
export const inject = ['slots', 'locale', 'configForms', 'connection']

/**
 * Client apply：注册配置页文案与槽位。
 * @param {object} ctx Client 插件上下文
 * @returns {void}
 */
export function apply(ctx) {
  // 调用门面在 apply 期建好并注入，组件不接触 ctx（与既有插件的接线形态一致）。
  const call = createCall(ctx)
  // 官方 ConfigForm：含 getSnapshot / subscribe / mutate 三件套，是 SettingsFormModel
  // 所需的 scope。注意不能用插件页传进 entry 的 `form` prop——那是一次性快照
  // （{ state, mutate }），没有 subscribe，草稿模型无法在 Host 侧变更时重建投影。
  const scope = ctx.configForms.get(CONFIG_NS)
  const controller = createController(scope)

  // 配置页内部文案走 Client locale 通道；bundle 级 locale/*.json 只供 Plugins 页展示。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-codexpro: settings dictionaries')

  // 表单模型订阅了 Host 快照，须随本 fiber 释放。
  ctx.effect(() => () => controller.form.dispose(), 'dsh-codexpro: settings form model')

  // 只在 Host 服务该命名空间期间注册：未挂本行（或行被禁用）的 profile 不留痕迹。
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () =>
    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.row.config',
          key: ROW_CONFIG_KEY,
          locale: NS,
          inject: () => ({ call, ...controller.inject() }),
        },
        CodexProCard,
      ),
    )), 'dsh-codexpro: row config slot')
}
