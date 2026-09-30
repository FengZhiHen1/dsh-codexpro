// panels — 配置表单里的字段控件：参数字段与授权工作区。
//
// 边界：控件只报告用户意图（onEdit / onToggle），不自行写盘——写入由官方
// SettingsFormModel 在「保存」时一次性完成。
// 官方字段原语只有文本（SettingsValueField）与 write-only 密钥（SettingsSecretField），
// 没有 select / boolean，故 select、复选框与分组标题在此自绘，但草稿仍走官方模型的
// edit / resetField（knowledge/client/15 §4）。
// 几何逐项对齐官方 `.field`（padding 12px 0 / gap 6px / label 500 字重 / 相邻分隔线）；
// 相邻分隔线官方用 CSS 相邻选择器，内联样式表达不了，故由 first 参数显式控制。
// 帮助文案的事实来源：codexpro `--help`（本机 0.30.2）与其 profile 字段，非推测。
// 参考：knowledge/client/15 §4；官方 ui-settings-subagent 的 SubagentLimitsFields.tsx。

import { createElement as h, useState } from 'react'
import { Checkbox, IconInfoOutlineRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { BASH_MODES, HOSTNAME_REQUIRED_TUNNELS, TUNNEL_MODES, WRITE_MODES } from '../core/codexpro.js'
import { HAIRLINE, R, T, captionText, fieldBox, fieldLabel, fieldStyle, groupBox, groupTitle, hintText } from './theme.js'
import { AUTHORIZED, BASH_MODE, PORT, TUNNEL_HOSTNAME, TUNNEL_MODE, TUNNEL_NAME, WRITE_MODE, needsTunnelName } from './form.js'

/** tunnel 取值的下拉文案（取值来自 core 的权威词表）。 */
const TUNNEL_LABELS = {
  none: 'none — 仅本地，无公网入口',
  ngrok: 'ngrok — 稳定 dev domain',
  cloudflare: 'cloudflare — 快速隧道（URL 每次重启都变）',
  'cloudflare-named': 'cloudflare-named — 具名隧道（URL 稳定）',
  tailscale: 'tailscale — Funnel',
}

/** 需要公网 hostname 的 tunnel 取值（权威定义在 core/codexpro.js）。 */
const NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS)

/**
 * 解释性帮助文本（点「?」展开）。文案取自 codexpro `--help` 与其 profile 语义。
 * @type {Readonly<Record<string, string[]>>}
 */
const HELP = {
  tunnelMode: [
    '决定 ChatGPT 用什么地址连到本机 codexpro。默认 none，只在你这台机器上可用。',
    'none：不产生公网入口，只在本机浏览器/客户端可用。最安全的默认值。',
    'cloudflare：免配置快速隧道，但每次重启进程都会换一个新 URL，需要重新贴给 ChatGPT。适合临时试用。',
    'cloudflare-named：需先在 Cloudflare 建好具名隧道，URL 固定不变。适合长期使用。',
    'ngrok：用 ngrok 的固定 dev domain，URL 稳定；需本机已安装并登录 ngrok。',
    'tailscale：走 Tailscale Funnel，适合已有 Tailscale 网络的场景。',
    '注意：除 none 外都会把这个本地服务暴露到公网，请确保已设置可信的访问 token。',
  ],
  tunnelHostname: [
    '公网上面向 ChatGPT 的那个域名，必须与所选 tunnel 方式对应：',
    'ngrok：形如 your-domain.ngrok-free.dev（ngrok 后台里的 dev domain）。',
    'cloudflare-named：你在 Cloudflare 为该隧道绑定的自定义域名。',
    'tailscale：形如 your-device.your-tailnet.ts.net（Tailscale 分配的节点名）。',
    '填错不会立刻报错，但 ChatGPT 会连不上——它解析的就是这个域名。',
  ],
  tunnelName: [
    '你在 Cloudflare 建好的那条具名隧道的名字（cloudflared 侧的 tunnel name / UUID），不是域名。',
    '创建方式：在 Cloudflare Zero Trust 后台新建一条 Tunnel，名字随你取（如 codexpro），建好后把它填在这里。',
    '注意区分两个值：隧道名是 Cloudflare 上的标识，公网 hostname 是外部访问用的域名——两个都要填。',
    '不填的话 codexpro 会直接拒绝启动并报「--tunnel-name ... is required」。',
    '如果不用具名隧道，把 Tunnel 方式换成 none 或 cloudflare 即可（那样这个字段会消失）。',
  ],
  port: [
    'codexpro 在本机监听的端口，默认 8787。',
    '只有本机端口冲突（例如别的程序已占用 8787）时才需要改。',
    '取值必须是 1–65535 的整数。改为非默认值后，请确认没有其他服务占用该端口。',
  ],
  bashMode: [
    '决定 ChatGPT 能在你的项目里执行什么命令。',
    'off：完全禁止执行命令，只做文件读写。最保守。',
    'safe：允许常见的检查与测试类命令（如查看文件、跑测试），运行时按白名单筛选。',
    'full：允许任意 shell 命令，权限等同于你自己在终端里操作。仅在完全信任的仓库里使用。',
    '这个开关直接决定风险大小：不确定时保持 safe。',
  ],
  writeMode: [
    '决定 ChatGPT 能否改动你的文件。',
    'off：只读，禁止任何写入。',
    'handoff：不改动文件，而是把实现计划写成 .ai-bridge 交接文件，交给本地的实现 agent 去做。',
    'workspace：允许在已授权的目录内直接读写文件。最常见的用法。',
  ],
  authorized: [
    '勾选哪些工作区允许 ChatGPT 访问。未勾选的目录它看不到。',
    '只有 DSH 当前已打开的工作区会出现在这里——先在 DSH 里打开项目，再回来勾选。',
    '标记「目录不存在」的项无法勾选：codexpro 对不存在的授权根会直接拒绝启动，故本插件会跳过它。',
    '授权一个目录即允许 ChatGPT 在其中读写并执行受控命令（受上面两个开关约束），请按最小必要范围勾选。',
    '改动需要重启进程才生效。',
  ],
}

