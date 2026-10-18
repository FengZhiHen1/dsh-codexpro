window.__ModuleLoader__.load({ id: "dsh-codexpro", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/core/config-fields.js
var CONFIG_NS = "codexpro";
var PACKAGE_NAME = "dsh-codexpro";
var ROW_CONFIG_KEY = `${PACKAGE_NAME}#${CONFIG_NS}`;

// src/core/contract.js
var ENDPOINTS = Object.freeze([
  "catalog",
  "status",
  "start",
  "stop"
]);
var RPC_NAMESPACE = "codexpro";
var API_CHANNEL = "/api";
var ERROR_CODES = Object.freeze({
  invalidConfig: "INVALID_CONFIG",
  configWriteFailed: "CONFIG_WRITE_FAILED",
  notFound: "NOT_FOUND",
  alreadyRunning: "ALREADY_RUNNING",
  notRunning: "NOT_RUNNING",
  spawnFailed: "SPAWN_FAILED",
  startFailed: "START_FAILED",
  stopFailed: "STOP_FAILED",
  unsupported: "UNSUPPORTED",
  internal: "INTERNAL"
});

// src/client/api.js
var CALL_TIMEOUT_MS = 15e3;
var RpcError = class extends Error {
  /**
   * @param {string} message 可读消息
   * @param {object} [options]
   * @param {string} [options.code] 稳定错误码；transport 表示通道层失败
   */
  constructor(message, { code = "internal" } = {}) {
    super(message);
    this.name = "RpcError";
    this.code = code;
  }
};
function createCall(ctx) {
  return async (endpoint, payload = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    let result;
    try {
      result = await ctx.connection.rpc.call(API_CHANNEL, `${RPC_NAMESPACE}/${endpoint}`, payload, controller.signal);
    } catch (error) {
      throw toTransportError(error, endpoint);
    } finally {
      clearTimeout(timer);
    }
    if (result !== null && typeof result === "object" && result.ok === true) return result.value;
    const failure = result !== null && typeof result === "object" && result.error ? result.error : {};
    throw new RpcError(failure.message || "\u8BF7\u6C42\u5931\u8D25", { code: failure.code || "internal" });
  };
}
function toTransportError(error, endpoint) {
  if (error instanceof RpcError) return error;
  const aborted = Boolean(error && (error.name === "AbortError" || error.name === "TimeoutError"));
  const message = aborted ? `\u8C03\u7528 ${endpoint} \u8D85\u65F6\uFF08${CALL_TIMEOUT_MS / 1e3}s\uFF09\uFF1A\u7ED3\u679C\u672A\u77E5\u2014\u2014Host \u4FA7\u52A8\u4F5C\u53EF\u80FD\u4ECD\u5728\u8FDB\u884C\uFF0C\u8BF7\u5237\u65B0\u72B6\u6001\u6838\u5BF9\u3002` : `\u4E0E Host \u7684 RPC \u901A\u9053\u5931\u8D25\uFF08${endpoint}\uFF09\uFF1A${error && error.message ? error.message : String(error)}`;
  return new RpcError(message, { code: "transport" });
}

// src/client/card.jsx
var import_react7 = require("react");

// src/client/fields.jsx
var import_react2 = require("react");

// src/client/controls.jsx
var import_react = require("react");
function Tag({ tone = "outline", children }) {
  return (0, import_react.createElement)("span", { className: "cxp-tag", "data-tone": tone }, children);
}
function Checkbox({ checked, onChange, label, ariaLabel, disabled = false }) {
  return (0, import_react.createElement)("label", { className: "cxp-check" }, [
    (0, import_react.createElement)("input", {
      key: "input",
      type: "checkbox",
      checked,
      disabled,
      "aria-label": ariaLabel,
      onChange: (event) => {
        onChange(event.target.checked);
      }
    }),
    label ? (0, import_react.createElement)("span", { key: "label" }, label) : null
  ]);
}
function InfoIcon() {
  return (0, import_react.createElement)("svg", {
    width: 12,
    height: 12,
    viewBox: "0 0 14 14",
    fill: "none",
    "aria-hidden": "true"
  }, [
    (0, import_react.createElement)("path", {
      key: "ring",
      d: "M12.5757 7.00012C12.5757 3.92085 10.0794 1.42463 7.00012 1.42456C3.9208 1.42456 1.42456 3.9208 1.42456 7.00012C1.42463 10.0794 3.92085 12.5757 7.00012 12.5757C10.0793 12.5756 12.5756 10.0793 12.5757 7.00012ZM13.8002 7.00012C13.8001 10.7559 10.7559 13.8001 7.00012 13.8002C3.2443 13.8002 0.199291 10.7559 0.199219 7.00012C0.199219 3.24426 3.24426 0.199219 7.00012 0.199219C10.7559 0.199291 13.8002 3.2443 13.8002 7.00012Z",
      fill: "currentColor"
    }),
    (0, import_react.createElement)("path", { key: "dot", d: "M7.6127 3.18921V4.55986H6.38735V3.18921H7.6127Z", fill: "currentColor" }),
    (0, import_react.createElement)("path", { key: "stem", d: "M7.6127 5.68921V10.8109H6.38735V5.68921H7.6127Z", fill: "currentColor" })
  ]);
}
function ChevronIcon() {
  return (0, import_react.createElement)("span", { className: "cxp-chevron", "aria-hidden": "true" }, (0, import_react.createElement)("svg", {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none"
  }, (0, import_react.createElement)("path", {
    d: "M3 4.5L6 7.5L9 4.5",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
function ActionButton({ label, variant = "ghost", disabled = false, onClick }) {
  return (0, import_react.createElement)("button", {
    type: "button",
    className: "cxp-button",
    "data-variant": variant,
    disabled,
    onClick
  }, label);
}

// src/client/fields.jsx
function describedBy(...ids) {
  const value = ids.filter(Boolean).join(" ");
  return value === "" ? void 0 : value;
}
function SettingsForm({ labels, state, onSave, onDiscard, children }) {
  const discard = (0, import_react2.useRef)(onDiscard);
  discard.current = onDiscard;
  (0, import_react2.useEffect)(() => () => {
    discard.current();
  }, []);
  if (!state.available) {
    return (0, import_react2.createElement)("p", { className: "cxp-unavailable", role: "status" }, labels.unavailable);
  }
  const blocked = !state.dirty || state.invalid || state.saving;
  return (0, import_react2.createElement)("div", { className: "cxp-form" }, [
    !state.writable ? (0, import_react2.createElement)("p", { key: "readonly", className: "cxp-readonly", role: "status" }, labels.readOnly) : null,
    (0, import_react2.createElement)("div", { key: "children" }, children),
    (0, import_react2.createElement)("div", { key: "footer", className: "cxp-footer" }, [
      state.failed ? (0, import_react2.createElement)("p", { key: "failed", className: "cxp-failed", role: "status" }, labels.saveFailed) : null,
      (0, import_react2.createElement)("button", {
        key: "save",
        type: "button",
        className: "cxp-save",
        disabled: blocked,
        onClick: onSave
      }, state.saving ? labels.saving : labels.save)
    ])
  ]);
}
function HelpButton({ help, id, open, onToggle }) {
  return (0, import_react2.createElement)("button", {
    type: "button",
    className: "cxp-help-button",
    "aria-label": help.label,
    "aria-expanded": open,
    "aria-controls": id,
    onClick: () => {
      onToggle(!open);
    }
  }, (0, import_react2.createElement)(InfoIcon));
}
function HelpRegion({ help, id }) {
  return (0, import_react2.createElement)("div", {
    id,
    className: "cxp-help",
    role: "region",
    "aria-label": help.label
  }, (0, import_react2.createElement)("p", null, help.content));
}
function OverrideBadge({ overridden, overriddenLabel, resetLabel, disabled, onReset }) {
  if (!overridden) return null;
  return (0, import_react2.createElement)("span", { className: "cxp-badges" }, [
    (0, import_react2.createElement)(Tag, { key: "tag", tone: "neutral" }, overriddenLabel),
    (0, import_react2.createElement)("button", {
      key: "reset",
      type: "button",
      className: "cxp-reset",
      disabled,
      onClick: onReset
    }, resetLabel)
  ]);
}
function SettingsValueField({
  id,
  label,
  hint,
  help,
  text,
  overridden,
  invalid,
  overriddenLabel,
  resetLabel,
  invalidLabel,
  disabled,
  onEdit,
  onReset,
  numeric,
  placeholder
}) {
  const [helpOpen, setHelpOpen] = (0, import_react2.useState)(false);
  const helpId = `${id}-help`;
  const messageId = `${id}-message`;
  const hasMessage = invalid || Boolean(hint);
  return (0, import_react2.createElement)("div", { className: "cxp-field" }, [
    (0, import_react2.createElement)("div", { key: "head", className: "cxp-head" }, [
      (0, import_react2.createElement)("div", { key: "labels", className: "cxp-label-group" }, [
        (0, import_react2.createElement)("label", { key: "label", className: "cxp-label", htmlFor: id }, label),
        help ? (0, import_react2.createElement)(HelpButton, { key: "help", help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null
      ]),
      (0, import_react2.createElement)(OverrideBadge, {
        key: "badge",
        overridden,
        overriddenLabel,
        resetLabel,
        disabled,
        onReset
      })
    ]),
    (0, import_react2.createElement)("input", {
      key: "input",
      id,
      className: "cxp-input",
      type: "text",
      ...numeric === true ? { inputMode: "numeric" } : {},
      ...invalid ? { "aria-invalid": true } : {},
      "aria-describedby": describedBy(hasMessage ? messageId : "", helpOpen ? helpId : ""),
      value: text,
      placeholder: placeholder ?? "",
      disabled,
      onChange: (event) => {
        onEdit(event.target.value);
      }
    }),
    hasMessage ? (0, import_react2.createElement)("p", {
      key: "message",
      id: messageId,
      className: invalid ? "cxp-invalid" : "cxp-hint"
    }, invalid ? invalidLabel ?? hint : hint) : null,
    help && helpOpen ? (0, import_react2.createElement)(HelpRegion, { key: "help-region", help, id: helpId }) : null
  ]);
}
function SettingsSelectField({
  id,
  label,
  hint,
  help,
  value,
  options,
  overridden,
  invalid,
  overriddenLabel,
  resetLabel,
  invalidLabel,
  disabled,
  onEdit,
  onReset
}) {
  const [helpOpen, setHelpOpen] = (0, import_react2.useState)(false);
  const helpId = `${id}-help`;
  const messageId = `${id}-message`;
  const hasMessage = invalid || Boolean(hint);
  return (0, import_react2.createElement)("div", { className: "cxp-field" }, [
    (0, import_react2.createElement)("div", { key: "head", className: "cxp-head" }, [
      (0, import_react2.createElement)("div", { key: "labels", className: "cxp-label-group" }, [
        (0, import_react2.createElement)("label", { key: "label", className: "cxp-label", htmlFor: id }, label),
        help ? (0, import_react2.createElement)(HelpButton, { key: "help", help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null
      ]),
      (0, import_react2.createElement)(OverrideBadge, {
        key: "badge",
        overridden,
        overriddenLabel,
        resetLabel,
        disabled,
        onReset
      })
    ]),
    (0, import_react2.createElement)("div", {
      key: "box",
      className: "cxp-select-box",
      "data-disabled": disabled
    }, [
      (0, import_react2.createElement)("select", {
        key: "select",
        id,
        className: "cxp-select",
        value,
        disabled,
        ...invalid ? { "aria-invalid": true } : {},
        "aria-describedby": describedBy(hasMessage ? messageId : "", helpOpen ? helpId : ""),
        onChange: (event) => {
          onEdit(event.target.value);
        }
      }, options.map((option) => (0, import_react2.createElement)("option", { key: option.value, value: option.value }, option.label))),
      (0, import_react2.createElement)(ChevronIcon, { key: "chevron" })
    ]),
    hasMessage ? (0, import_react2.createElement)("p", {
      key: "message",
      id: messageId,
      className: invalid ? "cxp-invalid" : "cxp-hint"
    }, invalid ? invalidLabel ?? hint : hint) : null,
    help && helpOpen ? (0, import_react2.createElement)(HelpRegion, { key: "help-region", help, id: helpId }) : null
  ]);
}
function SettingsSection({ id, title, note, help, trailing, children }) {
  const [helpOpen, setHelpOpen] = (0, import_react2.useState)(false);
  const headingId = `${id}-title`;
  const helpId = `${id}-help`;
  return (0, import_react2.createElement)("section", { className: "cxp-section", "aria-labelledby": headingId }, [
    (0, import_react2.createElement)("div", { key: "head", className: "cxp-section-head" }, [
      (0, import_react2.createElement)("h3", { key: "title", id: headingId }, title),
      trailing ? (0, import_react2.createElement)("span", { key: "tail", className: "cxp-section-tail" }, trailing) : null,
      help ? (0, import_react2.createElement)(HelpButton, { key: "help", help, id: helpId, open: helpOpen, onToggle: setHelpOpen }) : null
    ]),
    note ? (0, import_react2.createElement)("p", { key: "note", className: "cxp-section-note" }, note) : null,
    help && helpOpen ? (0, import_react2.createElement)(HelpRegion, { key: "help-region", help, id: helpId }) : null,
    (0, import_react2.createElement)("div", { key: "body" }, children)
  ]);
}

// src/client/styles.js
var CLIENT_CSS = `
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
`;

// src/client/parts.jsx
var import_react3 = require("react");

// src/client/theme.js
var STATE_DISPLAY = Object.freeze({
  idle: { key: "statusIdle", tone: "neutral" },
  starting: { key: "statusStarting", tone: "warning" },
  running: { key: "statusRunning", tone: "success" },
  stopping: { key: "statusStopping", tone: "warning" },
  failed: { key: "statusFailed", tone: "danger" }
});
function displayState(state) {
  return STATE_DISPLAY[state] ?? { key: "statusUnknown", tone: "warning" };
}

// src/client/parts.jsx
function StatusTag({ state, t }) {
  const info = displayState(state);
  return (0, import_react3.createElement)(Tag, { tone: info.tone }, t(info.key));
}
function ErrorNote({ message }) {
  if (!message) return null;
  return (0, import_react3.createElement)("p", { className: "cxp-error", role: "alert" }, message);
}

// src/core/codexpro.js
var ARG = Object.freeze({
  root: "--root",
  port: "--port",
  tunnel: "--tunnel",
  hostname: "--hostname",
  tunnelName: "--tunnel-name",
  mode: "--mode",
  bash: "--bash",
  write: "--write"
});
var VERSION_ARGS = Object.freeze(["--version"]);
var TUNNEL_MODES = Object.freeze(["none", "ngrok", "cloudflare", "cloudflare-named", "tailscale"]);
var HOSTNAME_REQUIRED_TUNNELS = Object.freeze(["ngrok", "cloudflare-named", "tailscale"]);
var TUNNEL_NAME_REQUIRED_TUNNELS = Object.freeze(["cloudflare-named"]);
var TUNNEL_NAME_MAX_LENGTH = 128;
var BASH_MODES = Object.freeze(["off", "safe", "full"]);
var WRITE_MODES = Object.freeze(["off", "handoff", "workspace"]);
var DEFAULTS = Object.freeze({
  port: "8787",
  bash: "safe",
  write: "workspace",
  tunnel: "none"
});
var PORT_RANGE = Object.freeze({ min: 1, max: 65535 });

// src/client/store.js
function createSnapshotStore(initial) {
  let state = initial;
  const listeners = /* @__PURE__ */ new Set();
  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("dsh-codexpro: snapshot subscriber failed", error);
      }
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next) {
      if (Object.is(next, state)) return;
      state = next;
      notify();
    }
  };
}

// src/client/settings-model.js
function settingsTextField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
var SettingsFormModel = class {
  /**
   * @param {object} scope 官方 ConfigForm（getSnapshot / subscribe / mutate）
   * @param {SettingsFieldSpec[]} specs 本卡编辑的字段
   */
  constructor(scope, specs) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.staged = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.baseline = void 0;
    this.unsubscribe = scope.subscribe(() => {
      this.publish();
    });
    this.saving = false;
    this.failed = false;
  }
  /**
   * 发布一张卡的投影，scope 或草稿变化时重建。
   * @param {() => unknown} project 从当前读取构造卡状态
   * @returns {{getSnapshot: () => unknown, subscribe: (listener: () => void) => (() => void), set: (next: unknown) => void}} store
   */
  bind(project) {
    const store = createSnapshotStore(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  /**
   * 卡级状态：Host 提供什么、一次保存会做什么。
   * @returns {{available: boolean, writable: boolean, dirty: boolean, invalid: boolean, saving: boolean, failed: boolean}} shell
   */
  shell() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.op === void 0),
      saving: this.saving,
      failed: this.failed
    };
  }
  /**
   * 一个控件的状态。
   * @param {string} field 字段名
   * @returns {{text: string, overridden: boolean, invalid: boolean}} 控件状态
   */
  field(field) {
    const staged = this.staged.get(field);
    const spec = this.spec(field);
    if (staged === void 0) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === void 0
    };
  }
  /**
   * 绑定到本模型的编辑、重置、保存与丢弃动作。
   * @returns {{edit: Function, resetField: Function, save: Function, discard: Function}} 动作
   */
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        void this.save();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return;
        this.staged.clear();
        this.baseline = void 0;
        this.failed = false;
        this.publish();
      }
    };
  }
  /**
   * 写入全部草稿，再按 Host 接受结果重新播种。
   *
   * Host 是「值是否被接受」的唯一权威，故结果从 section 回读，而不是本地预测。
   * 未落地的保存保留草稿，让用户改正而不是重打。
   * @returns {Promise<void>} 全部写入与回读完成后结算
   */
  async save() {
    const plan = this.plan();
    if (!plan.length || this.saving || !this.scope.getSnapshot().writable || plan.some((item) => item.op === void 0)) return;
    this.saving = true;
    this.failed = false;
    this.publish();
    try {
      const ops = plan.map((item) => item.op);
      const landed = await this.scope.mutate(ops, this.baseline?.revision);
      if (!landed) {
        this.failed = true;
        return;
      }
      this.staged.clear();
      this.baseline = void 0;
      this.failed = false;
    } catch {
      this.failed = true;
    } finally {
      this.saving = false;
      this.publish();
    }
  }
  /** 释放对 Host 快照的订阅。 */
  dispose() {
    this.unsubscribe();
    this.listeners.clear();
  }
  /**
   * 一次保存会写入的每个草稿项。
   * @returns {Array<{field: string, op?: object}>} 计划写入；非法草稿只带 field
   */
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, op: { op: "unset", path: [field] } });
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue;
      const write = spec.parse(staged.text);
      if (write === void 0) plan.push({ field });
      else if (write.kind === "clear") plan.push({ field, op: { op: "unset", path: [field] } });
      else plan.push({ field, op: { op: "set", path: [field], value: write.value } });
    }
    return plan;
  }
  /**
   * 暂存一次编辑。
   * @param {string} field 字段名
   * @param {{text: string, clear: boolean}} edit 编辑
   * @returns {void}
   */
  stage(field, edit) {
    this.baseline ??= this.scope.getSnapshot();
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  /**
   * 取字段规格；缺失即为接线错误，必须响亮失败而非得到一个静默无效控件。
   * @param {string} field 字段名
   * @returns {SettingsFieldSpec} 字段规格
   */
  spec(field) {
    const spec = this.specs.get(field);
    if (spec === void 0) throw new Error(`plugin card has no field ${field}`);
    return spec;
  }
  /**
   * 当前 Host 快照。
   * @returns {object} 快照
   */
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  /**
   * section 内某字段的已接受值。
   * @param {string} field 字段名
   * @returns {unknown} 值
   */
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  /**
   * 组合层中某字段的值（重置时回落的目标）。
   * @param {string} field 字段名
   * @returns {unknown} 值
   */
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  /**
   * 用户层（判断字段是否被覆盖）。
   * @returns {object|undefined} 用户层
   */
  userLayer() {
    return this.snapshotOf().user;
  }
  /**
   * 用户层是否承载该字段。
   * @param {string} field 字段名
   * @returns {boolean} 承载时为 true
   */
  stored(field) {
    const user = this.userLayer();
    return user !== void 0 && Object.hasOwn(user, field);
  }
  /** 通知全部投影监听器。 */
  publish() {
    for (const listener of this.listeners) listener();
  }
};

