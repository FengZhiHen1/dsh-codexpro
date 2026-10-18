// controls — 从宿主原语复制的小控件：Tag、Checkbox、信息图标、下拉箭头与动作按钮。
//
// 边界：只呈现与转发交互，不持有业务状态。复制而非 import：Client 包不向插件提供
// 兼容承诺；类名与几何由 styles.js 的 cxp-* 规则承担。
// 来源：DSH 0.2.1 的 Tag.tsx、Checkbox.tsx、icons/index.tsx、Button.tsx。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「Client UI 引用」。

import { createElement as h } from 'react'

/**
 * 只读胶囊标签。
 * @param {object} props 组件属性
 * @param {'outline'|'solid'|'neutral'|'quiet'|'success'|'info'|'warning'|'danger'} [props.tone] 色调
 * @param {object} [props.children] 标签内容
 * @returns {object} React 元素
 */
export function Tag({ tone = 'outline', children }) {
  return h('span', { className: 'cxp-tag', 'data-tone': tone }, children)
}

/**
 * 受控原生复选框；可见标签可选，无障碍名称始终提供。
 * @param {object} props 组件属性
 * @param {boolean} props.checked 是否选中
 * @param {(next: boolean) => void} props.onChange 请求的新状态
 * @param {string} [props.label] 可见标签
 * @param {string} [props.ariaLabel] 无可见标签时的无障碍名称
 * @param {boolean} [props.disabled] 是否禁用
 * @returns {object} React 元素
 */
export function Checkbox({ checked, onChange, label, ariaLabel, disabled = false }) {
  return h('label', { className: 'cxp-check' }, [
    h('input', {
      key: 'input',
      type: 'checkbox',
      checked,
      disabled,
      'aria-label': ariaLabel,
      onChange: (event) => { onChange(event.target.checked) },
    }),
    label ? h('span', { key: 'label' }, label) : null,
  ])
}

/**
 * 字段说明的圆形 i 图标（官方 IconInfoOutlineRegular 的 12px 形态）。
 * @returns {object} React 元素
 */
export function InfoIcon() {
  return h('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 14 14',
    fill: 'none',
    'aria-hidden': 'true',
  }, [
    h('path', {
      key: 'ring',
      d: 'M12.5757 7.00012C12.5757 3.92085 10.0794 1.42463 7.00012 1.42456C3.9208 1.42456 1.42456 3.9208 1.42456 7.00012C1.42463 10.0794 3.92085 12.5757 7.00012 12.5757C10.0793 12.5756 12.5756 10.0793 12.5757 7.00012ZM13.8002 7.00012C13.8001 10.7559 10.7559 13.8001 7.00012 13.8002C3.2443 13.8002 0.199291 10.7559 0.199219 7.00012C0.199219 3.24426 3.24426 0.199219 7.00012 0.199219C10.7559 0.199291 13.8002 3.2443 13.8002 7.00012Z',
      fill: 'currentColor',
    }),
    h('path', { key: 'dot', d: 'M7.6127 3.18921V4.55986H6.38735V3.18921H7.6127Z', fill: 'currentColor' }),
    h('path', { key: 'stem', d: 'M7.6127 5.68921V10.8109H6.38735V5.68921H7.6127Z', fill: 'currentColor' }),
  ])
}

/**
 * 下拉框箭头；画在外框上，颜色走 currentColor（避免 data-URI 里的字面色值）。
 * @returns {object} React 元素
 */
export function ChevronIcon() {
  return h('span', { className: 'cxp-chevron', 'aria-hidden': 'true' }, h('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 12 12',
    fill: 'none',
  }, h('path', {
    d: 'M3 4.5L6 7.5L9 4.5',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  })))
}

/**
 * 页内动作按钮（进程启停与刷新）；变体对齐官方 Button 的 primary / outline / ghost。
 * @param {object} props 组件属性
 * @param {string} props.label 文案
 * @param {'primary'|'outline'|'ghost'} [props.variant] 变体
 * @param {boolean} [props.disabled] 是否禁用
 * @param {() => void} props.onClick 点击处理
 * @returns {object} React 元素
 */
export function ActionButton({ label, variant = 'ghost', disabled = false, onClick }) {
  return h('button', {
    type: 'button',
    className: 'cxp-button',
    'data-variant': variant,
    disabled,
    onClick,
  }, label)
}
