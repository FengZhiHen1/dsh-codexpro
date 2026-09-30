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

| 端点 | 用途 | 请求载荷 | 响应 `value` |
|------|------|----------|--------------|
| `catalog` | 取候选工作区与当前授权状态 | `{}` | `{ workspaces: [{ path, title, exists, authorized }], dataHome, profilePath, anchorDir }` |
| `setAuthorization` | 设定授权集 | `{ authorized: <Record<string, boolean>> }` | `{ written: boolean, allowedRoots: string[], skipped: [{ path, reason }] }` |
| `status` | 进程状态与展示信息 | `{}` | `{ state, port, url, token?, health, lastError }` |
| `start` | 启动进程 | `{}` | `{ state }` |
| `stop` | 停止进程 | `{}` | `{ state }` |
| `configure` | 设定 tunnel / port / 模式 | `{ tunnelMode?, tunnelHostname?, port?, bashMode?, writeMode? }` | `{ config }` |

**端点与配置面的分工**：`configure` 与 `setAuthorization` 写入的是同一份 Cordis `Config`（经 `ctx.settings.update`）。保留 `configure` 而非让 Client 直接调 `configForms.mutate` 的原因：这五个字段需要**跨字段校验**（具名 tunnel 必须带 hostname、port 范围），且 port/tunnel 变更需要重建 profile；集中在一处 Host 逻辑比在 Client 侧拼 `mutate` 操作序列更少分支。

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
| `summary` | 一行状态摘要：进程状态 + 已授权工作区数 |
| `page` | 完整配置页，三个区（见下） |

### 页面三区

1. **进程控制**：状态徽标（`StateDot`）、启动/停止按钮、Server URL 展示与复制、健康信息。
2. **授权工作区**：候选列表，每项 `Checkbox` + 工作区标题 + 路径；目录不存在的项标注不可用且禁用；底部保存按钮。
3. **参数**：tunnel 方式（`SegmentedControl` 或 `Switch` 组）、hostname 输入（仅具名 tunnel 时启用）、port 输入、bash 模式与写入模式选择。

### UI 原语与 token

全部原语来自 `@deepseek-ai/dsh-client-ui-primitives`（已确认本代导出含 `Button`、`Checkbox`、`StateDot`、`Tag`、`Switch`、`SegmentedControl`、`SettingsForm`、`SettingsFormModel`）。

- 表单骨架与「暂存 → 保存 → 丢弃」语义由官方 `SettingsForm` / `SettingsFormModel` 承担，**不自写草稿状态机**。
- 颜色与几何只用宿主 token：`--dsw-alias-*`、`--dsw-radius-*`（六档）、`--dsw-elevation-*`。禁止 off-scale 字面量。
- `Button` 默认 `variant` 为 `ghost`；主动作须显式传 `primary`。
- 图标名称为 size-neutral 形式（如 `IconSettingsOutlineMedium`）。取用方式须能容忍图标缺失（动态取用 + 类型判定 + 文本回退），避免整卡渲染失败。

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
