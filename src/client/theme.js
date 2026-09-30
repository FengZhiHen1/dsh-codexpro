// theme — Client 主题 token 与样式基元：色值零硬编码，全部映射宿主 --dsw-alias-* token。
//
// 几何对齐同仓库既有两个 Client 插件的设置面（外壳已给页边距，横向零内缩）。
// 参考：knowledge/client/15 §4.1、16；technical-details/RPC通道与设置页.md §五。

/** 主题 token 表：宿主换肤即时生效。 */
export const T = {
  bgBase: 'var(--dsw-alias-bg-base)',
  bgLayer2: 'var(--dsw-alias-bg-layer-2)',
  bgLayer3: 'var(--dsw-alias-bg-layer-3)',
  bgModulePlatform: 'var(--dsw-alias-bg-module-platform)',
  borderL1: 'var(--dsw-alias-border-l1)',
  borderL2: 'var(--dsw-alias-border-l2)',
  brand: 'var(--dsw-alias-brand-primary)',
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  labelTertiary: 'var(--dsw-alias-label-tertiary)',
  success: 'var(--dsw-alias-state-success-primary)',
  error: 'var(--dsw-alias-state-error-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
}

/** 圆角 token 表：宿主六档（xs 4 / sm 8 / md 12 / lg 16 / xl 20 / panel 28）。 */
export const R = {
  xs: 'var(--dsw-radius-xs)',
  sm: 'var(--dsw-radius-sm)',
  md: 'var(--dsw-radius-md)',
  lg: 'var(--dsw-radius-lg)',
}

/**
 * token 色晕（状态徽章共用）。
 * @param {string} color CSS 颜色值
 * @returns {object} 样式片段
 */
export const badgeStyle = (color) => ({
  color,
  background: `color-mix(in srgb, ${color} 15%, transparent)`,
})

/** 状态徽章几何基元（对齐原生 pill：高约 19px、全圆角、11px）。 */
export const pillBase = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  lineHeight: '17px',
  background: T.bgModulePlatform,
  color: T.labelSecondary,
  whiteSpace: 'nowrap',
}

/**
 * 按态取徽章样式。
 * @param {'ok'|'warn'|'error'} kind 状态类别
 * @returns {object} 样式
 */
export const statusPillStyle = (kind) => {
  if (kind === 'warn') return { ...pillBase, ...badgeStyle(T.warn) }
  if (kind === 'error') return { ...pillBase, ...badgeStyle(T.error) }
  if (kind === 'ok') return { ...pillBase, ...badgeStyle(T.success) }
  return pillBase
}

/** 布局基元速查。 */
export const S = {
  panel: { padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '12px' },
  listRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', flexWrap: 'wrap' },
  toolbar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  muted: { color: T.labelSecondary, fontSize: '12px' },
}

/** 卡容器（分区内容）。 */
export const cardStyle = {
  border: `1px solid ${T.borderL1}`,
  borderRadius: R.md,
  background: T.bgLayer3,
  overflow: 'hidden',
}

/** 浅底子卡。 */
export const subCardStyle = { borderRadius: R.sm, background: T.bgModulePlatform }

/** 分隔线。 */
export const dividerStyle = { height: '1px', background: T.borderL1, flex: 'none' }

/** 次要说明文本。 */
export const noteText = { fontSize: '11px', color: T.labelSecondary, lineHeight: 1.5 }

/** 段标题。 */
export const sectionHead = { fontSize: '14px', fontWeight: 600, color: T.labelPrimary }

/** 小尺寸文字钮（行内操作）。 */
export const linkBtn = {
  border: 'none',
  background: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: '11px',
  color: T.labelSecondary,
  cursor: 'pointer',
}

/** 文本输入基元（原生设置同构：浅底小圆角）。 */
export const fieldStyle = {
  border: `1px solid ${T.borderL1}`,
  borderRadius: R.sm,
  background: T.bgLayer3,
  padding: '4px 8px',
  font: 'inherit',
  fontSize: '12px',
  color: T.labelPrimary,
  minWidth: 0,
}

/**
 * 进程状态到展示信息的映射。状态词表与 Host 侧 core/state.js 一致；
 * 未知状态回落为「未知」，不谎报运行中。
 * @type {Readonly<Record<string, {label: string, kind: 'ok'|'warn'|'error'|'idle'}>>}
 */
export const STATE_DISPLAY = Object.freeze({
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
