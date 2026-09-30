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

/** 文本输入基元（原生设置同构：浅底小圆角、0.5px 描边）。 */
export const fieldStyle = {
  border: `${HAIRLINE} solid ${T.borderL2}`,
  borderRadius: R.sm,
  background: T.bgLayer3,
  padding: '4px 8px',
  font: 'inherit',
  fontSize: '13px',
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
