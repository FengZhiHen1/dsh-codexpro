// theme — Client 主题 token 与几何常量：色值零硬编码，全部映射宿主 --dsw-* token。
//
// 边界：只放 token 与几何常量，不放组件；伪类效果由组件用状态合成（内联样式表达不了伪类，
// 故 hover 走 onMouseEnter/Leave、focus 走 onFocus/Blur，与本仓库既有两个 Client 插件同构）。
// 几何与字号对齐官方设置节（ui-settings-plugins 的 PluginsSettingsSection.module.css）与
// 官方设置卡材料规范（knowledge/client/15 §4、16 §3）。
// 边界补充：中性实线边框一律 0.5px；半径只用 --dsw-radius-* 六档，不用离格字面量。
// 参考：knowledge/client/15 §4/§4.1、16 §3。

/** 主题 token 表：宿主换肤即时生效。 */
export const T = {
  bgBase: 'var(--dsw-alias-bg-base)',
  bgLayer2: 'var(--dsw-alias-bg-layer-2)',
  bgLayer3: 'var(--dsw-alias-bg-layer-3)',
  /** 官方面层：hover 与展开态用（fields.module.css 的 helpButton:hover）。 */
  bgLayer4: 'var(--dsw-alias-bg-layer-4)',
  bgModulePlatform: 'var(--dsw-alias-bg-module-platform)',
  borderL1: 'var(--dsw-alias-border-l1)',
  borderL2: 'var(--dsw-alias-border-l2)',
  /** 官方设置卡描边用的层级（比 l1/l2 更浅，用于卡面轮廓）。 */
  borderL4: 'var(--dsw-alias-border-l4)',
  brand: 'var(--dsw-alias-brand-primary)',
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  labelTertiary: 'var(--dsw-alias-label-tertiary)',
  /** 官方用于计数、分组说明等最弱一级文本。 */
  labelCaption: 'var(--dsw-alias-label-caption)',
  success: 'var(--dsw-alias-state-success-primary)',
  error: 'var(--dsw-alias-state-error-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  /** 官方焦点环两件套（focus.css 定义，宿主统一）。 */
  focusRingWidth: 'var(--dsw-focus-ring-width)',
  focusRingColor: 'var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))',
  /** 官方设置卡材料（v0.1.7 新增两兄弟）。 */
  settingsCardFill: 'var(--dsw-alias-settings-card-fill)',
  settingsCardStroke: 'var(--dsw-alias-settings-card-stroke)',
}

/** 圆角 token 表：宿主六档（xs 4 / sm 8 / md 12 / lg 16 / xl 20 / panel 28）。 */
export const R = {
  xs: 'var(--dsw-radius-xs)',
  sm: 'var(--dsw-radius-sm)',
  md: 'var(--dsw-radius-md)',
  lg: 'var(--dsw-radius-lg)',
  xl: 'var(--dsw-radius-xl)',
}

/** 中性实线边框统一粗细：官方规范为 0.5px，不用 1px。 */
export const HAIRLINE = '0.5px'

/**
 * token 色晕（状态徽章共用）。
 * @param {string} color CSS 颜色值
 * @returns {object} 样式片段
 */
const badgeStyle = (color) => ({
  color,
  background: `color-mix(in srgb, ${color} 15%, transparent)`,
})

/**
 * 状态徽章几何基元（对齐原生 pill：全圆角 + 11px）。
 *
 * 导出供 UI 规格测试断言 corner-shape 配套（该配对是易被误删的视觉约束）。
 */
export const pillBase = {
  display: 'inline-block',
  padding: '0 7px',
  height: '18px',
  borderRadius: '999px',
  // 全圆形状必须显式配 corner-shape: round：宿主 corner-shape.css 用通配选择器把
  // 所有圆角统一成 superellipse(1.5)，会把胶囊两端压成方角。官方 Pill/Tag 同样成对声明。
  // 不支持该属性的引擎忽略此声明，圆角回退为圆弧。
  cornerShape: 'round',
  fontSize: '11px',
  lineHeight: '18px',
  background: T.bgModulePlatform,
  color: T.labelSecondary,
  whiteSpace: 'nowrap',
}

