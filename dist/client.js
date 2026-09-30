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
  "setAuthorization",
  "status",
  "start",
  "stop",
  "configure"
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
var import_react4 = require("react");

// src/client/theme.js
var T = {
  bgBase: "var(--dsw-alias-bg-base)",
  bgLayer2: "var(--dsw-alias-bg-layer-2)",
  bgLayer3: "var(--dsw-alias-bg-layer-3)",
  bgModulePlatform: "var(--dsw-alias-bg-module-platform)",
  borderL1: "var(--dsw-alias-border-l1)",
  borderL2: "var(--dsw-alias-border-l2)",
  brand: "var(--dsw-alias-brand-primary)",
  labelPrimary: "var(--dsw-alias-label-primary)",
  labelSecondary: "var(--dsw-alias-label-secondary)",
  labelTertiary: "var(--dsw-alias-label-tertiary)",
  success: "var(--dsw-alias-state-success-primary)",
  error: "var(--dsw-alias-state-error-primary)",
  warn: "var(--dsw-alias-state-warn-primary)"
};
var R = {
  xs: "var(--dsw-radius-xs)",
  sm: "var(--dsw-radius-sm)",
  md: "var(--dsw-radius-md)",
  lg: "var(--dsw-radius-lg)"
};
var badgeStyle = (color) => ({
  color,
  background: `color-mix(in srgb, ${color} 15%, transparent)`
});
var pillBase = {
  display: "inline-block",
  padding: "1px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  lineHeight: "17px",
  background: T.bgModulePlatform,
  color: T.labelSecondary,
  whiteSpace: "nowrap"
};
var statusPillStyle = (kind) => {
  if (kind === "warn") return { ...pillBase, ...badgeStyle(T.warn) };
  if (kind === "error") return { ...pillBase, ...badgeStyle(T.error) };
  if (kind === "ok") return { ...pillBase, ...badgeStyle(T.success) };
  return pillBase;
};
var S = {
  panel: { padding: "10px 0", display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", fontSize: "13px", flexWrap: "wrap" },
  toolbar: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  muted: { color: T.labelSecondary, fontSize: "12px" }
};
var cardStyle = {
  border: `1px solid ${T.borderL1}`,
  borderRadius: R.md,
  background: T.bgLayer3,
  overflow: "hidden"
};
var subCardStyle = { borderRadius: R.sm, background: T.bgModulePlatform };
var dividerStyle = { height: "1px", background: T.borderL1, flex: "none" };
var noteText = { fontSize: "11px", color: T.labelSecondary, lineHeight: 1.5 };
var sectionHead = { fontSize: "14px", fontWeight: 600, color: T.labelPrimary };
var linkBtn = {
  border: "none",
  background: "none",
  padding: 0,
  font: "inherit",
  fontSize: "11px",
  color: T.labelSecondary,
  cursor: "pointer"
};
var fieldStyle = {
  border: `1px solid ${T.borderL1}`,
  borderRadius: R.sm,
  background: T.bgLayer3,
  padding: "4px 8px",
  font: "inherit",
  fontSize: "12px",
  color: T.labelPrimary,
  minWidth: 0
};
var STATE_DISPLAY = Object.freeze({
  idle: { label: "\u672A\u8FD0\u884C", kind: "idle" },
  starting: { label: "\u542F\u52A8\u4E2D", kind: "warn" },
  running: { label: "\u8FD0\u884C\u4E2D", kind: "ok" },
  stopping: { label: "\u505C\u6B62\u4E2D", kind: "warn" },
  failed: { label: "\u542F\u52A8\u5931\u8D25", kind: "error" }
});
function displayState(state) {
  return STATE_DISPLAY[state] ?? { label: "\u672A\u77E5", kind: "warn" };
}

// src/client/parts.jsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var TABS = [
  { id: "process", label: "\u8FDB\u7A0B" },
  { id: "workspaces", label: "\u6388\u6743\u5DE5\u4F5C\u533A" },
  { id: "options", label: "\u53C2\u6570" }
];
function StatePill({ state }) {
  const info = displayState(state);
  const variant = info.kind === "ok" || info.kind === "error" ? info.kind : info.kind === "warn" ? "warn" : "idle";
  return (0, import_react.createElement)("span", { style: statusPillStyle(variant) }, info.label);
}
function TabBar({ active, onChange }) {
  return (0, import_react.createElement)("div", {
    style: { display: "flex", gap: "18px", borderBottom: `1px solid ${T.borderL1}`, paddingBottom: "6px" }
  }, TABS.map((tab) => (0, import_react.createElement)("button", {
    key: tab.id,
    type: "button",
    onClick: () => onChange(tab.id),
    style: {
      border: "none",
      background: "none",
      padding: "2px 0",
      font: "inherit",
      fontSize: "13px",
      cursor: "pointer",
      color: active === tab.id ? T.labelPrimary : T.labelSecondary,
      fontWeight: active === tab.id ? 600 : 400,
      borderBottom: active === tab.id ? `2px solid ${T.brand}` : "2px solid transparent",
      marginBottom: "-7px"
    }
  }, tab.label)));
}
function Field({ label, hint, children }) {
  return (0, import_react.createElement)("div", {
    style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 12px", flexWrap: "wrap" }
  }, [
    (0, import_react.createElement)("span", { key: "l", style: { fontSize: "13px", color: T.labelPrimary, minWidth: "104px" } }, label),
    (0, import_react.createElement)("span", { key: "c", style: { display: "flex", alignItems: "center", gap: "8px" } }, children),
    hint ? (0, import_react.createElement)("span", { key: "h", style: noteText }, hint) : null
  ]);
}
function Divider() {
  return (0, import_react.createElement)("div", { style: dividerStyle });
}
function ErrorBar({ message }) {
  if (!message) return null;
  return (0, import_react.createElement)("div", {
    style: { margin: "0 12px 10px", padding: "6px 10px", borderRadius: R.sm, background: T.bgModulePlatform }
  }, (0, import_react.createElement)("span", { style: { fontSize: "12px", color: T.error } }, message));
}
function SaveBar({ dirty, error, busy, onSave }) {
  if (!dirty && !error) return null;
  return (0, import_react.createElement)("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 12px",
      borderRadius: R.md,
      background: T.bgModulePlatform,
      flexWrap: "wrap"
    }
  }, [
    (0, import_react.createElement)(import_dsh_client_ui_primitives.Button, { key: "save", label: "\u4FDD\u5B58", variant: "primary", size: "sm", disabled: busy || !dirty, onClick: onSave }),
    error ? (0, import_react.createElement)("span", { key: "err", style: { fontSize: "12px", color: T.error } }, error) : (0, import_react.createElement)("span", { key: "hint", style: noteText }, "\u4EC5\u4FDD\u5B58\u5DF2\u6539\u52A8\u9879\uFF1B\u672A\u4FDD\u5B58\u7684\u6539\u52A8\u5728\u79BB\u5F00\u9875\u9762\u540E\u4E22\u5F03")
  ]);
}
var cardPanelStyle = { border: `1px solid ${T.borderL1}`, borderRadius: R.md, background: T.bgLayer3, overflow: "hidden" };

