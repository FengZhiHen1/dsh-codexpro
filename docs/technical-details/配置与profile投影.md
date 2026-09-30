# 配置与 profile 投影

## 权威范围

本文唯一拥有本插件的配置 schema 形状、codexpro profile 文件的生成规则与写入语义。进程生命周期归 `进程管理.md`；Client↔Host 传输归 `RPC通道与设置页.md`。需求语义归 `../需求.md`。

## 一、配置模型

配置真相是**本插件 loader 行的 Cordis `Config`**，持久化在该 profile 的 `cordis.patch.yml` 中本行 `config` 字段。所有可由用户在设置页修改的字段带 `.volatile()`；消费者通过 `ref.get()` 在操作时读取实时值。

### 字段表

| 字段 | 类型 | 默认值 | volatile | 说明 |
|------|------|--------|----------|------|
| `authorized` | `dict(boolean)` | `{}` | 是 | 授权映射：工作区 realpath → 是否授权 |
| `tunnelMode` | `string`（枚举） | `"none"` | 是 | `none` / `ngrok` / `cloudflare` / `cloudflare-named` / `tailscale` |
| `tunnelHostname` | `string` | `""` | 是 | 具名 tunnel 的公网 hostname；`tunnelMode` 为 `none`/`cloudflare` 时忽略 |
| `port` | `string` | `"8787"` | 是 | 本地监听端口（字符串形态，由 adapter 校验 1–65535） |
| `bashMode` | `string`（枚举） | `"safe"` | 是 | `off` / `safe` / `full` |
| `writeMode` | `string`（枚举） | `"workspace"` | 是 | `off` / `handoff` / `workspace`（R-07） |
| `httpToken` | `string` | `""`（首次启动时生成） | 是 | HTTP token；生成后稳定不变（C-07） |
| `anchorDir` | `string` | `""` | 否 | 锚点目录覆盖；空则用默认推导值。**非 volatile**：部署事实，经 profile patch 钉死 |

### volatile 形状的硬性约束

以下三条由 schemastery 实现决定（已实测）：

1. `.volatile()` 加在 **dict 节点本身**（`Schema.dict(Schema.boolean()).volatile()`），**不得**加在其值 schema 上（`Schema.dict(Schema.boolean().volatile())`）——后者抛 `volatile fields require a fixed object path without an enclosing volatile field`。
2. volatile **不可嵌套**：任何字段的祖先链上不得再出现 `.volatile()`。
3. 只有 volatile 字段可写；设置表单对非 volatile 路径的写入**直接抛错**，且非 volatile 字段不出现在设置页。

`authorized` 用 `dict(boolean)` 而非 `array(string)` 的理由：工作区的**取消授权**必须能与「尚未见过的新工作区」区分开。若用数组，移除一项后下次同步无法判断它是「用户取消」还是「新出现但还没勾」；映射形式让两者天然分离——键存在且为 `false` 即「明确取消」，键缺席即「未表态」。

### 校验规则

| 规则 | 处置 |
|------|------|
| `port` 非 1–65535 整数 | 拒绝保存，状态面报可读原因 |
| `tunnelMode` 为具名 tunnel 且 `tunnelHostname` 为空 | 拒绝保存（codexpro 亦要求 hostname） |
| `writeMode` 非 `off`/`handoff`/`workspace` | 拒绝保存 |
| `bashMode` 非 `off`/`safe`/`full` | 拒绝保存 |

校验在挂载期与 `internal/config` waterfall 两处执行，与仓库既有插件同构。

## 二、锚点与数据目录

| 概念 | 取值 | 稳定性 |
|------|------|--------|
| dataHome（`CODEXPRO_HOME`） | `<$DSH_HOME>/codexpro` | 与实例绑定 |
| 锚点目录（`--root`） | `<$DSH_HOME>/codexpro/anchor`（`anchorDir` 非空时用其值） | 与勾选集无关，永不漂移 |

**锚点的作用与代价**：codexpro profile 文件名是 `sha256(realpath(root)).slice(0,24)`。锚点若随授权集变化，则每改一次勾选就换一个 profile 文件，旧文件残留、配置漂移。故锚点取固定目录。