/**
 * 按态取徽章样式。
 * @param {'ok'|'warn'|'error'|'idle'} kind 状态类别
 * @returns {object} 样式
 */
export const statusPillStyle = (kind) => {
  if (kind === 'warn') return { ...pillBase, ...badgeStyle(T.warn) }
  if (kind === 'error') return { ...pillBase, ...badgeStyle(T.error) }
  if (kind === 'ok') return { ...pillBase, ...badgeStyle(T.success) }
  return pillBase
}

/** 布局基元速查（字号对齐官方设置节的 13px 正文基准）。 */
export const S = {
  panel: { display: 'flex', flexDirection: 'column', gap: '12px' },
  listRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', flexWrap: 'wrap' },
  toolbar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  muted: { color: T.labelSecondary, fontSize: '13px' },
}

/** 官方设置卡材料：radius xl + 0.5px settings-card-stroke 描边 + settings-card-fill 底。 */
export const cardStyle = {
  border: `${HAIRLINE} solid ${T.settingsCardStroke}`,
  borderRadius: R.xl,
  background: T.settingsCardFill,
  overflow: 'hidden',
}

/** 分隔线（卡内行间）。 */
export const dividerStyle = { height: HAIRLINE, background: T.borderL2, flex: 'none' }

/** 次要说明文本（官方 tertiary，13px）。 */
export const noteText = { fontSize: '13px', color: T.labelTertiary, lineHeight: '20px' }

/** 更弱一级文本（官方 caption，用于计数与最弱说明）。 */
export const captionText = { fontSize: '12px', color: T.labelCaption, lineHeight: '18px' }

/** 字段说明文本（官方 fields.module.css 的 .hint：12px tertiary）。 */
export const hintText = { margin: 0, fontSize: '12px', color: T.labelTertiary, lineHeight: '1.5' }

/**
 * 一个字段的外框：官方 `.field` 的几何（padding 12px 0 / gap 6px）。
 *
 * 与官方的唯一差异是分隔线：官方用 `.field + .field { border-top }` 的相邻选择器，
 * 内联样式表达不了，故由调用方按「是否首个字段」显式传 `first`；
 * 不传则一律画线——漏画会让整片字段连成一团，正是「没有分组」观感的来源。
 * @param {boolean} [first] 是否为该组首个字段（首个不画顶线）
 * @returns {object} 字段容器样式
 */
export const fieldBox = (first = false) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '12px 0',
  borderTop: first ? 'none' : `${HAIRLINE} solid ${T.borderL2}`,
})

/** 字段标签（官方 .label：13px / 500 字重）。 */
export const fieldLabel = { fontSize: '13px', fontWeight: 500, color: T.labelPrimary, lineHeight: '1.5' }

/**
 * 分组标题（官方 `ui-settings-subagent` 的 `.heading`：13px / 600 字重）。
 *
 * 层级靠字重而非字号：字段标签是 13px/500，标题同为 13px 但 600，
 * 两者仅在字重上分开。先前误用 14px/500 会让标题与字段标签几乎同重，
 * 整片看起来是平的——这正是「分组不醒目」的机制。
 */
export const groupTitle = { margin: 0, fontSize: '13px', fontWeight: 600, color: T.labelPrimary, lineHeight: '1.5' }

/**
 * 分组容器：官方 `SubagentCard` 的 `.section`（上下各 16px 分节留白）。
 *
 * 组间分隔刻意比组内字段分隔更强一档（0.5px border-l4 对 border-l2）：
 * 两级分隔若同深，用户分不清「组与组」和「字段与字段」，分组等于白设。
 * 首组不画顶线（避免与页面上方内容割裂），由 `first` 控制。
 * @param {boolean} [first] 是否首个分组（首个不画顶线）
 * @returns {object} 分组容器样式
 */
export const groupBox = (first = false) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '16px 0',
  borderTop: first ? 'none' : `${HAIRLINE} solid ${T.borderL4}`,
})