/**
 * 字段帮助按钮与展开区（复刻官方 SettingsValueField 的 help 形态）。
 * @param {object} props 组件属性
 * @param {string} props.id 帮助区 id（供 aria-controls 关联）
 * @param {string[]} props.lines 帮助段落
 * @returns {object} React 元素
 */
function Help({ id, lines }) {
  const [open, setOpen] = useState(false)
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
    h('button', {
      key: 'btn',
      type: 'button',
      'aria-label': '字段说明',
      'aria-expanded': open,
      'aria-controls': id,
      onClick: () => setOpen(!open),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: '24px',
        height: '24px',
        padding: 0,
        border: 0,
        borderRadius: R.sm,
        background: open ? T.bgLayer4 : 'none',
        color: open ? T.labelSecondary : T.labelTertiary,
        cursor: 'pointer',
      },
    }, h(IconInfoOutlineRegular, { size: 12 })),
    open
      ? h('div', {
        key: 'body',
        id,
        role: 'region',
        'aria-label': '字段说明',
        style: { flex: '1 1 100%', paddingTop: '4px' },
      }, lines.map((line, index) => h('p', {
        key: index,
        style: { margin: index === 0 ? 0 : '6px 0 0', fontSize: '12px', color: T.labelSecondary, lineHeight: '1.6' },
      }, line)))
      : null,
  ])
}

/**
 * 自绘字段的外框：官方 `.field` 几何 + 标签行（含帮助）+ 控件 + 说明。
 * @param {object} props 组件属性
 * @param {string} props.label 标签
 * @param {string} [props.hint] 控件下方一行说明
 * @param {string[]} [props.help] 「?」展开的详细说明
 * @param {boolean} [props.first] 是否该组首个字段（首个不画分隔线）
 * @param {object} props.children 控件
 * @returns {object} React 元素
 */
function FieldBox({ label, hint, help, first, children }) {
  const helpId = `codexpro-help-${label}`
  return h('div', { style: fieldBox(first) }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } }, [
      h('span', { key: 'l', style: fieldLabel }, label),
      help ? h(Help, { key: 'help', id: helpId, lines: help }) : null,
    ]),
    children,
    hint ? h('p', { key: 'hint', style: hintText }, hint) : null,
  ])
}

/**
 * 分组：官方 `SubagentCard` 的 section 形态（h3 标题 + 内容 + 上下分节留白）。
 *
 * 标题用 id + aria-labelledby 与 section 关联（官方同形），使读屏能报出「哪个分组的字段」。
 * `trailing` 放在标题同一行（官方 `.groupHead` 的计数位），用于「已选 N / M」这类计数。
 * @param {object} props 组件属性
 * @param {string} props.id 分组 id（用于标题与 section 的 aria 关联）
 * @param {string} props.title 标题
 * @param {string} [props.note] 一句话说明
 * @param {object} [props.trailing] 标题行右侧的附加内容（如计数）
 * @param {boolean} [props.first] 是否首个分组（首个不画顶线）
 * @returns {object} React 元素
 */
