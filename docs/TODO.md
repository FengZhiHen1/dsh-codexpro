# 待办与未决事项

本文件只登记**未完成**事项。事项解决后，结果就地写入拥有该事实的文档，并从本文件移除。

## 已完成实测（2026-09-30，隔离实测场）

以下曾列为 `missing evidence` 的项已取证，结论已写入拥有者文档，此处仅留索引：

| 原编号 | 结论 | 落点 |
|--------|------|------|
| T-01 | **stdin `q` 是唯一完整的优雅停止路径**（退出码 0、runtime 清理、tunnel 回收、端口释放）；`--headless` 会绕开它，故不采用 | DSR-007、`technical-details/进程管理.md` §五 |
| T-02 | **Windows 进程容器可用**：`probeWindowsJob()` 判定为真（`containmentMode = windows-job`），三层进程树父与孙同时终止 | DSR-008、`technical-details/进程管理.md` §五 |
| T-03 | 硬杀后 runtime 文件残留，但其 `pid` 与 `runtimePid` **均已不存活** ⇒ codexpro 下次读取会判为未运行并自行删除；插件无需介入 | `technical-details/进程管理.md` §五 |
| T-04 | 版本输出为纯语义化版本号（实测 `0.30.2`） | `技术栈设计.md` |

实测场为隔离的 `CODEXPRO_HOME` 与合成工作区（`%TEMP%` 下），未触碰真实 `~/.codexpro`（实测后确认其仍不存在）。探针脚本见 `tmp/codexpro-probe/`（仓库 `.gitignore` 已排除 `tmp/`）。

## 未决事项

| # | 事项 | 说明 |
|---|------|------|
| T-05 | **非 Windows 平台的支持声明** | 当前设计只声称 Windows + DSH `0.1.7-rc.2` 实测通过（`技术栈设计.md` §五）。macOS/Linux 的容器机制（`linux-scope`）、信号语义与路径行为均未取证；README 不得声称支持 |
| T-06 | **codexpro 后续版本的行为漂移** | 本设计锚定 `codexpro@0.30.2`。启动参数、profile 文件形状、`/healthz` 端点、非 TTY stdin 的 `q` 通道任一变更都可能使设计失效；实现需做版本探测并在不符时提示 |
| T-07 | **`anchorDir` 是否应暴露到设置页** | 当前为非 volatile（部署事实，经 profile patch 钉死），故不出现在设置页。若需频繁更换锚点，需重新评估 |

## 实现阶段的门禁（执行时逐项核对）

- 发布前置门禁：`dsh --profile test` 启动无 `N entries did not activate`、无 `N required plugin[s] did not activate`；功能冒烟见 `需求.md` AC 表。
- 分层门禁：`node tools/plugin-layering-check.mjs plugins/dsh-codexpro` 全绿。
- 产物新鲜度：`node build-client.mjs --check` 通过。
- `--dump-config` 人工核对：本插件为单一行，来源正确，无重复 id（本代无机械闸门兜底）。
- 停止路径实现须与 DSR-007 的顺序一致（`q` → 等待 → `terminate()` 兜底），且 `stdio.stdin` 必须为 `'pipe'`。

## 待人工走查的验收项

| # | 验收 | 说明 |
|---|------|------|
| T-08 | AC-04 页面级走查 | Server URL 在 ChatGPT 连接器建连需人工在浏览器完成，无法由自动化替代 |
| T-09 | AC-10 UI 走查 | 侧栏插件页「配置」控件出现且 DevTools Console 无 `slot entry crashed`；该崩溃路径无部署层报错 |
| T-10 | AC-06 实例退出后残留检测 | 需真实关闭再打开 DSH 实例，属用户操作 |
