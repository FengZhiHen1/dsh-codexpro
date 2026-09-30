# RPC 通道与设置页

## 权威范围

本文唯一拥有 Client↔Host 的传输契约（通道形态、端点清单、信封与错误语义）与设置页在 DSH 插件页的接入方式（slot、key、视图分发、UI 原语）。机制性的状态与配置语义归 `配置与profile投影.md` 与 `进程管理.md`。

## 一、传输形态

**固定使用 `/api` 精确 Fetch 路由**，经 `ctx.connection.fetch.register` 注册。**不使用** `connection.rpc.handle`——该 API 在生产 web 组合下无法注册任何自定义 channel（失败点在 connection 服务自身的 context 上，表现为插件行仍 `active` 但浏览器一律 405）。该结论及其消融证据见仓库级决策记录 `docs/decisions/0002-自定义RPC通道改用精确Fetch路由.md`。

选择 `fetch.register` 的理由：其注册路径只写内部 Map、不读 `owner.webServer`，且注册的路由由 `connection` 自己正确挂载的 `/api` 前缀路由承载，因此**免费继承**平台的 Host/Origin 围栏（403）、浏览器认证（401）、`connection/request` waterfall、请求体上限（413）与背压。插件侧不自持任何安全围栏。

### 约束

| 项 | 取值 |
|----|------|
| 前缀 | `/api`（平台强制；`assertFetchRoute` 要求路径在其之下） |
| 命名空间 | `codexpro` |
| 路径 | `/api/codexpro/<endpoint>` |
| 方法 | 仅 `POST` |
| 匹配 | **按完整 pathname 精确匹配**，因此每个端点注册一条路由 |
| 请求体 | `buffered` |
| 端点段文法 | `^[A-Za-z0-9_$.-]+$`，各段非空、非 `.`/`..` |

### 降级

`connection.fetch.register` 不可用时（非 web 载体）**安静降级**：不注册、不抛错、不使插件行 PENDING。插件其余功能（配置同步）照常。

## 二、端点清单

> **通道分工（2026-09-30 重构）**：**配置读写不走本通道**——授权集与五个参数字段是插件行 Cordis `Config` 的 volatile 字段，读写一律经官方 `configForms`（`ConfigForm.getSnapshot/subscribe/mutate`），草稿暂存、revision 围栏、保存后回读、离开页面丢弃全部归官方 `SettingsFormModel`。
> 本通道只保留**进程动作**与**Host 侧探测**：启停是瞬时动作（无可序列化的配置值、无「保存」语义，revision 围栏管不了「进程是否真的起来了」），候选工作区的目录存在性探测需要 Host 文件系统访问。

| 端点 | 用途 | 请求载荷 | 响应 `value` |
|------|------|----------|--------------|
| `catalog` | 取候选工作区、目录存在性、当前授权态与参数值 | `{}` | `{ workspaces: [{ path, title, exists, authorized }], dataHome, anchorDir, tunnelMode, tunnelHostname, port, bashMode, writeMode }` |
| `status` | 进程状态与展示信息 | `{}` | `{ state, port, tunnel, token?, url, health, lastError, anchorDir }` |
| `start` | 启动进程 | `{}` | `{ state, written, allowedRoots }` |
| `stop` | 停止进程 | `{}` | `{ state }` |

**`catalog` 的授权态与参数值是只读投影**：它们让客户端在官方表单快照尚未就绪时仍能渲染出可读内容；**写入一律以 `configForms` 为准**，本端点不接收任何写请求。

### 配置变更如何投影到磁盘

配置经官方 `configForms` 写入 volatile 字段后，平台派发 **`loader/volatile-update`**（instance-local）到本行；Host 侧监听该事件并调用 `syncFromConfig()` 重新生成 profile 文件。这是「设置页显示已改」与「codexpro 实际按新值跑」之间的唯一连接点——不跟随就会出现二者不一致。

- 挂载期**不触发**投影：首次投影由 `start` 端点负责，避免无谓 IO 与半成品文件。
- 投影失败**只告警不抛出**：设置写入本身已成功，回滚它会让用户在设置页看到与自己操作相反的结果。

### `status.token` 的暴露边界