/**
 * 文本输入基元（对齐官方 fields.module.css 的 .input：34px 高、radius-md、border-l4）。
 *
 * 底色用 `backgroundColor` 长写而非 `background` 简写：简写会把 background-image 重置为
 * `none`，而 selectStyle 要在此之上叠加箭头图；同一个 style 对象里简写与长写的胜负取决于
 * 键顺序，分开写可消除这个隐患。
 */
export const fieldStyle = {
  border: `${HAIRLINE} solid ${T.borderL4}`,
  borderRadius: R.md,
  backgroundColor: T.bgLayer3,
  padding: '0 12px',
  height: '34px',
  font: 'inherit',
  fontSize: '13px',
  lineHeight: '1.5',
  color: T.labelPrimary,
  minWidth: 0,
}

/**
 * 下拉箭头：官方 `ModelsSection.module.css` 的 data-URI SVG（逐字同值）。
 *
 * SVG 内的颜色不能写成 CSS 变量（data-URI 不参与变量解析），故官方取 `#81858C`
 * ——其源码注释原文："#81858C is the caption gray shared by both themes"。
 */
const SELECT_CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"

/**
 * 下拉框外框：由 `<div>` 绘制，`<select>` 只作透明交互层（走查事故 2026-09-30）。
 *
 * 为什么不把 border 画在 select 上：用户环境实测（截图像素扫描）显示
 * `appearance: none` 之后 `<select>` 自身的 `border` 直边一个像素都不绘制，
 * 只剩四个圆角弧；而同一页由 `<div>` 绘制的边框与 `<input>` 的边框四边 100% 完整。
 * 即「作者样式的 border 在 select 上不可靠」是本环境的既成事实（本项目 headless
 * Chrome 无法复现，故不深究引擎差异，改用可验证可靠的元素来画框）。
 *
 * 外框交给 div 另有一处收益：焦点态的原生重绘不再影响外框——原始缺陷
 * 「选完值胶囊框消失、点别处才回来」正来自 select 的状态重绘，div 外框不参与该状态。
 *
 * 箭头也画在外框上（背景图 + 透明 select），使箭头的渲染同样不依赖 select 自身绘制。
 */
export const selectBoxStyle = {
  border: `${HAIRLINE} solid ${T.borderL4}`,
  borderRadius: R.md,
  backgroundColor: T.bgLayer3,
  backgroundImage: SELECT_CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '12px 12px',
  height: '34px',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
}

/**
 * 下拉框本体：透明无边框，只承担取值与交互（外观全在外框 div 上）。
 *
 * `appearance: none` 仍必需：不移除原生外观时聚焦态会走原生绘制路径，与外面的
 * 外框叠加出重影/错位。官方 4 处自绘 select 也都声明了它。
 * 右侧留 32px 给外框上的箭头（原生箭头被 appearance:none 移除）。
 */
export const selectControlStyle = {
  appearance: 'none',
  border: 'none',
  background: 'none',
  width: '100%',
  height: '100%',
  padding: '0 32px 0 12px',
  font: 'inherit',
  fontSize: '13px',
  lineHeight: '1.5',
  color: T.labelPrimary,
  minWidth: 0,
}

/**
 * 进程状态到展示信息的映射。状态词表与 Host 侧 core/state.js 一致；
 * 未知状态回落为「未知」，不谎报运行中。
 * @type {Readonly<Record<string, {label: string, kind: 'ok'|'warn'|'error'|'idle'}>>}
 */
const STATE_DISPLAY = Object.freeze({
  idle: { label: '未运行', kind: 'idle' },
  starting: { label: '启动中', kind: 'warn' },
  running: { label: '运行中', kind: 'ok' },
  stopping: { label: '停止中', kind: 'warn' },
  failed: { label: '启动失败', kind: 'error' },
})

/**
 * 取状态的展示信息。
 * @param {string} state 状态值
 * @returns {{label: string, kind: string}} 展示信息；未知状态回落为「未知」
 */
export function displayState(state) {
  return STATE_DISPLAY[state] ?? { label: '未知', kind: 'warn' }
}