// src/client/form.js
var AUTHORIZED = "authorized";
var TUNNEL_MODE = "tunnelMode";
var TUNNEL_HOSTNAME = "tunnelHostname";
var TUNNEL_NAME = "tunnelName";
var PORT = "port";
var BASH_MODE = "bashMode";
var WRITE_MODE = "writeMode";
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeAuthorized(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === true) result[key] = true;
  }
  return result;
}
function authorizedOfText(text) {
  try {
    return normalizeAuthorized(JSON.parse(String(text)));
  } catch {
    return {};
  }
}
var authorizedSpec = {
  field: AUTHORIZED,
  format: (value) => JSON.stringify(normalizeAuthorized(value)),
  parse: (text) => {
    let parsed;
    try {
      parsed = JSON.parse(String(text));
    } catch {
      return void 0;
    }
    if (!isPlainObject(parsed)) return void 0;
    for (const entry of Object.values(parsed)) {
      if (typeof entry !== "boolean") return void 0;
    }
    const normalized = normalizeAuthorized(parsed);
    if (Object.keys(normalized).length === 0) return { kind: "clear" };
    return { kind: "set", value: normalized };
  }
};
function optionSpec(field, allowed) {
  return {
    field,
    format: (value) => typeof value === "string" && allowed.includes(value) ? value : "",
    parse: (text) => {
      const trimmed = String(text).trim();
      return allowed.includes(trimmed) ? { kind: "set", value: trimmed } : void 0;
    }
  };
}
var portSpec = {
  field: PORT,
  format: (value) => typeof value === "string" ? value : "",
  parse: (text) => {
    const trimmed = String(text).trim();
    if (trimmed === "") return void 0;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < PORT_RANGE.min || parsed > PORT_RANGE.max) return void 0;
    return { kind: "set", value: trimmed };
  }
};
var tunnelNameSpec = {
  field: TUNNEL_NAME,
  format: (value) => typeof value === "string" ? value : "",
  parse: (text) => {
    const trimmed = String(text).trim();
    if (trimmed === "") return { kind: "clear" };
    if (trimmed.length > TUNNEL_NAME_MAX_LENGTH) return void 0;
    return { kind: "set", value: trimmed };
  }
};
var SPECS = [
  optionSpec(TUNNEL_MODE, TUNNEL_MODES),
  settingsTextField(TUNNEL_HOSTNAME),
  tunnelNameSpec,
  portSpec,
  optionSpec(BASH_MODE, BASH_MODES),
  optionSpec(WRITE_MODE, WRITE_MODES),
  authorizedSpec
];
function needsTunnelName(tunnelMode) {
  return TUNNEL_NAME_REQUIRED_TUNNELS.includes(String(tunnelMode));
}
function missingTunnelField(state) {
  const textOf = (field) => String(state?.[field]?.text ?? "").trim();
  const mode = textOf(TUNNEL_MODE);
  return {
    tunnelHostname: HOSTNAME_REQUIRED_TUNNELS.includes(mode) && textOf(TUNNEL_HOSTNAME) === "",
    tunnelName: needsTunnelName(mode) && textOf(TUNNEL_NAME) === ""
  };
}
function projection(form) {
  const state = { ...form.shell() };
  for (const spec of SPECS) state[spec.field] = form.field(spec.field);
  return state;
}
function createController(scope) {
  const form = new SettingsFormModel(scope, SPECS);
  const store = form.bind(() => projection(form));
  return {
    form,
    // `hooks` 是保留键：renderer 把每个成员消费成 `use<Name>` 选择器 hook，
    // 且不会把 `hooks` 本身传进 props。其余成员平铺进 props（官方各卡片同形）。
    inject: () => ({ hooks: { codexProForm: store }, ...form.actions() })
  };
}

