# dsh-codexpro

在 DSH 设置页管理 CodexPro：把 DSH 的工作区清单作为唯一授权来源同步到 codexpro 的 profile，并托管其进程启停与 tunnel 方式。

## 解决什么

CodexPro 是本地 MCP server，让具备自定义 MCP 权限的 ChatGPT 会话读写你明确允许的本地仓库。它的配置按目录组织，原本每换一个项目都要进该目录重跑一次交互式向导，且授权清单与 DSH 的工作区清单是两份互不知情的账。本插件把这两件事收进 DSH 设置页。

## 能力面

| 面 | 说明 |
|---|---|
| 授权工作区 | 设置页列出当前 DSH 实例的工作区，逐项勾选即授权；勾选变更自动写入 codexpro profile，无需在终端执行命令 |
| 进程托管 | 面板内启动/停止，状态实时呈现（未运行 / 启动中 / 运行中 / 停止中 / 启动失败）；进程随 DSH 实例结束而终止 |
| Server URL | 运行中时呈现可复制的连接器地址，含 token |
| Tunnel 方式 | 可选 `none` / `ngrok` / `cloudflare` / `cloudflare-named` / `tailscale`；首次默认 `none`（不产生公网入口） |
| 参数 | 本地端口、bash 模式（`off`/`safe`/`full`）、写入模式（`off`/`handoff`/`workspace`） |

**不提供模型可见工具**：全部操作经设置页由人完成。启停会改变本机的公网暴露状态，不交给模型自主触发。

## 安装

```
dsh plugin --profile web add github:FengZhiHen1/dsh-codexpro
```

试验 profile 可直挂源码：`dsh plugin --profile test add link:./plugins/dsh-codexpro`。

前置条件：已全局安装 `codexpro`（`npm install -g codexpro`）。插件在启动进程前解析其 CLI 入口，未安装时给出可行动的报错。

## 结构

```
src/core/      纯领域逻辑（禁 @deepseek-ai/*，裸 node 可单测）
src/adapter/   DSH 适配层（入口、配置、写盘、进程、健康探测、RPC 通道）
src/client/    浏览器半区（设置页卡片，esbuild → dist/client.js 产物提交进库）
docs/          需求/技术设计/决策记录（本插件的设计权威）
test/          node:test 单测
```

## 开发

```
pnpm install
pnpm run check          # 产物新鲜度 + 分层门禁 + 单测
node build-client.mjs   # 改 client 后重建 dist/client.js（产物必须提交）
```

## 行为边界

- **单向同步**：本插件是配置唯一事实源。终端用 `codexpro settings set` 对同一 profile 的改动会在下次同步时被覆盖。
- **数据目录独立**：本插件用 `<$DSH_HOME>/codexpro`，与终端手工使用的 `~/.codexpro` 互不互通。这样多个 DSH 实例不会共用配置与端口。
- **参数改动需重启进程才生效**：codexpro 自身亦是此语义（它写盘后提示重启）。
- **不是沙箱**：授权一个目录即允许 ChatGPT 在其中读写并执行受控命令，受 codexpro 的 bash 模式与内建路径黑名单约束，不受 DSH 沙箱约束。

## 平台支持

**当前仅在 Windows + DSH `0.1.7-rc.2` 上实测通过**。实现按可移植标准编写（平台相关行为隔离在可执行入口解析处），但 macOS/Linux 未经实测，故不声称支持。

## 许可

MIT
