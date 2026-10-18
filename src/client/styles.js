// styles — 配置页样式表：复制宿主设置页的几何、状态与焦点行为，类名统一 cxp- 前缀。
//
// 边界：只引用 --dsw-alias-*、--dsw-radius-* 与 --dsw-focus-ring-* token；无字面颜色。
// 组件把本字符串渲染为 <style> 元素，随 slot 条目卸载一起移除，不写 document.head。
// 来源：DSH 0.2.1 的 SettingsForm.module.css、fields.module.css、Checkbox.module.css、
// Tag.module.css、ui-settings-subagent/SubagentCard.module.css 与 Button.module.css。
// 参考：knowledge/v0.2.1-rc.2/05-插件工程约定.md「插件设置页」「Client UI 引用」。

/** 配置页全部样式。 */
export const CLIENT_CSS = `
.cxp-settings{box-sizing:border-box;display:flex;flex-direction:column;width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit}
.cxp-settings *,.cxp-settings *::before,.cxp-settings *::after{box-sizing:border-box}
.cxp-form{display:flex;flex-direction:column;width:100%;min-width:0}
.cxp-readonly,.cxp-unavailable{margin:0 0 12px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.cxp-footer{display:flex;align-items:center;gap:8px;padding-top:16px}
.cxp-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}
.cxp-save{appearance:none;border:1px solid transparent;border-radius:var(--dsw-radius-md);padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.cxp-save:disabled{opacity:.4;cursor:default}
.cxp-save:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.cxp-section{display:flex;flex-direction:column;gap:6px;padding:16px 0;min-width:0}
.cxp-section + .cxp-section{border-top:.5px solid var(--dsw-alias-border-l4)}
.cxp-section-head{display:flex;align-items:center;gap:8px;min-width:0}
.cxp-section-head h3{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
.cxp-section-note{margin:2px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.cxp-section-tail{display:inline-flex;align-items:center;gap:4px;margin-left:auto}
.cxp-field{display:flex;flex-direction:column;gap:6px;padding:12px 0;min-width:0}
.cxp-field + .cxp-field{border-top:.5px solid var(--dsw-alias-border-l2)}
.cxp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:16px;min-width:0}
.cxp-grid > .cxp-field{padding:0;border-top:0}
.cxp-head{display:flex;align-items:center;gap:8px;min-width:0}
.cxp-label-group{display:flex;align-items:center;gap:4px;flex:1;min-width:0}
.cxp-label{flex:0 1 auto;min-width:0;margin:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.cxp-help-button{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm);background:none;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.cxp-help-button:hover,.cxp-help-button[aria-expanded=true]{background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-secondary)}
.cxp-help-button:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.cxp-help{padding:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.cxp-help p{margin:0}
.cxp-help p + p{margin-top:8px}
.cxp-badges{display:inline-flex;align-items:center;gap:8px}
.cxp-reset{border:none;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}
.cxp-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.cxp-reset:disabled{cursor:default}
.cxp-input{width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);min-width:0}
.cxp-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.cxp-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.cxp-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}
.cxp-select-box{position:relative;display:flex;align-items:center;width:100%;height:34px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);min-width:0}
.cxp-select-box:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.cxp-select-box[data-disabled=true]{opacity:.5}
.cxp-select{appearance:none;width:100%;height:100%;padding:0 32px 0 12px;border:0;background:none;font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);min-width:0;cursor:pointer}
.cxp-select:focus-visible{outline:none}
.cxp-select:disabled{cursor:default;color:var(--dsw-alias-label-tertiary)}
.cxp-chevron{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;pointer-events:none;color:var(--dsw-alias-label-tertiary)}
.cxp-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.cxp-invalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}
.cxp-empty{margin:8px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.cxp-tag{display:inline-flex;align-items:center;border-radius:999px;corner-shape:round;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap}
.cxp-tag[data-tone=outline]{border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary)}
.cxp-tag[data-tone=solid]{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.cxp-tag[data-tone=neutral]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
.cxp-tag[data-tone=quiet]{color:var(--dsw-alias-label-tertiary)}
.cxp-tag[data-tone=success]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}
.cxp-tag[data-tone=info]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary)}
.cxp-tag[data-tone=warning]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary)}
.cxp-tag[data-tone=danger]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}
.cxp-check{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer}
.cxp-check input{flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:inherit}
.cxp-check input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.cxp-check:has(input:disabled){cursor:default;opacity:.5}
.cxp-list{margin-top:6px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);overflow:hidden;background:var(--dsw-alias-bg-layer-3)}
.cxp-list-row{display:flex;align-items:center;gap:10px;padding:9px 12px;font-size:13px;min-width:0}
.cxp-list-row + .cxp-list-row{border-top:.5px solid var(--dsw-alias-border-l2)}
.cxp-list-row[data-missing=true]{opacity:.55}
.cxp-row-title{flex:none;font-size:13px;font-weight:400;line-height:1.5;color:var(--dsw-alias-label-primary)}
.cxp-row-path{flex:1 1 auto;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption);word-break:break-all}
.cxp-process{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l4);min-width:0}
.cxp-process-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;min-width:0}
.cxp-process-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
.cxp-process-status h3{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
.cxp-process-meta{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
.cxp-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cxp-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;font:inherit;font-size:12px;line-height:18px;height:28px;padding:0 10px;color:var(--dsw-alias-label-primary);background:transparent}
.cxp-button:disabled{cursor:not-allowed;opacity:.4}
.cxp-button[data-variant=primary]{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.cxp-button[data-variant=primary]:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.cxp-button[data-variant=outline]{border:.5px solid var(--dsw-alias-border-l3)}
.cxp-button[data-variant=outline]:hover:not(:disabled),.cxp-button[data-variant=ghost]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.cxp-button[data-variant=ghost]:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.cxp-button:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.cxp-url-label{margin:0 0 4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.cxp-url{display:block;padding:8px 10px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.cxp-error{margin:0;padding:6px 10px;border:.5px solid var(--dsw-alias-state-error-primary);border-radius:var(--dsw-radius-md);font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}
`