// src/client/panels.jsx
var import_react4 = require("react");
var NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS);
var EMPTY_MISSING = Object.freeze({ tunnelHostname: false, tunnelName: false });
var TUNNEL_LABEL_KEY = Object.freeze({
  none: "tunnelNone",
  ngrok: "tunnelNgrok",
  cloudflare: "tunnelCloudflare",
  "cloudflare-named": "tunnelCloudflareNamed",
  tailscale: "tunnelTailscale"
});
function commonField(field, overriddenLabel, resetLabel) {
  return {
    text: field.text,
    overridden: field.overridden,
    invalid: field.invalid,
    overriddenLabel,
    resetLabel
  };
}
function NetworkGroup({ fields, disabled, onEdit, onReset, missing, t }) {
  const needsHost = NEEDS_HOSTNAME.has(fields.tunnelMode.text);
  const needsName = needsTunnelName(fields.tunnelMode.text);
  const hostnameInvalid = fields.tunnelHostname.invalid || missing.tunnelHostname;
  const nameInvalid = fields.tunnelName.invalid || missing.tunnelName;
  const overriddenLabel = t("overridden");
  const resetLabel = t("reset");
  return (0, import_react4.createElement)(SettingsSection, {
    id: "codexpro-network",
    title: t("networkTitle"),
    note: t("networkNote")
  }, [
    (0, import_react4.createElement)("div", { key: "basic", className: "cxp-grid" }, [
      (0, import_react4.createElement)(SettingsSelectField, {
        key: "tunnel",
        id: "codexpro-tunnel-mode",
        label: t("tunnelMode"),
        hint: t("tunnelModeHint"),
        help: { label: t("helpTunnelModeLabel"), content: t("helpTunnelModeContent") },
        value: fields.tunnelMode.text,
        options: TUNNEL_MODES.map((mode) => ({ value: mode, label: t(TUNNEL_LABEL_KEY[mode] ?? mode) })),
        overridden: fields.tunnelMode.overridden,
        invalid: fields.tunnelMode.invalid,
        overriddenLabel,
        resetLabel,
        disabled,
        onEdit: (next) => onEdit(TUNNEL_MODE, next),
        onReset: () => onReset(TUNNEL_MODE)
      }),
      (0, import_react4.createElement)(SettingsValueField, {
        key: "port",
        id: "codexpro-port",
        label: t("port"),
        hint: fields.port.invalid ? t("portInvalid") : t("portHint"),
        help: { label: t("helpPortLabel"), content: t("helpPortContent") },
        ...commonField(fields.port, overriddenLabel, resetLabel),
        invalidLabel: t("portInvalid"),
        disabled,
        numeric: true,
        placeholder: "8787",
        onEdit: (text) => onEdit(PORT, text),
        onReset: () => onReset(PORT)
      })
    ]),
    needsHost || needsName ? (0, import_react4.createElement)("div", { key: "tunnel-extra", className: "cxp-grid" }, [
      needsHost ? (0, import_react4.createElement)(SettingsValueField, {
        key: "hostname",
        id: "codexpro-tunnel-hostname",
        label: t("tunnelHostname"),
        hint: t("tunnelHostnameHint"),
        help: { label: t("helpTunnelHostnameLabel"), content: t("helpTunnelHostnameContent") },
        ...commonField(fields.tunnelHostname, overriddenLabel, resetLabel),
        invalid: hostnameInvalid,
        invalidLabel: missing.tunnelHostname ? t("tunnelHostnameRequired") : void 0,
        disabled,
        placeholder: "your-domain.ngrok-free.dev",
        onEdit: (text) => onEdit(TUNNEL_HOSTNAME, text),
        onReset: () => onReset(TUNNEL_HOSTNAME)
      }) : null,
      needsName ? (0, import_react4.createElement)(SettingsValueField, {
        key: "tunnel-name",
        id: "codexpro-tunnel-name",
        label: t("tunnelName"),
        hint: t("tunnelNameHint"),
        help: { label: t("helpTunnelNameLabel"), content: t("helpTunnelNameContent") },
        ...commonField(fields.tunnelName, overriddenLabel, resetLabel),
        invalid: nameInvalid,
        invalidLabel: missing.tunnelName ? t("tunnelNameRequired") : t("tunnelNameInvalid"),
        disabled,
        placeholder: "my-tunnel",
        onEdit: (text) => onEdit(TUNNEL_NAME, text),
        onReset: () => onReset(TUNNEL_NAME)
      }) : null
    ]) : null
  ]);
}
function PermissionGroup({ fields, disabled, onEdit, onReset, t }) {
  const overriddenLabel = t("overridden");
  const resetLabel = t("reset");
  const optionField = (key, field, labelKey, hintKey, helpLabelKey, helpContentKey) => (0, import_react4.createElement)(SettingsSelectField, {
    key,
    id: `codexpro-${key}`,
    label: t(labelKey),
    hint: t(hintKey),
    help: { label: t(helpLabelKey), content: t(helpContentKey) },
    value: field.text,
    options: (key === "bash" ? BASH_MODES : WRITE_MODES).map((mode) => ({ value: mode, label: mode })),
    overridden: field.overridden,
    invalid: field.invalid,
    overriddenLabel,
    resetLabel,
    disabled,
    onEdit: (next) => onEdit(key === "bash" ? BASH_MODE : WRITE_MODE, next),
    onReset: () => onReset(key === "bash" ? BASH_MODE : WRITE_MODE)
  });
  return (0, import_react4.createElement)(SettingsSection, {
    id: "codexpro-permission",
    title: t("permissionTitle"),
    note: t("permissionNote")
  }, (0, import_react4.createElement)("div", { className: "cxp-grid" }, [
    optionField("bash", fields.bashMode, "bashMode", "bashModeHint", "helpBashModeLabel", "helpBashModeContent"),
    optionField("write", fields.writeMode, "writeMode", "writeModeHint", "helpWriteModeLabel", "helpWriteModeContent")
  ]));
}
function OptionsFields({ fields, missing = EMPTY_MISSING, disabled, onEdit, onReset, t }) {
  return (0, import_react4.createElement)("div", null, [
    (0, import_react4.createElement)(NetworkGroup, { key: "network", fields, missing, disabled, onEdit, onReset, t }),
    (0, import_react4.createElement)(PermissionGroup, { key: "permission", fields, disabled, onEdit, onReset, t })
  ]);
}
function WorkspacesField({ workspaces, authorized, disabled, onEdit, t }) {
  const toggle = (path, next) => {
    const mapped = { ...authorized };
    if (next) mapped[path] = true;
    else delete mapped[path];
    onEdit(AUTHORIZED, JSON.stringify(normalizeAuthorized(mapped)));
  };
  const list = Array.isArray(workspaces) ? workspaces : [];
  const selected = list.filter((item) => authorized[item.path] === true).length;
  return (0, import_react4.createElement)(SettingsSection, {
    id: "codexpro-workspaces",
    title: t("workspacesTitle"),
    note: t("workspacesNote"),
    help: { label: t("helpWorkspacesLabel"), content: t("helpWorkspacesContent") },
    trailing: list.length ? t("workspacesCount", { selected, total: list.length }) : null
  }, list.length === 0 ? (0, import_react4.createElement)("p", { className: "cxp-empty" }, t("workspacesEmpty")) : (0, import_react4.createElement)("div", { className: "cxp-list" }, list.map((item, index) => (0, import_react4.createElement)("div", {
    key: item.path,
    className: "cxp-list-row",
    "data-missing": !item.exists
  }, [
    (0, import_react4.createElement)(Checkbox, {
      key: "box",
      checked: authorized[item.path] === true,
      disabled: disabled || !item.exists,
      ariaLabel: item.title,
      onChange: (next) => toggle(item.path, next)
    }),
    (0, import_react4.createElement)("span", { key: "title", className: "cxp-row-title" }, item.title),
    (0, import_react4.createElement)("span", { key: "path", className: "cxp-row-path" }, item.path),
    item.exists ? null : (0, import_react4.createElement)(Tag, { key: "missing", tone: "neutral" }, t("missingDirectory"))
  ]))));
}