function Group({ id, title, note, trailing, first, children }) {
  const headingId = `codexpro-group-${id}`
  return h('section', { style: groupBox(first), 'aria-labelledby': headingId }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'baseline', gap: '8px' } }, [
      h('h3', { key: 't', id: headingId, style: groupTitle }, title),
      trailing ?? null,
    ]),
    note ? h('p', { key: 'n', style: { ...hintText, margin: '2px 0 0' } }, note) : null,
    children,
  ])
}

/**
 * 网络接入组：tunnel 方式与（按取值条件出现的）hostname、隧道名、端口。
 *
 * 抽为独立函数：三个条件字段（hostname / 隧道名按 tunnel 取值显隐）+ 端口，
 * 留在 OptionsFields 内会把那个函数体撑到触发复杂度告警，而这里没有额外分支。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @returns {object} React 元素
 */
function NetworkGroup({ fields, disabled, onEdit }) {
  const needsHost = NEEDS_HOSTNAME.has(fields.tunnelMode.text)
  const needsName = needsTunnelName(fields.tunnelMode.text)
  return h(Group, { id: 'network', title: '网络接入', first: true, note: 'ChatGPT 通过哪个地址连到本机。改完需重启进程才生效。' }, [
    h(FieldBox, {
      key: 'tunnel',
      label: 'Tunnel 方式',
      first: true,
      hint: '默认 none：只在本机可用，不暴露到公网',
      help: HELP.tunnelMode,
    }, h('select', {
      value: fields.tunnelMode.text,
      disabled,
      onChange: (event) => onEdit(TUNNEL_MODE, event.target.value),
      style: { ...fieldStyle, cursor: disabled ? 'default' : 'pointer', maxWidth: '320px' },
    }, TUNNEL_MODES.map((mode) => h('option', { key: mode, value: mode }, TUNNEL_LABELS[mode] ?? mode)))),
    needsHost
      ? h(FieldBox, {
        key: 'hostname',
        label: '公网 hostname',
        hint: '该 tunnel 方式必需，codexpro 亦强制要求',
        help: HELP.tunnelHostname,
      }, h('input', {
        type: 'text',
        value: fields.tunnelHostname.text,
        disabled,
        placeholder: 'your-domain.ngrok-free.dev',
        onChange: (event) => onEdit(TUNNEL_HOSTNAME, event.target.value),
        style: { ...fieldStyle, maxWidth: '320px' },
      }))
      : null,
    needsName
      ? h(FieldBox, {
        key: 'tunnelName',
        label: 'Cloudflare 隧道名',
        hint: 'Cloudflare 后台里那条具名隧道的名字；与上面的 hostname 是两个不同的值',
        help: HELP.tunnelName,
      }, h('input', {
        type: 'text',
        value: fields.tunnelName.text,
        disabled,
        placeholder: 'codexpro',
        'aria-invalid': fields.tunnelName.invalid ? true : undefined,
        onChange: (event) => onEdit(TUNNEL_NAME, event.target.value),
        style: {
          ...fieldStyle,
          maxWidth: '320px',
          borderColor: fields.tunnelName.invalid ? T.error : T.borderL4,
        },
      }), fields.tunnelName.invalid
        ? h('p', { key: 'bad', style: { ...hintText, color: T.error } }, '隧道名不能超过 128 个字符')
        : null)
      : null,
    h(FieldBox, {
      key: 'port',
      label: '本地端口',
      hint: '仅在本机端口冲突时才需修改',
      help: HELP.port,
    }, h('input', {
      type: 'text',
      inputMode: 'numeric',
      value: fields.port.text,
      disabled,
      placeholder: '8787',
      'aria-invalid': fields.port.invalid ? true : undefined,
      onChange: (event) => onEdit(PORT, event.target.value),
      style: {
        ...fieldStyle,
        maxWidth: '140px',
        borderColor: fields.port.invalid ? T.error : T.borderL4,
      },
    }), fields.port.invalid ? h('p', { key: 'bad', style: { ...hintText, color: T.error } }, '端口需为 1–65535 的整数') : null),
  ])
}

/**
 * 参数字段组：网络 / 权限两组。
 * @param {object} props 组件属性
 * @param {object} props.fields 各字段的官方状态（text/overridden/invalid）
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @param {Function} props.onReset 暂存清除
 * @returns {object} React 元素
 */