// src/client/panels.jsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/core/codexpro.js
var ARG = Object.freeze({
  root: "--root",
  port: "--port",
  tunnel: "--tunnel",
  hostname: "--hostname",
  mode: "--mode",
  bash: "--bash",
  write: "--write"
});
var VERSION_ARGS = Object.freeze(["--version"]);
var TUNNEL_MODES = Object.freeze(["none", "ngrok", "cloudflare", "cloudflare-named", "tailscale"]);
var HOSTNAME_REQUIRED_TUNNELS = Object.freeze(["ngrok", "cloudflare-named", "tailscale"]);
var BASH_MODES = Object.freeze(["off", "safe", "full"]);
var WRITE_MODES = Object.freeze(["off", "handoff", "workspace"]);
var DEFAULTS = Object.freeze({
  port: "8787",
  bash: "safe",
  write: "workspace",
  tunnel: "none"
});
var PORT_RANGE = Object.freeze({ min: 1, max: 65535 });

// src/client/panels.jsx
var TUNNEL_LABELS = {
  none: "none\uFF08\u4EC5\u672C\u5730\uFF0C\u4E0D\u4EA7\u751F\u516C\u7F51\u5165\u53E3\uFF09",
  ngrok: "ngrok\uFF08\u7A33\u5B9A dev domain\uFF09",
  cloudflare: "cloudflare\uFF08quick tunnel\uFF0CURL \u6BCF\u6B21\u91CD\u542F\u90FD\u53D8\uFF09",
  "cloudflare-named": "cloudflare-named\uFF08\u5177\u540D\u96A7\u9053\uFF0CURL \u7A33\u5B9A\uFF09",
  tailscale: "tailscale\uFF08Funnel\uFF09"
};
var NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS);
function ProcessPanel({ status, busy, onAction, onRefresh }) {
  const state = status?.state ?? "idle";
  const canStart = state === "idle" || state === "failed";
  const canStop = state === "running" || state === "starting";
  return (0, import_react2.createElement)("div", { style: cardStyle }, [
    (0, import_react2.createElement)("div", { key: "head", style: { ...S.listRow, justifyContent: "space-between" } }, [
      (0, import_react2.createElement)("div", { key: "left", style: { display: "flex", alignItems: "center", gap: "10px" } }, [
        (0, import_react2.createElement)(StatePill, { key: "pill", state }),
        (0, import_react2.createElement)("span", { key: "meta", style: noteText }, status ? `\u7AEF\u53E3 ${status.port} \xB7 tunnel ${status.tunnel}` : "")
      ]),
      (0, import_react2.createElement)("div", { key: "actions", style: S.toolbar }, [
        (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Button, { key: "start", label: "\u542F\u52A8", variant: "primary", size: "sm", disabled: busy || !canStart, onClick: () => onAction("start") }),
        (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Button, { key: "stop", label: "\u505C\u6B62", size: "sm", disabled: busy || !canStop, onClick: () => onAction("stop") }),
        (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Button, { key: "refresh", label: "\u5237\u65B0\u72B6\u6001", size: "sm", disabled: busy, onClick: onRefresh })
      ])
    ]),
    (0, import_react2.createElement)(Divider, { key: "div" }),
    (0, import_react2.createElement)("div", { key: "url", style: { padding: "8px 12px" } }, [
      (0, import_react2.createElement)("div", { key: "l", style: { ...noteText, marginBottom: "4px" } }, "Server URL\uFF08\u7C98\u8D34\u5230 ChatGPT \u8FDE\u63A5\u5668\u7684 Server URL \u5B57\u6BB5\uFF09"),
      (0, import_react2.createElement)("code", {
        key: "v",
        style: {
          display: "block",
          padding: "6px 8px",
          fontSize: "11px",
          borderRadius: R.sm,
          background: T.bgModulePlatform,
          color: T.labelSecondary,
          wordBreak: "break-all"
        }
      }, status?.url || "\uFF08\u672A\u8FD0\u884C\u6216\u5C1A\u672A\u751F\u6210 token\uFF09")
    ]),
    status?.lastError ? (0, import_react2.createElement)(ErrorBar, { key: "last", message: status.lastError }) : null
  ]);
}
function WorkspacesPanel({ workspaces, draft, onToggle, anchorDir }) {
  if (workspaces.length === 0) {
    return (0, import_react2.createElement)("div", { style: { ...cardStyle, ...S.listRow } }, [
      (0, import_react2.createElement)("span", { key: "t", style: noteText }, "\u5F53\u524D\u5B9E\u4F8B\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u533A\u3002\u5728 DSH \u91CC\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u540E\u5B83\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002")
    ]);
  }
  return (0, import_react2.createElement)("div", null, [
    (0, import_react2.createElement)("div", { key: "list", style: cardStyle }, workspaces.map((item, index) => (0, import_react2.createElement)("div", {
      key: item.path,
      style: {
        ...S.listRow,
        borderTop: index === 0 ? "none" : `1px solid ${T.borderL1}`,
        opacity: item.exists ? 1 : 0.55
      }
    }, [
      (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Checkbox, {
        key: "box",
        checked: draft[item.path] === true,
        disabled: !item.exists,
        onChange: (next) => onToggle(item.path, next)
      }),
      (0, import_react2.createElement)("span", { key: "title", style: { fontSize: "13px", color: T.labelPrimary } }, item.title),
      (0, import_react2.createElement)("span", { key: "path", style: { ...noteText, flex: "1 1 auto" } }, item.path),
      item.exists ? null : (0, import_react2.createElement)("span", { key: "miss", style: statusPillStyle("warn") }, "\u76EE\u5F55\u4E0D\u5B58\u5728")
    ]))),
    (0, import_react2.createElement)(
      "div",
      { key: "anchor", style: { ...noteText, marginTop: "6px" } },
      `\u951A\u70B9\u76EE\u5F55\uFF08codexpro \u7684 --root\uFF0C\u51B3\u5B9A profile \u6587\u4EF6\u540D\uFF09\uFF1A${anchorDir}`
    )
  ]);
}
function OptionsPanel({ draft, onChange }) {
  return (0, import_react2.createElement)("div", { style: cardStyle }, [
    (0, import_react2.createElement)(Field, {
      key: "tunnel",
      label: "Tunnel \u65B9\u5F0F",
      children: (0, import_react2.createElement)("select", {
        value: draft.tunnelMode,
        onChange: (event) => onChange("tunnelMode", event.target.value),
        style: { ...fieldStyle, minWidth: "260px" }
      }, TUNNEL_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, TUNNEL_LABELS[mode] ?? mode)))
    }),
    NEEDS_HOSTNAME.has(draft.tunnelMode) ? (0, import_react2.createElement)(Field, {
      key: "hostname",
      label: "\u516C\u7F51 hostname",
      hint: "\u8BE5 tunnel \u65B9\u5F0F\u5FC5\u9700\uFF0Ccodexpro \u4EA6\u5F3A\u5236\u8981\u6C42",
      children: (0, import_react2.createElement)("input", {
        type: "text",
        value: draft.tunnelHostname,
        onChange: (event) => onChange("tunnelHostname", event.target.value),
        style: { ...fieldStyle, minWidth: "260px" }
      })
    }) : null,
    (0, import_react2.createElement)("div", { key: "d1", style: dividerStyle }),
    (0, import_react2.createElement)(Field, {
      key: "port",
      label: "\u672C\u5730\u7AEF\u53E3",
      children: (0, import_react2.createElement)("input", {
        type: "text",
        value: draft.port,
        onChange: (event) => onChange("port", event.target.value),
        style: { ...fieldStyle, minWidth: "90px" }
      })
    }),
    (0, import_react2.createElement)("div", { key: "d2", style: dividerStyle }),
    (0, import_react2.createElement)(Field, {
      key: "bash",
      label: "bash \u6A21\u5F0F",
      hint: "safe \u5141\u8BB8\u5E38\u89C1\u68C0\u67E5\u4E0E\u6D4B\u8BD5\u547D\u4EE4\uFF1Bfull \u4E3A\u4EFB\u610F shell\uFF0C\u4EC5\u5728\u4FE1\u4EFB\u7684\u4ED3\u5E93\u4F7F\u7528",
      children: (0, import_react2.createElement)("select", {
        value: draft.bashMode,
        onChange: (event) => onChange("bashMode", event.target.value),
        style: { ...fieldStyle, minWidth: "120px" }
      }, BASH_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, mode)))
    }),
    (0, import_react2.createElement)(Field, {
      key: "write",
      label: "\u5199\u5165\u6A21\u5F0F",
      children: (0, import_react2.createElement)("select", {
        value: draft.writeMode,
        onChange: (event) => onChange("writeMode", event.target.value),
        style: { ...fieldStyle, minWidth: "120px" }
      }, WRITE_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, mode)))
    })
  ]);
}