`status` 返回 token **仅为了拼接 Server URL 展示**（R-04）。这是 token 唯一允许离开 Host 的通道，且：

- 该端点经平台认证层保护（未认证请求在到达 handler 前已被 401 拒绝），只有已登录本机 DSH 的浏览器会话可读；
- token 不得进入任何日志、错误消息或持久化位置（S-01）；
- Client 侧仅用于展示与复制，不落 localStorage。

## 三、信封契约

平台对 `fetch` 路由不做信封处理（那是 `rpc.handle` 的行为），因此信封由插件两侧自行承担。沿用本项目既有形态：

**请求**（Client → Host）：

```json
{ "type": "client-request", "rpcId": "<string>", "method": "codexpro/<endpoint>", "payload": { } }
```

**响应**（Host → Client）：

```json
{ "type": "server-response", "rpcId": "<string>", "result": { "ok": true, "value": { } } }
```

失败时 `result` 为 `{ ok: false, error: { code, message } }`。

### 入站校验（Host 侧，按序）

| 条件 | 响应 |
|------|------|
| 方法非 `POST` | 404 |
| `content-type` 非 `application/json` | 415 |
| 请求体非合法 JSON | 400 |
| 信封缺 `type`/`rpcId`/`method`，或 `method` 与路径不一致 | 400 |
| 端点不在清单内 | 404（不注册该路由，由平台回落） |

业务失败一律走 `result.ok === false`，**用 HTTP 200 承载**；HTTP 错误码只表达契约面问题。这与平台既有语义一致。

### 错误码

| 码 | 含义 |
|----|------|
| `INVALID_CONFIG` | 跨字段校验失败（具名 tunnel 无 hostname、port 越界） |
| `CONFIG_WRITE_FAILED` | profile 文件写入失败 |
| `NOT_FOUND` | 工作区不在注册表 |
| `ALREADY_RUNNING` | 已处于 `starting`/`running`/`stopping` |
| `NOT_RUNNING` | `idle` 状态下请求 stop |
| `SPAWN_FAILED` | 可执行解析失败或 spawn 失败 |
| `START_FAILED` | 就绪超时或进程提前退出 |
| `STOP_FAILED` | 终止后范围未在宽限期内清空 |
| `UNSUPPORTED` | 非 web 载体（路由不可用） |

## 四、Client 侧调用

```js
const result = await ctx.connection.rpc.call('/api', 'codexpro/status', {}, signal)
```

- 通道参数恒为 `'/api'`，端点参数为 `'codexpro/<endpoint>'`。
- 传输层失败（401/403/405/断连）由 `rpc.call` **抛出**，调用方须自行捕获并归一为可读错误。
- `result.ok === false` 不抛出，按业务错误处理。

## 五、设置页接入

### slot 与 key

注册进 **`plugins.row.config`**（keyed 槽位），key 必须**逐字**等于：

