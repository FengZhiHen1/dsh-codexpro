# 待办与未决事项

本文件只登记**未完成**事项。事项解决后，结果就地写入拥有该事实的文档，并从本文件移除。

## 阻塞实现的实测项

以下四项在实现定型前必须获得实测证据。前三项属 `missing evidence`，不得在文档或代码中当作已确认事实。

| # | 事项 | 影响 | 需要的证据 |
|---|------|------|------------|
| T-01 | **codexpro 的优雅停止路径** | 决定 `adapter/process.js` 终止入口的主路径与降级顺序（`technical-details/进程管理.md` §五） | 在 `test` 实例中实测：向 stdin 写 `q` 是否触发其 `cleanup()`（进程退出码 0、runtime 文件被删、tunnel 子进程消失、端口释放） |
| T-02 | **`ctx.subprocess` 的 Windows 进程容器是否在本机激活** | 决定「整树终止」是否成立；不成立则须补充残留检测与提示 | 观察 subprocess 本地实现的启动日志是否有 fallback 告警；实测 DSH 退出后 codexpro 家族是否全部终止 |
| T-03 | **父进程被硬杀后 runtime 文件的残留形态** | 决定 `technical-details/进程管理.md` §七「不使用 runtime 文件判断状态」的边界说明是否需补充提示文案 | 硬杀 CLI 父进程后，读 `runtime/<hash>.json` 并复刻其 stale 清理逻辑的判定结果 |
| T-04 | **codexpro 版本探测的确切输出** | 决定实现中版本区间校验的解析方式 | 确认 `--version` 输出格式（当前实测为纯版本号 `0.30.2`） |

## 未决事项

| # | 事项 | 说明 |
|---|------|------|
| T-05 | **非 Windows 平台的支持声明** | 当前设计只声称 Windows + DSH `0.1.7-rc.2` 实测通过（`技术栈设计.md` §五）。macOS/Linux 的行为属 `missing evidence`；获得实测证据前，README 不得声称支持 |
| T-06 | **codexpro 后续版本的行为漂移** | 本设计锚定 `codexpro@0.30.2`。启动参数、profile 文件形状、健康端点的上游变更会使本文档失效；需在实现中做版本探测与降级提示 |
| T-07 | **`anchorDir` 是否应暴露到设置页** | 当前设计为非 volatile（部署事实，经 profile patch 钉死），故不出现在设置页。若用户需要频繁更换锚点，需重新评估 |

## 待实测的验收项

| # | 验收 | 说明 |
|---|------|------|
| T-08 | AC-04 页面级走查 | Server URL 在 ChatGPT 连接器建连需人工在浏览器完成，无法由自动化替代 |
| T-09 | AC-10 UI 走查 | 侧栏插件页「配置」控件出现且 Console 无 `slot entry crashed`；该崩溃路径无部署层报错，必须人眼查 Console |
| T-10 | AC-06 实例退出后残留检测 | 需要真实关闭再打开 DSH 实例，属用户操作 |

## 实现阶段的门禁（登记以便执行时逐项核对）

- 发布前置门禁：`dsh --profile test` 启动无 `N entries did not activate`、无 `N required plugin[s] did not activate`；功能冒烟见 `需求.md` AC 表。
- 分层门禁：`node tools/plugin-layering-check.mjs plugins/dsh-codexpro` 全绿。
- 产物新鲜度：`node build-client.mjs --check` 通过。
- `--dump-config` 人工核对：本插件为单一行，来源正确，无重复 id（本代无机械闸门兜底）。