// src/client/use-config.js
var import_react3 = require("react");
function authorizationOf(catalog) {
  const list = catalog?.workspaces;
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.map((item) => [item.path, item.authorized === true]));
}
function optionsOf(catalog) {
  if (!catalog) return null;
  return {
    tunnelMode: catalog.tunnelMode,
    tunnelHostname: catalog.tunnelHostname,
    port: catalog.port,
    bashMode: catalog.bashMode,
    writeMode: catalog.writeMode
  };
}
function describeError(failure) {
  return failure instanceof Error ? failure.message : String(failure);
}
function applySnapshot(setters, statusData, catalogData) {
  setters.setStatus(statusData);
  setters.setCatalog(catalogData);
  setters.setAuthDraft(authorizationOf(catalogData));
  const options = optionsOf(catalogData);
  setters.setOptionDraft(options);
  setters.setOptionBaseline(options);
}
function useConfig(call) {
  const [status, setStatus] = (0, import_react3.useState)(null);
  const [catalog, setCatalog] = (0, import_react3.useState)(null);
  const [authDraft, setAuthDraft] = (0, import_react3.useState)(null);
  const [optionDraft, setOptionDraft] = (0, import_react3.useState)(null);
  const [optionBaseline, setOptionBaseline] = (0, import_react3.useState)(null);
  const [error, setError] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const refresh = (0, import_react3.useCallback)(async () => {
    const setters = { setStatus, setCatalog, setAuthDraft, setOptionDraft, setOptionBaseline };
    try {
      const [statusData, catalogData] = await Promise.all([call("status"), call("catalog")]);
      applySnapshot(setters, statusData, catalogData);
    } catch (failure) {
      setError(describeError(failure));
    }
  }, [call]);
  (0, import_react3.useEffect)(() => {
    refresh();
  }, [refresh]);
  const optionDirty = (0, import_react3.useMemo)(() => {
    if (!optionDraft || !optionBaseline) return false;
    return Object.keys(optionDraft).some((key) => optionDraft[key] !== optionBaseline[key]);
  }, [optionDraft, optionBaseline]);
  const workspaces = catalog?.workspaces ?? [];
  const authDirty = workspaces.some((item) => authDraft?.[item.path] === true !== (item.authorized === true));
  const actions = buildActions({
    call,
    refresh,
    setters: { setBusy, setError, setAuthDraft, setOptionDraft },
    state: { authDraft, optionDraft }
  });
  return {
    status,
    catalog,
    workspaces,
    authDraft,
    optionDraft,
    optionDirty,
    authDirty,
    error,
    busy,
    refresh,
    ...actions
  };
}
function buildActions({ call, refresh, setters, state }) {
  const run = async (action) => {
    setters.setBusy(true);
    setters.setError("");
    let failed = false;
    try {
      await action();
    } catch (failure) {
      failed = true;
      setters.setError(describeError(failure));
    } finally {
      setters.setBusy(false);
    }
    if (!failed) await refresh();
  };
  return {
    /** 启停进程。 @param {'start'|'stop'} action 动作 @returns {Promise<void>} 完成后结算 */
    act: (action) => run(() => call(action)),
    /** 保存授权集。 @returns {Promise<void>} 完成后结算 */
    saveAuthorization: () => run(() => call("setAuthorization", { authorized: state.authDraft ?? {} })),
    /** 保存参数。 @returns {Promise<void>} 完成后结算 */
    saveOptions: () => run(() => call("configure", state.optionDraft)),
    /** 切换某工作区授权草稿。 @param {string} path 路径 @param {boolean} next 新值 @returns {void} */
    toggleWorkspace: (path, next) => setters.setAuthDraft((prev) => ({ ...prev ?? {}, [path]: next })),
    /** 变更参数字段草稿。 @param {string} field 字段 @param {string} value 新值 @returns {void} */
    changeOption: (field, value) => setters.setOptionDraft((prev) => prev === null ? prev : { ...prev, [field]: value })
  };
}