```
`<package.json 的 name>#<cordis.patch.yml 中 insert 行的 id>`
= `dsh-codexpro#codexpro`
```

两段均须与源文件一致。任一段不匹配时，该行**不出现「配置」控件且无任何报错**（静默缺失）。因此这两段由单一常量收口，并在单测中与 `package.json`、`cordis.patch.yml` 的实际内容比对。

**不使用 `plugins.item`**：那个位置语义上属于官方设置页（一个 host 平面命名空间一个 companion 包），第三方注册虽不报错但会与官方卡片并列。`plugins.row.config` 是本插件诉求的天然位置——它免费提供该行的「配置」入口、面包屑与行标题。

**不使用已删除的 `settings.plugin.item`**：该 slot 在本代已删除。直接 `register` 会抛 `slot "..." is not declared`；若包在 `slots.inject` 中则**静默永不执行**——两种形态都不可用。

### 注册形态

以 `ctx.configForms.whileServed([NS], ...)` 包裹：Host 服务该命名空间期间注册，停止服务即撤下。调用方持有 disposer 并置于 `ctx.effect` 内。

### 视图分发

槽位组件按 `view` 呈现两种形态：

| view | 内容 |
|------|------|
| `summary` | 一行说明（该行没有包描述时用作行页面的说明文字） |
| `page` | 配置页主体：进程区块 + 官方配置表单 |

### 页面构成

**官方规范**：页面的行标题、图标、面包屑由 Plugins 页自绘（`PluginManagerPage.tsx:462-499`），配置页这一侧**不自带卡片壳、不自带标题、不自带页签栏**——官方 `SettingsForm` 自带保存栏（参考实现 `ui-settings-shell/src/client/ShellCard.tsx`，全文 55 行）。

页面自上而下两部分：

1. **进程区块**（自建 `<section>`）：状态徽标、启动/停止/刷新状态按钮、Server URL 展示、失败原因。这是页内唯一不走官方表单的部分——启停是瞬时动作，没有可序列化的配置值，也没有「保存」语义。
2. **配置表单**（官方 `SettingsForm` + `SettingsFormModel`）：按顺序为 tunnel 方式、公网 hostname（仅具名 tunnel 时出现）、本地端口、bash 模式、写入模式、授权工作区。

### 字段控件

官方字段原语只有文本（`SettingsValueField`）与 write-only 密钥（`SettingsSecretField`），**没有 select、没有布尔控件**（`knowledge/client/15` §4）。故：

| 字段 | 控件 | 草稿机制 |
|------|------|----------|
| tunnelMode / bashMode / writeMode | 自绘 `<select>` | 官方 `edit(field, text)` |
| tunnelHostname / port | 官方同构的 `<input>`（自绘以复现官方几何） | 官方 `edit(field, text)` |
| authorized | **自绘 `Checkbox` 列表** | 点击把整份映射序列化后 `edit('authorized', json)` |

关键点：自绘控件**只报告用户意图**，不自行写盘；草稿暂存与写入仍走官方模型。这与 `dsh-guardrails` 处理叶子集复选框的做法一致。

### UI 原语与 token

原语来自 `@deepseek-ai/dsh-client-ui-primitives`（本代导出含 `SettingsForm`、`SettingsFormModel`、`SettingsValueField`、`Checkbox`、`Tag`、`Button`）。

- 表单骨架与「暂存 → 保存 → 丢弃」语义由官方 `SettingsForm` / `SettingsFormModel` 承担，**不自写草稿状态机**。
- 颜色与几何只用宿主 token：`--dsw-alias-*`、`--dsw-radius-*`（六档）、`--dsw-elevation-*`。禁止 off-scale 字面量。
- 中性实线边框一律 `0.5px`（官方规范）；半径走 token，不用离格字面量。
- 全圆胶囊（状态徽标）必须成对声明 `border-radius: 999px` + `corner-shape: round`：宿主 `corner-shape.css` 用通配选择器把所有圆角统一为 `superellipse(1.5)`，缺此声明会把胶囊两端压成方角（官方 `Pill`/`Tag` 同样成对声明）。
- `Checkbox` 禁用时必须给出可见禁用态（`opacity` + `cursor`），不得只设 `disabled` 属性而不写视觉态。
- 页签形态（若将来需要）应使用官方 `SegmentedTabs` 或对齐 `ui-settings-plugins` 的下划线写法，不自绘。

## 六、失败语义

| 失败 | UI 呈现 |
|------|---------|
| 传输层失败（401/403/405） | 页面级错误条，含来源端点与状态码；不静默 |
| 业务错误 | 就地错误提示，保留用户已填内容 |
| `UNSUPPORTED` | 页面提示「当前载体不支持配置页」，其余区只读 |
| 状态轮询失败 | 状态徽标转为「未知」并附最近一次成功时间，不谎报运行中 |

## 七、不变量

1. Client 不直接读写文件；一切经 RPC。
2. token 不在 Client 侧持久化。
3. 端点集合与 Host `dispatch` 认可集合同源（同一常量），避免注册了却拒绝派发。
4. 槽位组件必须能在 `summary` 与 `page` 两种 view 下工作，且均不抛错。

## 八、验证方式

| 验收 | 方法 |
|------|------|
| AC-10 | 打开侧栏插件页，本行出现「配置」控件；DevTools Console 无 `slot entry crashed` |
| 路由已挂载 | 未认证 `POST /api/codexpro/status` 返回 401（而非 405），认证后返回 200 |
| 契约面 | 虚构端点返回 404；非法信封 400；`content-type` 非 JSON 415 |
| 降级 | 非 web 载体下不注册且插件行不 PENDING |
