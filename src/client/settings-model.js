// settings-model — 官方 SettingsFormModel 的复制实现（仅保留本插件用到的字段路径）。
//
// 边界：草稿暂存、revision 围栏、保存后回读、离开页面丢弃与 overridden/invalid 判定
// 全部在此，组件只读投影。复制而非 import：Harness Client 包不向插件提供兼容承诺。
// 来源：DSH 0.2.1 `packages/client/ui-primitives/src/settings-form/form-model.ts`。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」。

import { createSnapshotStore } from './store.js'

/**
 * 一个字段的草稿文本转换规格。
 * @typedef {object} SettingsFieldSpec
 * @property {string} field 命名空间内的字段名
 * @property {(value: unknown) => string} format 把已接受值渲染为草稿文本；无值时返回空串
 * @property {(text: string) => {kind: 'set', value: unknown} | {kind: 'clear'} | undefined} parse
 *   把草稿文本转换为一次写入；不接受该文本时返回 undefined（阻止保存而非静默丢弃）
 */

/**
 * 数字字段：空文本表达为 clear，非有限数字阻止保存。
 * @param {string} field 字段名
 * @returns {SettingsFieldSpec} 字段规格
 */
export function settingsNumberField(field) {
  return {
    field,
    format: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const parsed = Number(trimmed)
      return Number.isFinite(parsed) ? { kind: 'set', value: parsed } : undefined
    },
  }
}

/**
 * 自由文本字段：空文本表达为 clear，与「重置」同一语义。
 * @param {string} field 字段名
 * @returns {SettingsFieldSpec} 字段规格
 */
export function settingsTextField(field) {
  return {
    field,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

/**
 * 暂存一张卡的编辑并在保存时一次写入。
 *
 * 组件经 snapshot store 读取投影：scope 与本地草稿都会变化，故每次发布都从两者重建。
 * @throws {Error} 读取未在规格中声明的字段时
 */
export class SettingsFormModel {
  /**
   * @param {object} scope 官方 ConfigForm（getSnapshot / subscribe / mutate）
   * @param {SettingsFieldSpec[]} specs 本卡编辑的字段
   */
  constructor(scope, specs) {
    this.scope = scope
    this.specs = new Map(specs.map((spec) => [spec.field, spec]))
    /** 字段 → { text, clear }。 */
    this.staged = new Map()
    this.listeners = new Set()
    this.baseline = undefined
    this.unsubscribe = scope.subscribe(() => { this.publish() })
    this.saving = false
    this.failed = false
  }

  /**
   * 发布一张卡的投影，scope 或草稿变化时重建。
   * @param {() => unknown} project 从当前读取构造卡状态
   * @returns {{getSnapshot: () => unknown, subscribe: (listener: () => void) => (() => void), set: (next: unknown) => void}} store
   */
  bind(project) {
    const store = createSnapshotStore(project())
    this.listeners.add(() => { store.set(project()) })
    return store
  }

  /**
   * 卡级状态：Host 提供什么、一次保存会做什么。
   * @returns {{available: boolean, writable: boolean, dirty: boolean, invalid: boolean, saving: boolean, failed: boolean}} shell
   */
  shell() {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.op === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  /**
   * 一个控件的状态。
   * @param {string} field 字段名
   * @returns {{text: string, overridden: boolean, invalid: boolean}} 控件状态
   */
  field(field) {
    const staged = this.staged.get(field)
    const spec = this.spec(field)
    if (staged === undefined) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false }
    }
    const write = staged.clear ? { kind: 'clear' } : spec.parse(staged.text)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  /**
   * 绑定到本模型的编辑、重置、保存与丢弃动作。
   * @returns {{edit: Function, resetField: Function, save: Function, discard: Function}} 动作
   */
  actions() {
    return {
      edit: (field, text) => { this.stage(field, { text, clear: false }) },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true })
      },
      save: () => { void this.save() },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.baseline = undefined
        this.failed = false
        this.publish()
      },
    }
  }

  /**
   * 写入全部草稿，再按 Host 接受结果重新播种。
   *
   * Host 是「值是否被接受」的唯一权威，故结果从 section 回读，而不是本地预测。
   * 未落地的保存保留草稿，让用户改正而不是重打。
   * @returns {Promise<void>} 全部写入与回读完成后结算
   */
  async save() {
    const plan = this.plan()
    if (!plan.length || this.saving || !this.scope.getSnapshot().writable
      || plan.some((item) => item.op === undefined)) return
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const ops = plan.map((item) => item.op)
      const landed = await this.scope.mutate(ops, this.baseline?.revision)
      if (!landed) {
        this.failed = true
        return
      }
      this.staged.clear()
      this.baseline = undefined
      this.failed = false
    } catch {
      // 保留草稿；失败原因由 SettingsForm 的 saveFailed 文案统一呈现。
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  /** 释放对 Host 快照的订阅。 */
  dispose() {
    this.unsubscribe()
    this.listeners.clear()
  }

  /**
   * 一次保存会写入的每个草稿项。
   * @returns {Array<{field: string, op?: object}>} 计划写入；非法草稿只带 field
   */
  plan() {
    const plan = []
    for (const [field, staged] of this.staged) {
      const spec = this.spec(field)
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, op: { op: 'unset', path: [field] } })
        continue
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue
      const write = spec.parse(staged.text)
      if (write === undefined) plan.push({ field })
      else if (write.kind === 'clear') plan.push({ field, op: { op: 'unset', path: [field] } })
      else plan.push({ field, op: { op: 'set', path: [field], value: write.value } })
    }
    return plan
  }

  /**
   * 暂存一次编辑。
   * @param {string} field 字段名
   * @param {{text: string, clear: boolean}} edit 编辑
   * @returns {void}
   */
  stage(field, edit) {
    this.baseline ??= this.scope.getSnapshot()
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  /**
   * 取字段规格；缺失即为接线错误，必须响亮失败而非得到一个静默无效控件。
   * @param {string} field 字段名
   * @returns {SettingsFieldSpec} 字段规格
   */
  spec(field) {
    const spec = this.specs.get(field)
    if (spec === undefined) throw new Error(`plugin card has no field ${field}`)
    return spec
  }

  /**
   * 当前 Host 快照。
   * @returns {object} 快照
   */
  snapshotOf() {
    return this.scope.getSnapshot()
  }

  /**
   * section 内某字段的已接受值。
   * @param {string} field 字段名
   * @returns {unknown} 值
   */
  sectionValue(field) {
    return this.snapshotOf().value?.[field]
  }

  /**
   * 组合层中某字段的值（重置时回落的目标）。
   * @param {string} field 字段名
   * @returns {unknown} 值
   */
  baseValue(field) {
    return this.snapshotOf().base?.[field]
  }

  /**
   * 用户层（判断字段是否被覆盖）。
   * @returns {object|undefined} 用户层
   */
  userLayer() {
    return this.snapshotOf().user
  }

  /**
   * 用户层是否承载该字段。
   * @param {string} field 字段名
   * @returns {boolean} 承载时为 true
   */
  stored(field) {
    const user = this.userLayer()
    return user !== undefined && Object.hasOwn(user, field)
  }

  /** 通知全部投影监听器。 */
  publish() {
    for (const listener of this.listeners) listener()
  }
}