export function OptionsFields({ fields, disabled, onEdit, onReset }) {
  return h('div', null, [
    h(NetworkGroup, { key: 'net', fields, disabled, onEdit }),
    h(Group, { key: 'perm', id: 'permission', title: '权限', note: '决定 ChatGPT 能在你的项目里做到什么程度，是风险控制的主要开关。' }, [
      h(FieldBox, {
        key: 'bash',
        label: 'bash 模式',
        first: true,
        hint: 'safe 覆盖大多数场景；full 等同于你自己在终端操作',
        help: HELP.bashMode,
      }, h('select', {
        value: fields.bashMode.text,
        disabled,
        onChange: (event) => onEdit(BASH_MODE, event.target.value),
        style: { ...fieldStyle, cursor: disabled ? 'default' : 'pointer', maxWidth: '140px' },
      }, BASH_MODES.map((mode) => h('option', { key: mode, value: mode }, mode)))),
      h(FieldBox, {
        key: 'write',
        label: '写入模式',
        hint: 'workspace 允许在已授权目录内直接读写',
        help: HELP.writeMode,
      }, h('select', {
        value: fields.writeMode.text,
        disabled,
        onChange: (event) => onEdit(WRITE_MODE, event.target.value),
        style: { ...fieldStyle, cursor: disabled ? 'default' : 'pointer', maxWidth: '140px' },
      }, WRITE_MODES.map((mode) => h('option', { key: mode, value: mode }, mode)))),
    ]),
  ])
}

/**
 * 授权工作区字段：逐项勾选，整组映射作为一个草稿字段写入。
 *
 * 候选集来自 `catalog` 端点（DSH 工作区注册表），勾选状态来自表单草稿。
 * 复选框点击只改草稿：把整个映射重新序列化后 edit 一次，保存时由官方模型
 * 一次性 mutate；取消全部勾选表达为 clear，让字段回落到 Host 默认值。
 * @param {object} props 组件属性
 * @param {Array<{path: string, title: string, exists: boolean}>} props.workspaces 候选工作区
 * @param {Record<string, boolean>} props.authorized 当前草稿里的授权映射
 * @param {boolean} props.disabled 是否禁用
 * @param {Function} props.onEdit 暂存草稿
 * @returns {object} React 元素
 */
export function WorkspacesField({ workspaces, authorized, disabled, onEdit }) {
  /**
   * 切换某个工作区的授权态并暂存整份映射。
   * @param {string} path 工作区路径
   * @param {boolean} next 新值
   * @returns {void}
   */
  const toggle = (path, next) => {
    const mapped = { ...authorized }
    if (next) mapped[path] = true
    else delete mapped[path]
    onEdit(AUTHORIZED, JSON.stringify(mapped))
  }

  const selected = Object.keys(authorized).length
  const list = Array.isArray(workspaces) ? workspaces : []

  return h(Group, {
    id: 'workspaces',
    title: '授权工作区',
    note: '未勾选的目录 ChatGPT 看不到。',
    // 计数与帮助按钮放标题行（官方 .groupHead 的计数位），使三组结构一致：
    // 标题（+ 计数）→ 说明 → 内容。
    trailing: h('span', { key: 'tail', style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, [
      list.length
        ? h('span', { key: 'c', style: { ...captionText, fontVariantNumeric: 'tabular-nums' } }, `已选 ${selected} / ${list.length}`)
        : null,
      h(Help, { key: 'help', id: 'codexpro-help-authorized', lines: HELP.authorized }),
    ]),
  }, [
    list.length === 0
      ? h('p', { key: 'empty', style: { ...hintText, marginTop: '8px' } },
        '当前实例还没有工作区。在 DSH 里打开一个项目后，它就会出现在这里。')
      : h('div', {
        key: 'list',
        style: { marginTop: '6px', border: `${HAIRLINE} solid ${T.borderL4}`, borderRadius: R.md, overflow: 'hidden' },
      }, list.map((item, index) => h('div', {
        key: item.path,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 12px',
          fontSize: '13px',
          borderTop: index === 0 ? 'none' : `${HAIRLINE} solid ${T.borderL2}`,
          background: T.bgLayer3,
          opacity: item.exists ? 1 : 0.55,
        },
      }, [
        h(Checkbox, {
          key: 'box',
          checked: authorized[item.path] === true,
          disabled: disabled || !item.exists,
          onChange: (next) => toggle(item.path, next),
        }),
        h('span', { key: 'title', style: { ...fieldLabel, fontWeight: 400, flex: 'none' } }, item.title),
        h('span', { key: 'path', style: { ...captionText, flex: '1 1 auto', wordBreak: 'break-all' } }, item.path),
        item.exists ? null : h(Tag, { key: 'miss', tone: 'neutral' }, '目录不存在'),
      ]))),
  ])
}

export { FieldBox, Group }