// src/client/use-catalog.js
var import_react5 = require("react");
function useCatalog(call) {
  const [catalog, setCatalog] = (0, import_react5.useState)(null);
  const [error, setError] = (0, import_react5.useState)("");
  const refresh = (0, import_react5.useCallback)(async () => {
    try {
      setCatalog(await call("catalog"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [call]);
  (0, import_react5.useEffect)(() => {
    refresh();
  }, [refresh]);
  return { catalog, anchorDir: catalog?.anchorDir ?? "", error, refresh };
}

// src/client/use-process.js
var import_react6 = require("react");
function describeError(failure) {
  return failure instanceof Error ? failure.message : String(failure);
}
function useProcess(call) {
  const [status, setStatus] = (0, import_react6.useState)(null);
  const [error, setError] = (0, import_react6.useState)("");
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const latestRead = (0, import_react6.useRef)(0);
  const refresh = (0, import_react6.useCallback)(async () => {
    const read = ++latestRead.current;
    try {
      const next = await call("status");
      if (read === latestRead.current) setStatus(next);
    } catch (failure) {
      if (read === latestRead.current) setError(describeError(failure));
    }
  }, [call]);
  (0, import_react6.useEffect)(() => {
    refresh();
  }, [refresh]);
  const act = (0, import_react6.useCallback)(async (action) => {
    setBusy(true);
    setError("");
    let failed = false;
    try {
      await call(action);
    } catch (failure) {
      failed = true;
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
    if (!failed) await refresh();
  }, [call, refresh]);
  return { status, error, busy, refresh, act };
}

// src/client/card.jsx
function CodexProCard(props) {
  if (props.view === "summary") return (0, import_react7.createElement)("span", null, props.t("summary"));
  return (0, import_react7.createElement)(CodexProPage, props);
}
function CodexProPage(props) {
  const form = props.useCodexProForm((snapshot) => snapshot);
  const process = useProcess(props.call);
  const { catalog } = useCatalog(props.call);
  const t = props.t;
  const disabled = !form.writable || form.saving;
  const missing = missingTunnelField(form);
  const invalid = form.invalid || missing.tunnelHostname || missing.tunnelName;
  return (0, import_react7.createElement)("div", { className: "cxp-settings" }, [
    (0, import_react7.createElement)("style", { key: "styles" }, CLIENT_CSS),
    (0, import_react7.createElement)(ProcessBlock, {
      key: "process",
      status: process.status,
      error: process.error,
      busy: process.busy,
      onAction: process.act,
      onRefresh: process.refresh,
      t
    }),
    (0, import_react7.createElement)(SettingsForm, {
      key: "form",
      labels: {
        unavailable: t("unavailable"),
        readOnly: t("readOnly"),
        saveFailed: t("saveFailed"),
        save: t("save"),
        saving: t("saving")
      },
      state: { ...form, invalid },
      onSave: props.save,
      onDiscard: props.discard
    }, [
      (0, import_react7.createElement)(OptionsFields, {
        key: "options",
        fields: {
          tunnelMode: form[TUNNEL_MODE],
          tunnelHostname: form[TUNNEL_HOSTNAME],
          tunnelName: form[TUNNEL_NAME],
          port: form[PORT],
          bashMode: form[BASH_MODE],
          writeMode: form[WRITE_MODE]
        },
        missing,
        disabled,
        onEdit: props.edit,
        onReset: props.resetField,
        t
      }),
      (0, import_react7.createElement)(WorkspacesField, {
        key: "workspaces",
        workspaces: catalog?.workspaces ?? [],
        authorized: authorizedOfText(form[AUTHORIZED]?.text ?? ""),
        disabled,
        onEdit: props.edit,
        t
      }),
      (0, import_react7.createElement)("p", { key: "note", className: "cxp-note" }, t("restartNote"))
    ])
  ]);
}
function ProcessBlock({ status, error, busy, onAction, onRefresh, t }) {
  const state = status?.state ?? (error ? "unknown" : "idle");
  const canStart = state === "idle" || state === "failed";
  const canStop = state === "running" || state === "starting";
  return (0, import_react7.createElement)("section", {
    className: "cxp-process",
    "aria-labelledby": "codexpro-process-title"
  }, [
    (0, import_react7.createElement)("div", { key: "head", className: "cxp-process-head" }, [
      (0, import_react7.createElement)("div", { key: "status", className: "cxp-process-status" }, [
        (0, import_react7.createElement)("h3", { key: "title", id: "codexpro-process-title" }, t("processTitle")),
        (0, import_react7.createElement)(StatusTag, { key: "tag", state, t }),
        status ? (0, import_react7.createElement)("p", { key: "meta", className: "cxp-process-meta" }, t("processMeta", {
          port: status.port,
          tunnel: status.tunnel
        })) : null
      ]),
      (0, import_react7.createElement)("div", { key: "actions", className: "cxp-toolbar" }, [
        (0, import_react7.createElement)(ActionButton, {
          key: "start",
          label: t("start"),
          variant: "primary",
          disabled: busy || !canStart,
          onClick: () => onAction("start")
        }),
        (0, import_react7.createElement)(ActionButton, {
          key: "stop",
          label: t("stop"),
          variant: "outline",
          disabled: busy || !canStop,
          onClick: () => onAction("stop")
        }),
        (0, import_react7.createElement)(ActionButton, {
          key: "refresh",
          label: t("refresh"),
          variant: "ghost",
          disabled: busy,
          onClick: onRefresh
        })
      ])
    ]),
    (0, import_react7.createElement)("div", { key: "url" }, [
      (0, import_react7.createElement)("p", { key: "label", className: "cxp-url-label" }, t("serverUrlLabel")),
      (0, import_react7.createElement)("code", { key: "value", className: "cxp-url" }, status?.url || t("serverUrlEmpty"))
    ]),
    error ? (0, import_react7.createElement)(ErrorNote, { key: "error", message: error }) : null,
    status?.lastError ? (0, import_react7.createElement)(ErrorNote, { key: "last", message: status.lastError }) : null
  ]);
}

// src/client/locales.js
var NS = "settings.codexpro";
var zh = {
  summary: "\u7BA1\u7406 codexpro\uFF1A\u6388\u6743\u5DE5\u4F5C\u533A\u3001\u63A7\u5236\u8FDB\u7A0B\u3001\u9009\u62E9 tunnel \u65B9\u5F0F",
  processTitle: "\u8FDB\u7A0B",
  processMeta: "\u7AEF\u53E3 {port} \xB7 tunnel {tunnel}",
  start: "\u542F\u52A8",
  stop: "\u505C\u6B62",
  refresh: "\u5237\u65B0\u72B6\u6001",
  serverUrlLabel: "Server URL\uFF08\u7C98\u8D34\u5230 ChatGPT \u8FDE\u63A5\u5668\u7684 Server URL \u5B57\u6BB5\uFF09",
  serverUrlEmpty: "\uFF08\u672A\u8FD0\u884C\u6216\u5C1A\u672A\u751F\u6210 token\uFF09",
  statusIdle: "\u672A\u8FD0\u884C",
  statusStarting: "\u542F\u52A8\u4E2D",
  statusRunning: "\u8FD0\u884C\u4E2D",
  statusStopping: "\u505C\u6B62\u4E2D",
  statusFailed: "\u542F\u52A8\u5931\u8D25",
  statusUnknown: "\u672A\u77E5",
  networkTitle: "\u7F51\u7EDC\u63A5\u5165",
  networkNote: "ChatGPT \u901A\u8FC7\u54EA\u4E2A\u5730\u5740\u8FDE\u5230\u672C\u673A\u3002",
  permissionTitle: "\u6743\u9650",
  permissionNote: "\u51B3\u5B9A ChatGPT \u80FD\u5728\u4F60\u7684\u9879\u76EE\u91CC\u505A\u5230\u4EC0\u4E48\u7A0B\u5EA6\uFF0C\u662F\u98CE\u9669\u63A7\u5236\u7684\u4E3B\u8981\u5F00\u5173\u3002",
  workspacesTitle: "\u6388\u6743\u5DE5\u4F5C\u533A",
  workspacesNote: "\u672A\u52FE\u9009\u7684\u76EE\u5F55 ChatGPT \u770B\u4E0D\u5230\u3002",
  workspacesCount: "\u5DF2\u9009 {selected} / {total}",
  workspacesEmpty: "\u5F53\u524D\u5B9E\u4F8B\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u533A\u3002\u5728 DSH \u91CC\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u540E\uFF0C\u5B83\u5C31\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
  missingDirectory: "\u76EE\u5F55\u4E0D\u5B58\u5728",
  tunnelMode: "Tunnel \u65B9\u5F0F",
  tunnelModeHint: "\u9ED8\u8BA4 none\uFF1A\u53EA\u5728\u672C\u673A\u53EF\u7528\uFF0C\u4E0D\u66B4\u9732\u5230\u516C\u7F51",
  tunnelNone: "none \u2014 \u4EC5\u672C\u5730\uFF0C\u65E0\u516C\u7F51\u5165\u53E3",
  tunnelNgrok: "ngrok \u2014 \u7A33\u5B9A dev domain",
  tunnelCloudflare: "cloudflare \u2014 \u5FEB\u901F\u96A7\u9053\uFF08URL \u6BCF\u6B21\u91CD\u542F\u90FD\u53D8\uFF09",
  tunnelCloudflareNamed: "cloudflare-named \u2014 \u5177\u540D\u96A7\u9053\uFF08URL \u7A33\u5B9A\uFF09",
  tunnelTailscale: "tailscale \u2014 Funnel",
  tunnelHostname: "\u516C\u7F51 hostname",
  tunnelHostnameHint: "\u8BE5 tunnel \u65B9\u5F0F\u5FC5\u9700\uFF0Ccodexpro \u4EA6\u5F3A\u5236\u8981\u6C42",
  tunnelName: "Cloudflare \u96A7\u9053\u540D",
  tunnelNameHint: "Cloudflare \u540E\u53F0\u91CC\u90A3\u6761\u5177\u540D\u96A7\u9053\u7684\u540D\u5B57\uFF1B\u4E0E\u4E0A\u9762\u7684 hostname \u662F\u4E24\u4E2A\u4E0D\u540C\u7684\u503C",
  port: "\u672C\u5730\u7AEF\u53E3",
  portHint: "\u4EC5\u5728\u672C\u673A\u7AEF\u53E3\u51B2\u7A81\u65F6\u624D\u9700\u4FEE\u6539",
  bashMode: "bash \u6A21\u5F0F",
  bashModeHint: "safe \u8986\u76D6\u5927\u591A\u6570\u573A\u666F\uFF1Bfull \u7B49\u540C\u4E8E\u4F60\u81EA\u5DF1\u5728\u7EC8\u7AEF\u64CD\u4F5C",
  writeMode: "\u5199\u5165\u6A21\u5F0F",
  writeModeHint: "workspace \u5141\u8BB8\u5728\u5DF2\u6388\u6743\u76EE\u5F55\u5185\u76F4\u63A5\u8BFB\u5199",
  tunnelNameInvalid: "\u96A7\u9053\u540D\u4E0D\u80FD\u8D85\u8FC7 128 \u4E2A\u5B57\u7B26",
  tunnelHostnameRequired: "\u8BE5 tunnel \u65B9\u5F0F\u5FC5\u586B\uFF1A\u516C\u7F51 hostname \u4E0D\u80FD\u4E3A\u7A7A",
  tunnelNameRequired: "\u8BE5 tunnel \u65B9\u5F0F\u5FC5\u586B\uFF1ACloudflare \u96A7\u9053\u540D\u4E0D\u80FD\u4E3A\u7A7A",
  portInvalid: "\u7AEF\u53E3\u9700\u4E3A 1\u201365535 \u7684\u6574\u6570",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u91CD\u7F6E",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  unavailable: "\u672C profile \u672A\u63D0\u4F9B\u8BE5\u914D\u7F6E\u9879\uFF08\u63D2\u4EF6\u884C\u672A\u6FC0\u6D3B\u6216\u8BBE\u7F6E\u9762\u53EA\u8BFB\uFF09\uFF0C\u5F53\u524D\u6309\u63D2\u4EF6\u884C\u914D\u7F6E\u5DE5\u4F5C\u3002",
  readOnly: "\u5F53\u524D profile \u7684\u8BBE\u7F6E\u9762\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u3002",
  saveFailed: "\u4FDD\u5B58\u672A\u751F\u6548\uFF1AHost \u62D2\u7EDD\u4E86\u8FD9\u6B21\u5199\u5165\uFF08\u6821\u9A8C\u672A\u901A\u8FC7\u6216\u7248\u672C\u51B2\u7A81\uFF09\u3002\u5DF2\u56DE\u8BFB\u5F53\u524D\u751F\u6548\u503C\uFF0C\u8349\u7A3F\u4FDD\u7559\uFF1B\u8BF7\u68C0\u67E5\u6807\u7EA2\u7684\u5B57\u6BB5\uFF0C\u82E5\u521A\u624D\u5728\u522B\u5904\u6539\u8FC7\u914D\u7F6E\uFF0C\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002",
  restartNote: "\u6388\u6743\u4E0E\u53C2\u6570\u6539\u52A8\u9700\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\uFF1B\u300C\u4FDD\u5B58\u300D\u5199\u5165\u672C profile \u7684\u884C\u914D\u7F6E\u3002",
  helpTunnelModeLabel: "Tunnel \u65B9\u5F0F\u8BF4\u660E",
  helpTunnelModeContent: "\u51B3\u5B9A ChatGPT \u7528\u4EC0\u4E48\u5730\u5740\u8FDE\u5230\u672C\u673A codexpro\u3002\u9ED8\u8BA4 none\uFF0C\u53EA\u5728\u4F60\u8FD9\u53F0\u673A\u5668\u4E0A\u53EF\u7528\u3002none\uFF1A\u4E0D\u4EA7\u751F\u516C\u7F51\u5165\u53E3\uFF1Bcloudflare\uFF1A\u514D\u914D\u7F6E\u5FEB\u901F\u96A7\u9053\uFF0C\u4F46\u6BCF\u6B21\u91CD\u542F\u6362\u65B0 URL\uFF1Bcloudflare-named\uFF1A\u9700\u5148\u5728 Cloudflare \u5EFA\u597D\u5177\u540D\u96A7\u9053\uFF0CURL \u56FA\u5B9A\uFF1Bngrok\uFF1A\u56FA\u5B9A dev domain\uFF0C\u9700\u672C\u673A\u5DF2\u5B89\u88C5\u5E76\u767B\u5F55\uFF1Btailscale\uFF1A\u8D70 Tailscale Funnel\u3002\u9664 none \u5916\u90FD\u4F1A\u628A\u670D\u52A1\u66B4\u9732\u5230\u516C\u7F51\uFF0C\u8BF7\u786E\u4FDD\u5DF2\u8BBE\u7F6E\u53EF\u4FE1\u7684\u8BBF\u95EE token\u3002",
  helpTunnelHostnameLabel: "\u516C\u7F51 hostname \u8BF4\u660E",
  helpTunnelHostnameContent: "\u516C\u7F51\u4E0A\u9762\u5411 ChatGPT \u7684\u90A3\u4E2A\u57DF\u540D\uFF0C\u5FC5\u987B\u4E0E\u6240\u9009 tunnel \u65B9\u5F0F\u5BF9\u5E94\u3002ngrok \u5F62\u5982 your-domain.ngrok-free.dev\uFF1Bcloudflare-named \u662F\u4F60\u5728 Cloudflare \u4E3A\u8BE5\u96A7\u9053\u7ED1\u5B9A\u7684\u81EA\u5B9A\u4E49\u57DF\u540D\uFF1Btailscale \u5F62\u5982 your-device.your-tailnet.ts.net\u3002\u586B\u9519\u4E0D\u4F1A\u7ACB\u523B\u62A5\u9519\uFF0C\u4F46 ChatGPT \u4F1A\u8FDE\u4E0D\u4E0A\u3002",
  helpTunnelNameLabel: "Cloudflare \u96A7\u9053\u540D\u8BF4\u660E",
  helpTunnelNameContent: "\u4F60\u5728 Cloudflare \u5EFA\u597D\u7684\u90A3\u6761\u5177\u540D\u96A7\u9053\u7684\u540D\u5B57\uFF08cloudflared \u4FA7\u7684 tunnel name / UUID\uFF09\uFF0C\u4E0D\u662F\u57DF\u540D\u3002\u5728 Cloudflare Zero Trust \u540E\u53F0\u65B0\u5EFA\u4E00\u6761 Tunnel \u540E\u628A\u540D\u5B57\u586B\u5728\u8FD9\u91CC\u3002\u96A7\u9053\u540D\u662F Cloudflare \u4E0A\u7684\u6807\u8BC6\uFF0C\u516C\u7F51 hostname \u662F\u5916\u90E8\u8BBF\u95EE\u7528\u7684\u57DF\u540D\uFF0C\u4E24\u4E2A\u90FD\u8981\u586B\u3002\u4E0D\u586B\u65F6 codexpro \u4F1A\u76F4\u63A5\u62D2\u7EDD\u542F\u52A8\uFF1B\u4E0D\u7528\u5177\u540D\u96A7\u9053\u5C31\u628A Tunnel \u65B9\u5F0F\u6362\u6210 none \u6216 cloudflare\u3002",
  helpPortLabel: "\u672C\u5730\u7AEF\u53E3\u8BF4\u660E",
  helpPortContent: "codexpro \u5728\u672C\u673A\u76D1\u542C\u7684\u7AEF\u53E3\uFF0C\u9ED8\u8BA4 8787\u3002\u53EA\u6709\u672C\u673A\u7AEF\u53E3\u51B2\u7A81\u65F6\u624D\u9700\u8981\u6539\u3002\u53D6\u503C\u5FC5\u987B\u662F 1\u201365535 \u7684\u6574\u6570\uFF1B\u6539\u4E3A\u975E\u9ED8\u8BA4\u503C\u540E\uFF0C\u8BF7\u786E\u8BA4\u6CA1\u6709\u5176\u4ED6\u670D\u52A1\u5360\u7528\u8BE5\u7AEF\u53E3\u3002",
  helpBashModeLabel: "bash \u6A21\u5F0F\u8BF4\u660E",
  helpBashModeContent: "\u51B3\u5B9A ChatGPT \u80FD\u5728\u4F60\u7684\u9879\u76EE\u91CC\u6267\u884C\u4EC0\u4E48\u547D\u4EE4\u3002off\uFF1A\u5B8C\u5168\u7981\u6B62\u6267\u884C\u547D\u4EE4\uFF0C\u53EA\u505A\u6587\u4EF6\u8BFB\u5199\uFF1Bsafe\uFF1A\u5141\u8BB8\u5E38\u89C1\u7684\u68C0\u67E5\u4E0E\u6D4B\u8BD5\u7C7B\u547D\u4EE4\uFF0C\u8FD0\u884C\u65F6\u6309\u767D\u540D\u5355\u7B5B\u9009\uFF1Bfull\uFF1A\u5141\u8BB8\u4EFB\u610F shell \u547D\u4EE4\uFF0C\u6743\u9650\u7B49\u540C\u4E8E\u4F60\u81EA\u5DF1\u5728\u7EC8\u7AEF\u91CC\u64CD\u4F5C\u3002\u8FD9\u4E2A\u5F00\u5173\u76F4\u63A5\u51B3\u5B9A\u98CE\u9669\u5927\u5C0F\uFF0C\u4E0D\u786E\u5B9A\u65F6\u4FDD\u6301 safe\u3002",
  helpWriteModeLabel: "\u5199\u5165\u6A21\u5F0F\u8BF4\u660E",
  helpWriteModeContent: "\u51B3\u5B9A ChatGPT \u80FD\u5426\u6539\u52A8\u4F60\u7684\u6587\u4EF6\u3002off\uFF1A\u53EA\u8BFB\uFF0C\u7981\u6B62\u4EFB\u4F55\u5199\u5165\uFF1Bhandoff\uFF1A\u4E0D\u6539\u52A8\u6587\u4EF6\uFF0C\u800C\u662F\u628A\u5B9E\u73B0\u8BA1\u5212\u5199\u6210 .ai-bridge \u4EA4\u63A5\u6587\u4EF6\uFF1Bworkspace\uFF1A\u5141\u8BB8\u5728\u5DF2\u6388\u6743\u7684\u76EE\u5F55\u5185\u76F4\u63A5\u8BFB\u5199\u6587\u4EF6\uFF0C\u6700\u5E38\u89C1\u7684\u7528\u6CD5\u3002",
  helpWorkspacesLabel: "\u6388\u6743\u5DE5\u4F5C\u533A\u8BF4\u660E",
  helpWorkspacesContent: "\u52FE\u9009\u54EA\u4E9B\u5DE5\u4F5C\u533A\u5141\u8BB8 ChatGPT \u8BBF\u95EE\uFF0C\u672A\u52FE\u9009\u7684\u76EE\u5F55\u5B83\u770B\u4E0D\u5230\u3002\u53EA\u6709 DSH \u5F53\u524D\u5DF2\u6253\u5F00\u7684\u5DE5\u4F5C\u533A\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002\u6807\u8BB0\u300C\u76EE\u5F55\u4E0D\u5B58\u5728\u300D\u7684\u9879\u65E0\u6CD5\u52FE\u9009\uFF1Acodexpro \u5BF9\u4E0D\u5B58\u5728\u7684\u6388\u6743\u6839\u4F1A\u76F4\u63A5\u62D2\u7EDD\u542F\u52A8\uFF0C\u6545\u672C\u63D2\u4EF6\u4F1A\u8DF3\u8FC7\u5B83\u3002\u6388\u6743\u4E00\u4E2A\u76EE\u5F55\u5373\u5141\u8BB8 ChatGPT \u5728\u5176\u4E2D\u8BFB\u5199\u5E76\u6267\u884C\u53D7\u63A7\u547D\u4EE4\uFF0C\u8BF7\u6309\u6700\u5C0F\u5FC5\u8981\u8303\u56F4\u52FE\u9009\u3002\u6539\u52A8\u9700\u8981\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\u3002"
};
var en = {
  summary: "Manage codexpro: authorize workspaces, control the process, choose a tunnel.",
  processTitle: "Process",
  processMeta: "Port {port} \xB7 tunnel {tunnel}",
  start: "Start",
  stop: "Stop",
  refresh: "Refresh status",
  serverUrlLabel: "Server URL (paste into the ChatGPT connector\u2019s Server URL field)",
  serverUrlEmpty: "(not running, or no token yet)",
  statusIdle: "Not running",
  statusStarting: "Starting",
  statusRunning: "Running",
  statusStopping: "Stopping",
  statusFailed: "Start failed",
  statusUnknown: "Unknown",
  networkTitle: "Network access",
  networkNote: "Which address ChatGPT uses to reach this machine.",
  permissionTitle: "Permissions",
  permissionNote: "How much ChatGPT may do inside your projects; the main risk control.",
  workspacesTitle: "Authorized workspaces",
  workspacesNote: "ChatGPT cannot see directories you leave unchecked.",
  workspacesCount: "{selected} of {total} selected",
  workspacesEmpty: "This instance has no workspaces yet. Open a project in DSH and it will appear here.",
  missingDirectory: "Directory missing",
  tunnelMode: "Tunnel mode",
  tunnelModeHint: "Default none: local only, no public endpoint",
  tunnelNone: "none \u2014 local only, no public endpoint",
  tunnelNgrok: "ngrok \u2014 stable dev domain",
  tunnelCloudflare: "cloudflare \u2014 quick tunnel (URL changes on every restart)",
  tunnelCloudflareNamed: "cloudflare-named \u2014 named tunnel (stable URL)",
  tunnelTailscale: "tailscale \u2014 Funnel",
  tunnelHostname: "Public hostname",
  tunnelHostnameHint: "Required by this tunnel mode; codexpro enforces it too",
  tunnelName: "Cloudflare tunnel name",
  tunnelNameHint: "The named tunnel in your Cloudflare account; not the same value as the hostname above",
  port: "Local port",
  portHint: "Change only when the default port is already in use",
  bashMode: "Bash mode",
  bashModeHint: "safe covers most work; full equals your own terminal access",
  writeMode: "Write mode",
  writeModeHint: "workspace allows direct reads and writes inside authorized directories",
  tunnelNameInvalid: "Tunnel name must be at most 128 characters",
  tunnelHostnameRequired: "Required for this tunnel mode: the public hostname cannot be empty",
  tunnelNameRequired: "Required for this tunnel mode: the Cloudflare tunnel name cannot be empty",
  portInvalid: "Port must be an integer from 1 to 65535",
  overridden: "Overridden",
  reset: "Reset",
  save: "Save",
  saving: "Saving\u2026",
  unavailable: "This profile does not serve this configuration (the plugin row is inactive or settings are read-only); the row\u2019s own configuration applies.",
  readOnly: "This profile\u2019s settings are read-only; saving is unavailable.",
  saveFailed: "The save did not take effect: the Host rejected the write (validation failed or the revision changed). The current values were read back and your draft kept; check the fields marked invalid, and refresh before retrying if the configuration changed elsewhere.",
  restartNote: "Authorization and parameter changes take effect after restarting the process; \u201CSave\u201D writes this profile\u2019s row configuration.",
  helpTunnelModeLabel: "About the tunnel mode",
  helpTunnelModeContent: "Decides which address ChatGPT uses to reach the local codexpro. The default none keeps it on this machine. none: no public endpoint; cloudflare: quick tunnel that changes its URL on every restart; cloudflare-named: a named Cloudflare tunnel with a stable URL; ngrok: a stable dev domain that needs a local ngrok login; tailscale: Tailscale Funnel. Every mode except none exposes the service to the public internet, so set a trustworthy token first.",
  helpTunnelHostnameLabel: "About the public hostname",
  helpTunnelHostnameContent: "The public domain ChatGPT connects to, matching the selected tunnel. ngrok looks like your-domain.ngrok-free.dev; cloudflare-named uses the custom hostname bound to that tunnel; tailscale looks like your-device.your-tailnet.ts.net. A wrong value does not fail immediately, but ChatGPT cannot connect.",
  helpTunnelNameLabel: "About the Cloudflare tunnel name",
  helpTunnelNameContent: "The name (or UUID) of the named tunnel you created in Cloudflare, not a domain. Create a Tunnel in the Cloudflare Zero Trust dashboard and enter its name here. The tunnel name identifies it in Cloudflare; the public hostname is the external address, and both are required. codexpro refuses to start when the name is missing; switch to none or cloudflare when you do not use a named tunnel.",
  helpPortLabel: "About the local port",
  helpPortContent: "The port codexpro listens on locally; the default is 8787. Change it only when another program already uses the port. It must be an integer from 1 to 65535; after changing it, confirm that no other service occupies the new port.",
  helpBashModeLabel: "About bash mode",
  helpBashModeContent: "Decides which commands ChatGPT may run in your projects. off: no commands, file access only; safe: common inspection and test commands, filtered by an allowlist; full: arbitrary shell commands, equivalent to your own terminal access. This switch controls most of the risk; keep safe when unsure.",
  helpWriteModeLabel: "About write mode",
  helpWriteModeContent: "Decides whether ChatGPT may change your files. off: read-only; handoff: writes an implementation plan as an .ai-bridge handoff file instead of editing; workspace: direct reads and writes inside authorized directories, the common choice.",
  helpWorkspacesLabel: "About authorized workspaces",
  helpWorkspacesContent: "Check the workspaces ChatGPT may access; it cannot see unchecked directories. Only workspaces currently open in DSH appear here. Entries marked \u201CDirectory missing\u201D cannot be checked because codexpro refuses to start with a missing authorized root. Authorizing a directory lets ChatGPT read, write and run controlled commands inside it, so grant the minimum necessary scope. Changes take effect after restarting the process."
};

// src/client/index.jsx
var inject = ["slots", "locale", "configForms", "connection"];
function apply(ctx) {
  const call = createCall(ctx);
  const scope = ctx.configForms.get(CONFIG_NS);
  const controller = createController(scope);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-codexpro: settings dictionaries");
  ctx.effect(() => () => controller.form.dispose(), "dsh-codexpro: settings form model");
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => ctx.slots.inject(
    "plugins.row.config",
    () => ctx.slots.register(
      {
        name: "plugins.row.config",
        key: ROW_CONFIG_KEY,
        locale: NS,
        inject: () => ({ call, ...controller.inject() })
      },
      CodexProCard
    )
  )), "dsh-codexpro: row config slot");
}
return module.exports; } });
