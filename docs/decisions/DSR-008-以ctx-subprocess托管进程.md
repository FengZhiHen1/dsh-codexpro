# DSR-008：以 ctx.subprocess 托管进程，容器整树终止已验证可用

> **决定**：codexpro 进程经 `ctx.subprocess` 托管；依赖其 Windows 进程容器（Job）保证整树终止。
> **理由**：实测证明本机 `probeWindowsJob()` 判定为真（`containmentMode = windows-job`），且服务契约承诺销毁时终止全部托管进程；这使插件卸载与宿主退出两条路径都有清理保障。
> **被否决项**：裸 `node:child_process` + 自持清理；依赖外部 supervisor。

## 上下文

DSR-002 选定「进程跟随 DSH 实例生命周期」时，其安全性依赖一个当时**未取证**的能力：`ctx.subprocess` 在 Windows 上是否真的启用进程容器（Win32 Job + `KILL_ON_JOB_CLOSE`）。若容器不可用，该实现会退化为较弱的后备路径，整树终止无法保证——那会使「DSH 退出后无孤儿 tunnel」这一断言失去依据。

本次实测消除了该不确定性。

## 实测证据

### 容器能力（能力探测链的复刻）

`ctx.subprocess` 的本地实现按 `probeWindowsJob()` 决定容器模式：需同时满足「runner 入口可读」「Win32 绑定可加载」「当前令牌支持 Job」。在本机部署树（`0.1.7-rc.2`）上逐环实测：

| 环节 | 结果 |
|------|------|
| runner 入口 `lib/runner.js` 存在且可读 | 是 |
| `loadWin32ProcessBindings()` | 成功（导出含 `createJobObjectW`、`setInformationJobObject`） |
| `probeCurrentTokenJobSupport(api)` | 通过 |
| 合取 ⇒ `probeWindowsJob()` | **true** ⇒ `containmentMode = windows-job` |

注意：`dsh-win32-process` 包内**没有 `.node` 原生文件**，其绑定经运行时加载——因此不能靠「有无原生文件」推断容器可用性，必须实际调用探测链。

### 进程树终止语义

以三层进程树（node 父 → node 孙）验证树终止：父与孙**同时终止**，无残留。

### 宿主崩溃场景

强杀 codexpro 父 CLI（模拟宿主崩溃，无 JS 清理机会）后：其 server 子进程与 tunnel 槽位子进程**均随之终止**，端口释放，无残留进程。

**由此得到一条对实现的直接约束**：残留的 `runtime/<hash>.json` 中两个 pid 均已不存活（实测），因此 codexpro 下次读取该文件时会判定为「未运行」并自行删除。⇒ 插件**不需要**做残留文件清理。

## 真实方向及评价

| 方向 | 卸载清理 | DSH 退出清理 | 整树终止 | 代价 |
|------|----------|--------------|----------|------|
| `ctx.subprocess` 托管 | 服务销毁即终止并等待 | 实现挂 `process` 退出监听同步强杀 | **已实测可用** | 环境被清洗（token 需另走 profile 文件）；须显式给 `stdio`/`cwd`/`graceMs` |
| 裸 `node:child_process` | 需自写 disposer | 无 | 需自建（如 taskkill 树杀） | 全部清理逻辑自持，且无容器保证 |
| 外部 supervisor（Windows 服务/任务计划） | 不适用 | 依赖外部 | 依赖外部 | 把部署复杂度推给用户，违背「无需操心」目标 |

## 直接决定与理由

取 **`ctx.subprocess` 托管**（与 DSR-002 一致，此处补充其能力证据）。

理由：容器可用性已由实测确认，是该方向安全性的关键前提；服务契约的「销毁时终止并等待全部托管进程」因此获得实质内容，而非仅纸面承诺。方案二需自建等价能力且无容器保证；方案三把复杂度外移。

## 直接后果

- 插件静态 `inject` 含 `subprocess`。
- spawn 规格必须显式给出 `stdio`/`cwd`/`graceMs`（该 seam 不提供默认值）。
- 环境清洗会剔除 `CODEXPRO_HTTP_TOKEN`（命中 `TOKEN`），故 token 经 codexpro profile 文件传递（见 DSR-009 相关约束与 `技术栈设计.md` S-02）。
- 崩溃场景的 runtime 残留由 codexpro 自行回收，插件不介入。
- 插件不实现「孤儿认领」：容器已覆盖正常与崩溃两条路径；无句柄时杀进程风险高于收益。

**波及文档**：`技术栈设计.md` §五/§六、`项目结构设计.md` §四、`technical-details/进程管理.md` §一/§五/§六、`TODO.md`。

## 重访条件

- DSH 更换进程托管实现，或 `probeWindowsJob()` 在目标环境返回 false（届时整树终止退化为后备路径，须补充残留检测与用户提示）。
- 目标平台转为 POSIX（其容器机制为 `linux-scope`，未在本项目取证）。
- 上游改变 `SubprocessHandle` 的终止语义。
