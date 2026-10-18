# DSR-010：适配 DSH 0.2.1，复制官方设置页实现并退出 Client 包依赖

> **决定**：本插件的运行基线升到 DSH `0.2.1-rc.2`。配置页不再 import 任何 Harness Client 包——官方 `SettingsForm`、`SettingsValueField`、`SettingsFormModel`、`Tag`、`Checkbox`、信息图标与 `Button` 的形态复制进本插件（`src/client/fields.jsx`、`settings-model.js`、`controls.jsx`、`styles.js`），类名统一 `cxp-` 前缀，样式只引用 `--dsw-alias-*` / `--dsw-radius-*` / `--dsw-focus-ring-*` token。配置页文案改走 Client locale 通道；包级 `locale/en.json`、`locale/zh.json` 与 `icon.svg` 补齐。版本号保持 `0.1.0`。
> **理由**：0.2.1 的插件纪律明确「不得 require 任何 Harness Client 包；`dsh.client.inject` 只排序激活」，这些包没有插件兼容承诺，变更无通知；复制实现是维持同构外观与行为的唯一稳定路径。同时 Plugins 页的行标题/简介改由包级 locale 元数据决定，缺资源会静默回退为模块名。
> **被否决项**：继续 import `@deepseek-ai/dsh-client-ui-primitives`；用 Host 页面 + iframe 承载配置页（拿不到主题与 locale）；只改依赖版本而不复制实现。

## 上下文

0.1.7 时期本插件直接复用 `@deepseek-ai/dsh-client-ui-primitives` 的 `SettingsForm` / `SettingsFormModel`。0.2.1 复核确认三件事：

1. **Client 包不是插件可依赖面**：内置 `cordis-plugin-development` 的 `references/practices.md` 与 `verification.md` 明确要求插件复制控件与 CSS，`dsh.client.inject` 只用于激活顺序；违反时可能因内部实现变更直接让 slot entry 崩溃，而部署层无报错。
2. **行展示元数据改由包级 locale 决定**：`plugins.row.config` 的 key、`view` 分发与 `configForms` 三件套未变；行标题/简介来自 `meta.title` / `meta.description`（`packages/boot/app-boot/src/package-meta.ts`），缺失时回退到模块名/包描述，不报错。
3. **配置页文案走 Client locale**：可见文案由 Client 半区 `ctx.locale.register(<ns>, { zh, en })` 注册，slot 注册声明 `locale: <ns>` 后组件拿到 `t`；包级 `locale/*.json` 只供 Plugins 页展示，两条通道不可互换。

## 采用方案的关键取舍

### 1. 复制而不是依赖

- 复制 `SettingsForm` 的框架（不可用/只读/失败/保存键）与 `SettingsFormModel` 的草稿、revision 围栏、保存后回读、离开页面丢弃语义。
- 复制 `SettingsValueField` 的标签、hint、非法提示、覆盖 Tag、重置、info 展开与 `aria-controls` 关联。
- 复制 `Tag`、`Checkbox`、信息图标与 `Button` 的几何与禁用/焦点态；select 仍按官方没有原语的事实自写，但外框由 div 绘制（走查事故 2026-09-30）。
- `settings-model.js` 只保留本插件用到的字段路径与动作，不保留 secret 字段等未使用面。

### 2. 依赖面收敛

- `package.json` 移除 `@deepseek-ai/dsh-client-ui-*` 依赖；`dsh.client.inject` 只列真实 Client 模块的激活顺序：`ui-plugin-manager`（槽位声明）、`ui-settings`（`configForms`）、`connection`（RPC）、`locale`（文案）。`ui-slots` 是纯核心库、无 `dsh.client` 清单，不能作为排序项。
- 新增 `engines.dsh: ^0.2.1-rc.2`；Host 侧 peer 只保留 `dsh-settings` / `dsh-subprocess` / `dsh-workspace`。
- 构建脚本加入守卫：产物出现 `require("@deepseek-ai/dsh-client-…")` 即构建失败。

### 3. 展示资源与文案

- 包级 `locale/en.json`、`locale/zh.json` 的 `meta.title` / `meta.description` 写实际能力；`icon.svg` 为包内原创图形；`exports` 增加 `./locale/*.json` 与 `./icon`，`files` 同步。
- 配置页全部可见文案走 `settings.codexpro` 命名空间，中英词典键集一致；原先硬编码中文的字段标签、hint、帮助正文、进程状态与保存文案全部迁入。

### 4. 版本号

本次不新增能力面，也没有已发布发行版或外部消费者，故版本号保持 `0.1.0`；若后续发布，按 05 的版本线规则处理。

## 后果

- **正面**：配置页不再受 Client 包内部变更影响；行标题/简介与中英文案在 Plugins 页可读；样式只剩 token 依赖；构建期能机械拦住 Client 包引用回潮。
- **负面**：官方设置页形态的升级需要人工对照复制（本插件承担同步成本）；bundle 体积从约 30 KB 增至约 61 KB（未压缩）。
- **重访条件**：DSH 为插件提供稳定的表单原语包；`plugins.row.config` 的 props/view 契约变更；locale 元数据的字段或注册方式变更。

## 验证

- `node build-client.mjs --check`：产物新鲜且不含 Harness Client require。
- `node --test test/*.test.mjs`：154 项通过，覆盖 UI 规格、表单模型、进程竞态、locale 元数据与 bundle 纯净度。
- 0.2.1 运行期（test 实例，2026-10-18 实测）：
  - `evaluatePluginCompatibility(manifest, {}, '0.2.1-rc.2')` 返回空（兼容）。
  - Host `Config` inspect 返回 `include:codexpro` schema，`authorized` / `tunnelName` 等 volatile 字段与上限正确。
  - `readPluginMeta('dsh-codexpro', profile/package.json)` 返回中英标题、简介与 `data:image/svg+xml` 图标。
  - Client `plugins.row.config` 的 `dsh-codexpro#codexpro` occupant 为 active（bundle 已加载、apply 未抛）。
- 仍待人工走查：Plugins 页视觉（light/dark）与浏览器 Console 无 `slot entry crashed`（`TODO.md` T-11）。
