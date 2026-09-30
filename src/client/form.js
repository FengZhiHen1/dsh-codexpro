// form — 官方配置表单的接线：字段规格、SettingsFormModel 控制器与投影。
//
// 边界：只描述字段与「配置值 ↔ 草稿文本」的转换，不含 UI（UI 在 card.jsx）。
// 配置真相 = 本行 loader entry 的 Cordis Config（volatile 字段）；读写全走官方 configForms，
// 草稿暂存、revision 围栏、保存后回读、离开页面丢弃都归官方 SettingsFormModel。
// 官方字段原语只有文本与 write-only 密钥，没有 select/boolean，故 select 与复选框自绘，
// 但草稿与写入仍走本模型的 edit/resetField（knowledge/client/15 §4）。
// 参考：knowledge/client/15 §4；knowledge/host/07；官方范本
//   ui-settings-shell/src/client/shell-card-controller.ts、ui-settings-agent-loop 同名文件。

import { SettingsFormModel, settingsTextField } from '@deepseek-ai/dsh-client-ui-primitives'
import { BASH_MODES, PORT_RANGE, TUNNEL_MODES, WRITE_MODES } from '../core/codexpro.js'

/** 授权集字段名（Host Config 的 dict 字段）。 */
export const AUTHORIZED = 'authorized'
/** tunnel 方式字段名。 */
export const TUNNEL_MODE = 'tunnelMode'
/** 公网 hostname 字段名。 */
export const TUNNEL_HOSTNAME = 'tunnelHostname'
/** 本地端口字段名。 */
export const PORT = 'port'
/** bash 模式字段名。 */
export const BASH_MODE = 'bashMode'
/** 写入模式字段名。 */
export const WRITE_MODE = 'writeMode'

/**
 * 判断值是否为普通对象（排除 null 与数组）。
 * @param {unknown} value 待判值
 * @returns {boolean} 是普通对象时为 true
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 把授权映射收敛为「仅含显式 true 且键有序」的对象。
 *
 * 只留 true：读取侧同样只认 true（core/catalog.js 的 authorizationOf），false 与缺席等价，
 * 留着只会让 profile patch 累积无用键。
 * 键排序：官方模型以「草稿文本 === format(当前值)」判断某项是否待写，排序使同一集合
 * 总有同一文本，否则键序不同会被误判为「有改动」。
 * @param {unknown} value 授权映射
 * @returns {Record<string, boolean>} 收敛后的映射
 */
export function normalizeAuthorized(value) {
  if (!isPlainObject(value)) return {}
  const result = {}
  for (const key of Object.keys(value).sort()) {
    if (value[key] === true) result[key] = true
  }
  return result
}

/**
 * 由授权草稿文本解析出映射；非对象或含非布尔值时返回空映射。
 * @param {string} text 草稿文本
 * @returns {Record<string, boolean>} 授权映射
 */
export function authorizedOfText(text) {
  try {
    return normalizeAuthorized(JSON.parse(String(text)))
  } catch {
    return {}
  }
}

/**
 * 授权集字段的规格：以 JSON 文本承载整个映射。
 *
 * 官方没有布尔/结构化字段控件，故把整个映射序列化为一个草稿字段——这样复选框的每次
 * 勾选都只是「编辑文本」，保存仍由官方模型一次性 mutate（与 dsh-guardrails 的
 * category 字段同一手法）。
 * @type {object}
 */
const authorizedSpec = {
  field: AUTHORIZED,
  format: (value) => JSON.stringify(normalizeAuthorized(value)),
  parse: (text) => {
    let parsed
    try {
      parsed = JSON.parse(String(text))
    } catch {
      return undefined
    }
    if (!isPlainObject(parsed)) return undefined
    for (const entry of Object.values(parsed)) {
      // Host 侧是 dict(string→boolean)：混入其他类型会被 Host 拒，故在此同样拒。
      if (typeof entry !== 'boolean') return undefined
    }
    const normalized = normalizeAuthorized(parsed)
    // 空集合表达为 clear：让该字段回落到 Host 的默认值，而不是往 patch 里写一个空对象。
    if (Object.keys(normalized).length === 0) return { kind: 'clear' }
    return { kind: 'set', value: normalized }
  },
}

/**
 * 枚举字段（tunnel / bash / write）的规格：取值必须在词表内。
 *
 * Host schema 是 union(const)，写入词表外的值会被 Host 拒；在此同样只接受词表内取值，
 * 让本地校验镜像 Host，避免「本地看着合法、跨网后被拒」的多余往返。
 * @param {string} field 字段名
 * @param {readonly string[]} allowed 允许的取值
 * @returns {object} 字段规格
 */
function optionSpec(field, allowed) {
  return {
    field,
    format: (value) => (typeof value === 'string' && allowed.includes(value) ? value : ''),
    parse: (text) => {
      const trimmed = String(text).trim()
      return allowed.includes(trimmed) ? { kind: 'set', value: trimmed } : undefined
    },
  }
}

/**
 * 端口字段的规格。
 *
 * Host schema 是字符串（非数字），故写回字符串而非数字。
 * 空文本与越界整数都返回 undefined，让官方模型把保存挡下（Host 亦会拒），
 * 而不是静默回落默认值——「改了端口却按旧端口跑」是最难查的一类失败。
 * @type {object}
 */
const portSpec = {
  field: PORT,
  format: (value) => (typeof value === 'string' ? value : ''),
  parse: (text) => {
    const trimmed = String(text).trim()
    if (trimmed === '') return undefined
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < PORT_RANGE.min || parsed > PORT_RANGE.max) return undefined
    return { kind: 'set', value: trimmed }
  },
}

/** 本页编辑的全部字段——Host Config 的六个 volatile 键。 */
export const SPECS = [
  optionSpec(TUNNEL_MODE, TUNNEL_MODES),
  settingsTextField(TUNNEL_HOSTNAME),
  portSpec,
  optionSpec(BASH_MODE, BASH_MODES),
  optionSpec(WRITE_MODE, WRITE_MODES),
  authorizedSpec,
]

/**
 * 由表单模型构造页面读取的投影。
 * @param {object} form SettingsFormModel 实例
 * @returns {object} 含 shell 状态与各字段状态的快照
 */
function projection(form) {
  const state = { ...form.shell() }
  for (const spec of SPECS) state[spec.field] = form.field(spec.field)
  return state
}

/**
 * 创建本行配置页的控制器：一个官方表单模型 + 供组件读取的投影 store。
 * @param {object} scope 官方 ConfigForm（来自 `ctx.configForms.get(行 id)`）
 * @returns {{form: object, inject: () => object}} 控制器与其注入面
 */
export function createController(scope) {
  const form = new SettingsFormModel(scope, SPECS)
  const store = form.bind(() => projection(form))
  return {
    form,
    // `hooks` 是保留键：renderer 把每个成员消费成 `use<Name>` 选择器 hook，
    // 且不会把 `hooks` 本身传进 props。其余成员平铺进 props（官方各卡片同形）。
    inject: () => ({ hooks: { codexProForm: store }, ...form.actions() }),
  }
}