代价是 `open_current_workspace`（ChatGPT 的「回到主项目」）落在锚点目录而非真实项目；实际使用靠 `open_workspace` 选择已授权项目。锚点目录由插件在首次同步时创建（`mkdir` recursive）。

## 三、profile 文件生成

### 身份推导

```
profileId  = sha256(realpath(anchorDir)).slice(0, 24)
profilePath = <dataHome>/profiles/<profileId>.json
```

`realpath` 归一必须用 `fs.realpathSync.native`。**这是承重一致性**：codexpro 自身对 CLI 传入的 root 做同样的归一（其 `realDir()` 内部即 `realpathSync.native`），两侧必须一致，否则算出不同文件名。

### payload 形状

```json
{
  "version": 1,
  "root": "<realpath(anchorDir)>",
  "updatedAt": "<ISO-8601>",
  "port": "8787",
  "mode": "agent",
  "tunnel": "none",
  "bash": "safe",
  "write": "workspace",
  "token": "<httpToken>",
  "allowedRoots": ["<realpath(workspace-a)>", "<realpath(workspace-b)>"]
}
```

字段写入规则（对齐 codexpro 的 profile 语义）：

- `mode` 恒为 `"agent"`（非目标：不支持 `handoff` / `pro`）。
- `tunnel` 取 `tunnelMode`；非 `none` 时额外写入 `hostname`（具名 tunnel）与对应 tunnel 配置键。
- `allowedRoots`：仅包含 `authorized` 中值为 `true` 的项，经 realpath 归一、去重、按字典序排序（排序保证同输入产生逐字节相同文件，便于比对与幂等）。
- `bash` / `write` 仅在取值非 codexpro 默认（`safe` / `workspace`）时写入——与 codexpro 自身 `saveSettingsFromArgs` 的省略规则一致。
- `token` 为空时不写入该键。

### 写入语义

- 全包唯一持久写出口（`adapter/profile-writer.js`）。
- **原子写**：先写同目录临时文件，再 `rename` 覆盖；避免 codexpro 读到半截 JSON。
- 目录权限沿用 codexpro 约定（目录 `0700`、文件 `0600`）。
- **幂等**：内容与目标一致时不写盘（比对序列化结果），避免无谓的 mtime 变化。
- **不写不存在的授权根**：`allowedRoots` 中每一项在写入前校验目录存在；不存在则从待写集剔除并在状态面呈现原因。若不校验，codexpro 启动时会因 `toRealDir` 抛 `Directory does not exist` 而整体失败（C-09）。

### 单向同步

插件是配置唯一事实源（C-02）。同步时机：授权集变更、tunnel/port/模式变更、进程启动前。**不读回 codexpro 侧的手工改动**，也不展示差异。

同步失败时状态面呈现原因，且**不启动进程**（配置不正确时启动必然失败）。

## 四、candidate 集推导

```
候选集 = ctx.workspaceRegistry.list()
        .map(w => ({ path: w.path, title: w.title, authorized: authorized[w.path] === true, exists: <目录当前存在> }))
```

- `w.path` 已是 realpath 归一值（DSH 保证 `Workspace.path` 是 `fs.realpath` 结果且此后再不重写），因此无需二次归一。
- `exists` 为 `false` 的项在状态面标注为不可用，且**不进入 `allowedRoots`**。
- 候选集排序按 DSH 注册表顺序（`workspaceIds` 的既有顺序）呈现，不另行排序。

## 五、不变量

1. `allowedRoots` 中每一项都必须同时满足：存在于 DSH 工作区注册表、`authorized` 值为 `true`、目录当前存在。
2. 锚点目录与 `authorized` 无关；修改勾选不改变 `profilePath`。
3. `token` 一经非空便不再自动变更。
4. 删除 profile 文件不丢用户意图：由 `authorized` 等 `Config` 字段可完整重建。
5. 未在 DSH 工作区清单中的目录不得进入 `allowedRoots`（C-03 的机械保证）。
