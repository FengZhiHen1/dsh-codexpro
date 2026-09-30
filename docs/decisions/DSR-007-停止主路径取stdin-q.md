# DSR-007：停止主路径取 stdin `q`，不使用 `--headless`

> **决定**：codexpro 的停止以「向 stdin 写 `q`」为主路径；进程**不使用 `--headless`** 启动，`terminate()` + `waitForExit()` 作为兜底。
> **理由**：实测证明 stdin `q` 是唯一能触发 codexpro 自身 cleanup() 的路径（清理 runtime 文件、回收 tunnel）；而 `--headless` 会绕开该通道。
> **被否决项**：使用 `--headless` 以获得机器可解析的就绪行；依赖信号终止；仅靠 `terminate()`。

## 上下文

codexpro 退出时需要执行其 `cleanup()`：`cleanupTunnelCredentials()` + `cleanupChildren()` + `clearRuntimeConnection()`。三类副作用只有走它自己的清理路径才会发生：

1. tunnel 子进程被回收；
2. `runtime/<hash>.json` 被删除；
3. tunnel 凭据文件被清理。

调研阶段的既有事实：Windows 上外部对 **node 进程**发送 `SIGTERM`/`SIGINT` 不执行其 JS 处理器（进程被 OS 直接终止）。该事实**未**单独推翻信号方案——因为 codexpro 的子进程回收用的是 `child.kill()`（对原生 `.exe` 有效，已独立实测）。

真正的分叉在于：codexpro 提供了一条**非 TTY 下的 stdin `q` 通道**（其控制面板的非 TTY 分支：读 stdin，收到 `q` 即 `cleanup()` 后 `exit(0)`），而 `--headless` 会跳过整个控制面板。

## 实测证据

同一环境下三条停止路径的对照（隔离 `CODEXPRO_HOME` + 合成工作区）：

| 停止方式 | 退出码 | runtime 文件 | 端口 | 残留进程 |
|----------|--------|--------------|------|----------|
| **stdin `q`** | **0** | **已清理** | 释放 | 0 |
| `taskkill /T /F`（树杀） | 1 | **未清理** | 释放 | 0 |
| 父进程被硬杀（模拟崩溃） | — | **残留** | 释放 | 0 |

⇒ `q` 路径是唯一让 codexpro 走完自身清理的路径。硬杀虽能终止进程树，但留下 runtime 文件残留。

补充独立实测：`child.kill('SIGTERM')` 对原生 `.exe` 子进程**有效**（以 `ping.exe` 验证：调用后进程终止）。这解释了为何 codexpro 的 `cleanupChildren()` 能回收真实的 `ngrok.exe`/`cloudflared.exe`。

## 真实方向及评价

| 方向 | 清理完整性 | 就绪判定 | 代价 |
|------|------------|----------|------|
| stdin `q` 为主 + `terminate()` 兜底 | **完整**（走 codexpro 自身 cleanup） | 用 `/healthz` 轮询 | 不能用 `--headless`；stdout 为交互式文案（但就绪靠 healthz，不解析文案） |
| `--headless` + 信号 | **不完整**（清洗不执行） | 可解析 `CODEXPRO_READY <url>` 就绪行 | 失去 `q` 通道；runtime 与 tunnel 凭据残留需手工善后 |
| 仅靠 `terminate()`（托管范围终止） | 不完整（同上） | 用 `/healthz` 轮询 | 同上；虽有进程容器保证整树终止，但不触发 codexpro 清理 |

## 最终决定与理由

取 **stdin `q` 为主路径**。

关键论据：`--headless` 的唯一实质收益是「打印机器可解析的就绪行」，而本设计的就绪判定**本来就不解析 stdout**（用 `/healthz` 轮询，见 `technical-details/进程管理.md` §二/§三）。⇒ 该方向在我们的设计里收益为零，却要付出「失去唯一优雅通道」的代价。这是被证据排除的伪方向，不是偏好取舍。

`terminate()` + `waitForExit()` 保留为**兜底**：在 `q` 未生效（进程无响应）或 fiber 处置（插件卸载、DSH 退出）时使用。此路径依赖进程容器的整树终止保证，其能力已实测可用（见 DSR-008）。

## 直接后果

- 启动参数**不含** `--headless`；`stdio.stdin` 必须为 `'pipe'`（否则无 `q` 通道）。
- 停止顺序：写 `q` → 等待退出（含超时）→ 未退出则 `terminate()` + `waitForExit()`。
- 进程崩溃（非我方终止）时 runtime 文件会残留；因两个 pid 均已不存活，codexpro 下次读到会判定为未运行并自行删除该文件（实测）。⇒ 无需插件干预。
- stdout 不会出现 `CODEXPRO_READY`（那是 headless 专有）；插件不依赖它。
- 若 codexpro 未来移除该 stdin 通道，兜底路径仍可保证进程终止，但会留下 runtime 残留——届时应重访本决策。

**波及文档**：`技术栈设计.md`、`项目结构设计.md`、`technical-details/进程管理.md` §二/§五/§八、`TODO.md`。

## 重访条件

- codexpro 移除或改变非 TTY 下的 stdin 控制通道。
- 上游提供 `--headless` 下的优雅关闭通道（如 HTTP 停止端点）。
- 出现必须使用 `--headless` 的场景（例如要求解析就绪行）。