// src/client/card.jsx
function CodexProCard({ call, view }) {
  const [tab, setTab] = (0, import_react4.useState)("process");
  const state = useConfig(call);
  if (view === "summary") {
    return (0, import_react4.createElement)(
      "div",
      { style: { fontSize: "12px", color: S.muted.color } },
      "\u7BA1\u7406 codexpro\uFF1A\u6388\u6743\u5DE5\u4F5C\u533A\u3001\u63A7\u5236\u8FDB\u7A0B\u3001\u9009\u62E9 tunnel \u65B9\u5F0F"
    );
  }
  return (0, import_react4.createElement)("div", { style: S.panel }, [
    (0, import_react4.createElement)("header", { key: "head" }, [
      (0, import_react4.createElement)("div", { key: "t", style: { ...sectionHead, fontSize: "15px" } }, "CodexPro"),
      (0, import_react4.createElement)(
        "div",
        { key: "d", style: { ...noteText, marginTop: "2px" } },
        "\u628A DSH \u5DE5\u4F5C\u533A\u6388\u6743\u7ED9 ChatGPT\uFF0C\u5E76\u6258\u7BA1\u672C\u5730 codexpro \u8FDB\u7A0B\u3002"
      )
    ]),
    (0, import_react4.createElement)(TabBar, { key: "tabs", active: tab, onChange: setTab }),
    renderTab(tab, state),
    renderSaveBar(tab, state),
    (0, import_react4.createElement)("div", { key: "note", style: noteText }, [
      (0, import_react4.createElement)("div", { key: "a" }, "codexpro \u662F\u672C\u5730\u5F00\u53D1\u6865\uFF0C\u4E0D\u662F\u64CD\u4F5C\u7CFB\u7EDF\u7EA7\u6C99\u7BB1\uFF1A\u6388\u6743\u4E00\u4E2A\u76EE\u5F55\u5373\u5141\u8BB8 ChatGPT \u5728\u5176\u4E2D\u8BFB\u5199\u5E76\u6267\u884C\u53D7\u63A7\u547D\u4EE4\u3002"),
      (0, import_react4.createElement)("div", { key: "b" }, "\u672C\u63D2\u4EF6\u7684\u6570\u636E\u76EE\u5F55\u4E0E\u7EC8\u7AEF\u624B\u5DE5\u4F7F\u7528\u7684 ~/.codexpro \u76F8\u4E92\u72EC\u7ACB\u3002\u53C2\u6570\u6539\u52A8\u9700\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\u3002")
    ])
  ]);
}
function renderTab(tab, state) {
  if (tab === "process") {
    return (0, import_react4.createElement)(ProcessPanel, {
      key: "process",
      status: state.status,
      busy: state.busy,
      onAction: state.act,
      onRefresh: state.refresh
    });
  }
  if (tab === "workspaces") {
    return (0, import_react4.createElement)(WorkspacesPanel, {
      key: "workspaces",
      workspaces: state.workspaces,
      draft: state.authDraft ?? {},
      onToggle: state.toggleWorkspace,
      anchorDir: state.catalog?.anchorDir ?? ""
    });
  }
  if (tab === "options" && state.optionDraft) {
    return (0, import_react4.createElement)(OptionsPanel, { key: "options", draft: state.optionDraft, onChange: state.changeOption });
  }
  return null;
}
function renderSaveBar(tab, state) {
  if (tab === "workspaces") {
    return (0, import_react4.createElement)(SaveBar, {
      key: "bar",
      dirty: state.authDirty,
      error: state.error,
      busy: state.busy,
      onSave: state.saveAuthorization
    });
  }
  if (tab === "options") {
    return (0, import_react4.createElement)(SaveBar, {
      key: "bar",
      dirty: state.optionDirty,
      error: state.error,
      busy: state.busy,
      onSave: state.saveOptions
    });
  }
  return (0, import_react4.createElement)(SaveBar, { key: "bar", dirty: false, error: state.error, busy: state.busy, onSave: () => {
  } });
}

// src/client/index.jsx
var inject = ["slots", "configForms", "connection"];
function apply(ctx) {
  const call = createCall(ctx);
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => ctx.slots.inject(
    "plugins.row.config",
    () => ctx.slots.register(
      { name: "plugins.row.config", key: ROW_CONFIG_KEY, inject: () => ({ call }) },
      CodexProCard
    )
  )), "dsh-codexpro: row config slot");
}
return module.exports; } });
