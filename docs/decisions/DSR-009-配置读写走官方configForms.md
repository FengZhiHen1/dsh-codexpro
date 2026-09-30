# DSR-009：配置读写改走官方 configForms

> **决定**：插件的全部配置字段（授权集与五个参数）读写一律经官方 `configForms` + `SettingsFormModel`，本插件不再自建表单与配置端点。配置页保留在侧栏插件页的 `plugins.row.config`，不自带卡片壳与页签栏。进程启停仍走本插件的 RPC 端点。
> **理由**：官方在 v0.1.7 把插件配置的编辑入口从 Settings 迁到侧栏 Plugins 页，并明确 `plugins.item` 为官方设置页专属、第三方 bundle 的配置应注册 `plugins.bundle.config`/`plugins.row.config`。「官方配置方式」= Config 的 volatile 字段 + `configForms` + `SettingsFormModel`；自建草稿模型会与官方形态脱节（外观、revision 围栏、离开页面丢弃语义都不一致）。
> **被否决项**：把配置页搬进设置页（`settings.section`）；保留自建表单但换位置；把启停也塞进 configForms。

## 上下文

本插件最初（DSR-005 时期）自建了整套配置表单：`use-config.js` 维护 `authDraft`/`optionDraft` 双草稿、`SaveBar` 渲染保存条、`setAuthorization`/`configure` 两个 RPC 端点承担写入。当时依据的是「配置写入需跨字段校验 + 需重建 profile」这一理由。

2026-09-30 复核官方源码后确认三件事，推翻了上述理由：

1. **官方在 v0.1.7 把插件配置入口从设置页迁到了侧栏 Plugins 页**（`ui-plugin-manager/README.md:12`：*"A plugin that registers a configuration page is edited here, on its own page; Settings keeps the read-only inventory."*）。旧 slot `settings.plugin.item` 已删除，注册即抛错。
2. **官方明确规定第三方 bundle 的配置位置**（`ui-plugin-manager/src/client/slot-contract.ts:84-86`）：`plugins.item` 是官方设置页专属（标注 **OCCUPIED**），*"a bundle's configuration belongs in `plugins.bundle.config` or `plugins.row.config` instead"*。
3. **对象值可以经官方 configForms 承载**（反证见本仓库 `dsh-guardrails/src/adapter/host.js:78`：`z.union([z.boolean(), leafObject(keys)]).default(true).volatile()`），故「授权映射结构特殊、只能自建」不成立。

同时确认官方表单模型的完整能力（`ui-primitives/src/settings-form/form-model.ts`）：草稿暂存、revision 围栏、保存后回读、离开页面丢弃、`overridden`/`invalid` 判定全部由 `SettingsFormModel` 承担，插件侧只需给出字段规格（`SettingsFieldSpec[]`）。

## 真实方向及评价

| 方向 | 与官方口径一致性 | 代价 | 结论 |
|------|------------------|------|------|
| A. 保留自建表单，只换位置到 `settings.section` | ✗ 逆着官方迁移方向；设置页与插件页职责混淆 | 小 | 否决 |
| B. 位置不变（`plugins.row.config`）+ 改用官方 `configForms`/`SettingsFormModel` | ✓ 位置与机制都合官方口径 | 中（须改 Host 端点面与 Client 表单） | **采用** |
| C. 位置不变 + 保留自建草稿、仅复用官方 `SettingsForm` 外观 | △ 半官方：外观一致但 revision 围栏与丢弃语义仍自建 | 小 | 否决 |
| D. 改注册到 `plugins.item` | ✗ 该 slot 为官方设置页专属、已被占用 | 大 | 否决 |

## 采用方案的关键取舍

### 1. 授权集作为一个 JSON 文本字段承载

官方字段原语只有文本（`SettingsValueField`）与 write-only 密钥（`SettingsSecretField`），**没有布尔控件**（`knowledge/client/15` §4）。授权集是「路径 → 布尔」映射，用户交互是逐项勾选。

做法：把整份映射序列化为一个草稿字段（`authorized`），复选框点击只 `edit(AUTHORIZED, JSON.stringify(mapped))`，**不发请求**；点官方「保存」时由 `SettingsFormModel` 一次性 `mutate`。这与 `dsh-guardrails` 处理 category 叶子集的做法同一手法。

两个细节：
- `format` 对键排序——官方以「草稿文本 === `format(当前值)`」判断某项是否待写，排序使同一集合总有同一文本，否则键序不同会被误判为「有改动」。
- 空集合表达为 `{ kind: 'clear' }` 而非 `{ kind: 'set', value: {} }`——回落 Host 默认值，避免 profile patch 里累积空对象。

### 2. 端点面收敛为四个

`setAuthorization` 与 `configure` 删除，只保留 `catalog`/`status`/`start`/`stop`。理由：启停是瞬时动作（无可序列化的配置值、无「保存」语义），`revision` 围栏管的是配置文档、管不了「进程是否真的起来了」。`catalog` 仍返回授权态与参数值，但**只读**——让客户端在官方表单快照尚未就绪时能渲染可读内容。

### 3. 配置变更经 `loader/volatile-update` 投影到磁盘

配置写入 volatile 字段后，磁盘上的 profile 文件必须跟随，否则会出现「设置页显示已改、codexpro 实际按旧值跑」。官方为这类需求提供 instance-local 事件 `loader/volatile-update`（`knowledge/host/07` §2；参考实现 `packages/llm/llm-deepseek/src/host.ts:41`）。

- 挂载期不触发（首次投影由 `start` 负责）。
- 投影失败只告警不抛出：设置写入本身已成功，回滚它会让用户在设置页看到与自己操作相反的结果。

### 4. Schema 与 profile 形状均未变更

`authorized` 仍是 `Schema.dict(Schema.boolean()).volatile()`，profile 文件形状不变。本次重构只换读写通道与客户端表单，不动数据模型——这使改动可逆且不触发用户的配置迁移。

## 后果

- **正面**：与官方形态一致（外观、草稿语义、revision 围栏、离开页面丢弃）；Host 侧少两个端点与整套跨字段写入编排；客户端少一套自建草稿模型。
- **负面**：依赖 `loader/volatile-update` 与 `ctx.configForms` 两个官方面；若上游改名或移除该事件，投影链路会静默失效（表现为「改了配置但 codexpro 没变」）。**重访条件**：升级 DSH 基线时须复核该事件与 `ConfigForm` 方法签名。
- **遗留**：`anchorDir` 仍为非 volatile（部署事实），故不出现在设置页——见 T-07。

## 被删除的代码

- `src/client/use-config.js`（自建草稿模型）与其测试 `test/use-config.test.mjs`。其中有价值的回归（「启动失败原因必须对用户可见，不被刷新清除」）已迁移到 `test/use-process.test.mjs`。
