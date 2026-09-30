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
var import_react5 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/theme.js
var T = {
  bgBase: "var(--dsw-alias-bg-base)",
  bgLayer2: "var(--dsw-alias-bg-layer-2)",
  bgLayer3: "var(--dsw-alias-bg-layer-3)",
  /** 官方面层：hover 与展开态用（fields.module.css 的 helpButton:hover）。 */
  bgLayer4: "var(--dsw-alias-bg-layer-4)",
  bgModulePlatform: "var(--dsw-alias-bg-module-platform)",
  borderL1: "var(--dsw-alias-border-l1)",
  borderL2: "var(--dsw-alias-border-l2)",
  /** 官方设置卡描边用的层级（比 l1/l2 更浅，用于卡面轮廓）。 */
  borderL4: "var(--dsw-alias-border-l4)",
  brand: "var(--dsw-alias-brand-primary)",
  labelPrimary: "var(--dsw-alias-label-primary)",
  labelSecondary: "var(--dsw-alias-label-secondary)",
  labelTertiary: "var(--dsw-alias-label-tertiary)",
  /** 官方用于计数、分组说明等最弱一级文本。 */
  labelCaption: "var(--dsw-alias-label-caption)",
  success: "var(--dsw-alias-state-success-primary)",
  error: "var(--dsw-alias-state-error-primary)",
  warn: "var(--dsw-alias-state-warn-primary)",
  /** 官方焦点环两件套（focus.css 定义，宿主统一）。 */
  focusRingWidth: "var(--dsw-focus-ring-width)",
  focusRingColor: "var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))",
  /** 官方设置卡材料（v0.1.7 新增两兄弟）。 */
  settingsCardFill: "var(--dsw-alias-settings-card-fill)",
  settingsCardStroke: "var(--dsw-alias-settings-card-stroke)"
};
var R = {
  xs: "var(--dsw-radius-xs)",
  sm: "var(--dsw-radius-sm)",
  md: "var(--dsw-radius-md)",
  lg: "var(--dsw-radius-lg)",
  xl: "var(--dsw-radius-xl)"
};
var HAIRLINE = "0.5px";
var badgeStyle = (color) => ({
  color,
  background: `color-mix(in srgb, ${color} 15%, transparent)`
});
var pillBase = {
  display: "inline-block",
  padding: "0 7px",
  height: "18px",
  borderRadius: "999px",
  // 全圆形状必须显式配 corner-shape: round：宿主 corner-shape.css 用通配选择器把
  // 所有圆角统一成 superellipse(1.5)，会把胶囊两端压成方角。官方 Pill/Tag 同样成对声明。
  // 不支持该属性的引擎忽略此声明，圆角回退为圆弧。
  cornerShape: "round",
  fontSize: "11px",
  lineHeight: "18px",
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
  panel: { display: "flex", flexDirection: "column", gap: "12px" },
  listRow: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", fontSize: "13px", flexWrap: "wrap" },
  toolbar: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  muted: { color: T.labelSecondary, fontSize: "13px" }
};
var cardStyle = {
  border: `${HAIRLINE} solid ${T.settingsCardStroke}`,
  borderRadius: R.xl,
  background: T.settingsCardFill,
  overflow: "hidden"
};
var dividerStyle = { height: HAIRLINE, background: T.borderL2, flex: "none" };
var noteText = { fontSize: "13px", color: T.labelTertiary, lineHeight: "20px" };
var captionText = { fontSize: "12px", color: T.labelCaption, lineHeight: "18px" };
var hintText = { margin: 0, fontSize: "12px", color: T.labelTertiary, lineHeight: "1.5" };
var fieldBox = (first = false) => ({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "12px 0",
  borderTop: first ? "none" : `${HAIRLINE} solid ${T.borderL2}`
});
var fieldLabel = { fontSize: "13px", fontWeight: 500, color: T.labelPrimary, lineHeight: "1.5" };
var groupTitle = { margin: 0, fontSize: "13px", fontWeight: 600, color: T.labelPrimary, lineHeight: "1.5" };
var groupBox = (first = false) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "16px 0",
  borderTop: first ? "none" : `${HAIRLINE} solid ${T.borderL4}`
});
var fieldStyle = {
  border: `${HAIRLINE} solid ${T.borderL4}`,
  borderRadius: R.md,
  backgroundColor: T.bgLayer3,
  padding: "0 12px",
  height: "34px",
  font: "inherit",
  fontSize: "13px",
  lineHeight: "1.5",
  color: T.labelPrimary,
  minWidth: 0
};
var SELECT_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
var selectStyle = {
  ...fieldStyle,
  appearance: "none",
  paddingRight: "32px",
  backgroundImage: SELECT_CHEVRON,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "12px 12px",
  cursor: "pointer"
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
function StatePill({ state }) {
  const info = displayState(state);
  const variant = info.kind === "ok" || info.kind === "error" ? info.kind : info.kind === "warn" ? "warn" : "idle";
  return (0, import_react.createElement)("span", { style: statusPillStyle(variant) }, info.label);
}
function Divider() {
  return (0, import_react.createElement)("div", { style: dividerStyle });
}
function ErrorBar({ message }) {
  if (!message) return null;
  return (0, import_react.createElement)("div", {
    style: {
      margin: "0 12px 10px",
      padding: "6px 10px",
      border: `${HAIRLINE} solid ${T.error}`,
      borderRadius: "var(--dsw-radius-md)",
      background: T.bgModulePlatform
    }
  }, (0, import_react.createElement)("span", { style: { ...captionText, color: T.error } }, message));
}

// src/client/form.js
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

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
  (0, import_dsh_client_ui_primitives.settingsTextField)(TUNNEL_HOSTNAME),
  tunnelNameSpec,
  portSpec,
  optionSpec(BASH_MODE, BASH_MODES),
  optionSpec(WRITE_MODE, WRITE_MODES),
  authorizedSpec
];
function needsTunnelName(tunnelMode) {
  return TUNNEL_NAME_REQUIRED_TUNNELS.includes(String(tunnelMode));
}
function projection(form) {
  const state = { ...form.shell() };
  for (const spec of SPECS) state[spec.field] = form.field(spec.field);
  return state;
}
function createController(scope) {
  const form = new import_dsh_client_ui_primitives.SettingsFormModel(scope, SPECS);
  const store = form.bind(() => projection(form));
  return {
    form,
    // `hooks` 是保留键：renderer 把每个成员消费成 `use<Name>` 选择器 hook，
    // 且不会把 `hooks` 本身传进 props。其余成员平铺进 props（官方各卡片同形）。
    inject: () => ({ hooks: { codexProForm: store }, ...form.actions() })
  };
}

// src/client/panels.jsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var TUNNEL_LABELS = {
  none: "none \u2014 \u4EC5\u672C\u5730\uFF0C\u65E0\u516C\u7F51\u5165\u53E3",
  ngrok: "ngrok \u2014 \u7A33\u5B9A dev domain",
  cloudflare: "cloudflare \u2014 \u5FEB\u901F\u96A7\u9053\uFF08URL \u6BCF\u6B21\u91CD\u542F\u90FD\u53D8\uFF09",
  "cloudflare-named": "cloudflare-named \u2014 \u5177\u540D\u96A7\u9053\uFF08URL \u7A33\u5B9A\uFF09",
  tailscale: "tailscale \u2014 Funnel"
};
var NEEDS_HOSTNAME = new Set(HOSTNAME_REQUIRED_TUNNELS);
var HELP = {
  tunnelMode: [
    "\u51B3\u5B9A ChatGPT \u7528\u4EC0\u4E48\u5730\u5740\u8FDE\u5230\u672C\u673A codexpro\u3002\u9ED8\u8BA4 none\uFF0C\u53EA\u5728\u4F60\u8FD9\u53F0\u673A\u5668\u4E0A\u53EF\u7528\u3002",
    "none\uFF1A\u4E0D\u4EA7\u751F\u516C\u7F51\u5165\u53E3\uFF0C\u53EA\u5728\u672C\u673A\u6D4F\u89C8\u5668/\u5BA2\u6237\u7AEF\u53EF\u7528\u3002\u6700\u5B89\u5168\u7684\u9ED8\u8BA4\u503C\u3002",
    "cloudflare\uFF1A\u514D\u914D\u7F6E\u5FEB\u901F\u96A7\u9053\uFF0C\u4F46\u6BCF\u6B21\u91CD\u542F\u8FDB\u7A0B\u90FD\u4F1A\u6362\u4E00\u4E2A\u65B0 URL\uFF0C\u9700\u8981\u91CD\u65B0\u8D34\u7ED9 ChatGPT\u3002\u9002\u5408\u4E34\u65F6\u8BD5\u7528\u3002",
    "cloudflare-named\uFF1A\u9700\u5148\u5728 Cloudflare \u5EFA\u597D\u5177\u540D\u96A7\u9053\uFF0CURL \u56FA\u5B9A\u4E0D\u53D8\u3002\u9002\u5408\u957F\u671F\u4F7F\u7528\u3002",
    "ngrok\uFF1A\u7528 ngrok \u7684\u56FA\u5B9A dev domain\uFF0CURL \u7A33\u5B9A\uFF1B\u9700\u672C\u673A\u5DF2\u5B89\u88C5\u5E76\u767B\u5F55 ngrok\u3002",
    "tailscale\uFF1A\u8D70 Tailscale Funnel\uFF0C\u9002\u5408\u5DF2\u6709 Tailscale \u7F51\u7EDC\u7684\u573A\u666F\u3002",
    "\u6CE8\u610F\uFF1A\u9664 none \u5916\u90FD\u4F1A\u628A\u8FD9\u4E2A\u672C\u5730\u670D\u52A1\u66B4\u9732\u5230\u516C\u7F51\uFF0C\u8BF7\u786E\u4FDD\u5DF2\u8BBE\u7F6E\u53EF\u4FE1\u7684\u8BBF\u95EE token\u3002"
  ],
  tunnelHostname: [
    "\u516C\u7F51\u4E0A\u9762\u5411 ChatGPT \u7684\u90A3\u4E2A\u57DF\u540D\uFF0C\u5FC5\u987B\u4E0E\u6240\u9009 tunnel \u65B9\u5F0F\u5BF9\u5E94\uFF1A",
    "ngrok\uFF1A\u5F62\u5982 your-domain.ngrok-free.dev\uFF08ngrok \u540E\u53F0\u91CC\u7684 dev domain\uFF09\u3002",
    "cloudflare-named\uFF1A\u4F60\u5728 Cloudflare \u4E3A\u8BE5\u96A7\u9053\u7ED1\u5B9A\u7684\u81EA\u5B9A\u4E49\u57DF\u540D\u3002",
    "tailscale\uFF1A\u5F62\u5982 your-device.your-tailnet.ts.net\uFF08Tailscale \u5206\u914D\u7684\u8282\u70B9\u540D\uFF09\u3002",
    "\u586B\u9519\u4E0D\u4F1A\u7ACB\u523B\u62A5\u9519\uFF0C\u4F46 ChatGPT \u4F1A\u8FDE\u4E0D\u4E0A\u2014\u2014\u5B83\u89E3\u6790\u7684\u5C31\u662F\u8FD9\u4E2A\u57DF\u540D\u3002"
  ],
  tunnelName: [
    "\u4F60\u5728 Cloudflare \u5EFA\u597D\u7684\u90A3\u6761\u5177\u540D\u96A7\u9053\u7684\u540D\u5B57\uFF08cloudflared \u4FA7\u7684 tunnel name / UUID\uFF09\uFF0C\u4E0D\u662F\u57DF\u540D\u3002",
    "\u521B\u5EFA\u65B9\u5F0F\uFF1A\u5728 Cloudflare Zero Trust \u540E\u53F0\u65B0\u5EFA\u4E00\u6761 Tunnel\uFF0C\u540D\u5B57\u968F\u4F60\u53D6\uFF08\u5982 codexpro\uFF09\uFF0C\u5EFA\u597D\u540E\u628A\u5B83\u586B\u5728\u8FD9\u91CC\u3002",
    "\u6CE8\u610F\u533A\u5206\u4E24\u4E2A\u503C\uFF1A\u96A7\u9053\u540D\u662F Cloudflare \u4E0A\u7684\u6807\u8BC6\uFF0C\u516C\u7F51 hostname \u662F\u5916\u90E8\u8BBF\u95EE\u7528\u7684\u57DF\u540D\u2014\u2014\u4E24\u4E2A\u90FD\u8981\u586B\u3002",
    "\u4E0D\u586B\u7684\u8BDD codexpro \u4F1A\u76F4\u63A5\u62D2\u7EDD\u542F\u52A8\u5E76\u62A5\u300C--tunnel-name ... is required\u300D\u3002",
    "\u5982\u679C\u4E0D\u7528\u5177\u540D\u96A7\u9053\uFF0C\u628A Tunnel \u65B9\u5F0F\u6362\u6210 none \u6216 cloudflare \u5373\u53EF\uFF08\u90A3\u6837\u8FD9\u4E2A\u5B57\u6BB5\u4F1A\u6D88\u5931\uFF09\u3002"
  ],
  port: [
    "codexpro \u5728\u672C\u673A\u76D1\u542C\u7684\u7AEF\u53E3\uFF0C\u9ED8\u8BA4 8787\u3002",
    "\u53EA\u6709\u672C\u673A\u7AEF\u53E3\u51B2\u7A81\uFF08\u4F8B\u5982\u522B\u7684\u7A0B\u5E8F\u5DF2\u5360\u7528 8787\uFF09\u65F6\u624D\u9700\u8981\u6539\u3002",
    "\u53D6\u503C\u5FC5\u987B\u662F 1\u201365535 \u7684\u6574\u6570\u3002\u6539\u4E3A\u975E\u9ED8\u8BA4\u503C\u540E\uFF0C\u8BF7\u786E\u8BA4\u6CA1\u6709\u5176\u4ED6\u670D\u52A1\u5360\u7528\u8BE5\u7AEF\u53E3\u3002"
  ],
  bashMode: [
    "\u51B3\u5B9A ChatGPT \u80FD\u5728\u4F60\u7684\u9879\u76EE\u91CC\u6267\u884C\u4EC0\u4E48\u547D\u4EE4\u3002",
    "off\uFF1A\u5B8C\u5168\u7981\u6B62\u6267\u884C\u547D\u4EE4\uFF0C\u53EA\u505A\u6587\u4EF6\u8BFB\u5199\u3002\u6700\u4FDD\u5B88\u3002",
    "safe\uFF1A\u5141\u8BB8\u5E38\u89C1\u7684\u68C0\u67E5\u4E0E\u6D4B\u8BD5\u7C7B\u547D\u4EE4\uFF08\u5982\u67E5\u770B\u6587\u4EF6\u3001\u8DD1\u6D4B\u8BD5\uFF09\uFF0C\u8FD0\u884C\u65F6\u6309\u767D\u540D\u5355\u7B5B\u9009\u3002",
    "full\uFF1A\u5141\u8BB8\u4EFB\u610F shell \u547D\u4EE4\uFF0C\u6743\u9650\u7B49\u540C\u4E8E\u4F60\u81EA\u5DF1\u5728\u7EC8\u7AEF\u91CC\u64CD\u4F5C\u3002\u4EC5\u5728\u5B8C\u5168\u4FE1\u4EFB\u7684\u4ED3\u5E93\u91CC\u4F7F\u7528\u3002",
    "\u8FD9\u4E2A\u5F00\u5173\u76F4\u63A5\u51B3\u5B9A\u98CE\u9669\u5927\u5C0F\uFF1A\u4E0D\u786E\u5B9A\u65F6\u4FDD\u6301 safe\u3002"
  ],
  writeMode: [
    "\u51B3\u5B9A ChatGPT \u80FD\u5426\u6539\u52A8\u4F60\u7684\u6587\u4EF6\u3002",
    "off\uFF1A\u53EA\u8BFB\uFF0C\u7981\u6B62\u4EFB\u4F55\u5199\u5165\u3002",
    "handoff\uFF1A\u4E0D\u6539\u52A8\u6587\u4EF6\uFF0C\u800C\u662F\u628A\u5B9E\u73B0\u8BA1\u5212\u5199\u6210 .ai-bridge \u4EA4\u63A5\u6587\u4EF6\uFF0C\u4EA4\u7ED9\u672C\u5730\u7684\u5B9E\u73B0 agent \u53BB\u505A\u3002",
    "workspace\uFF1A\u5141\u8BB8\u5728\u5DF2\u6388\u6743\u7684\u76EE\u5F55\u5185\u76F4\u63A5\u8BFB\u5199\u6587\u4EF6\u3002\u6700\u5E38\u89C1\u7684\u7528\u6CD5\u3002"
  ],
  authorized: [
    "\u52FE\u9009\u54EA\u4E9B\u5DE5\u4F5C\u533A\u5141\u8BB8 ChatGPT \u8BBF\u95EE\u3002\u672A\u52FE\u9009\u7684\u76EE\u5F55\u5B83\u770B\u4E0D\u5230\u3002",
    "\u53EA\u6709 DSH \u5F53\u524D\u5DF2\u6253\u5F00\u7684\u5DE5\u4F5C\u533A\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u2014\u2014\u5148\u5728 DSH \u91CC\u6253\u5F00\u9879\u76EE\uFF0C\u518D\u56DE\u6765\u52FE\u9009\u3002",
    "\u6807\u8BB0\u300C\u76EE\u5F55\u4E0D\u5B58\u5728\u300D\u7684\u9879\u65E0\u6CD5\u52FE\u9009\uFF1Acodexpro \u5BF9\u4E0D\u5B58\u5728\u7684\u6388\u6743\u6839\u4F1A\u76F4\u63A5\u62D2\u7EDD\u542F\u52A8\uFF0C\u6545\u672C\u63D2\u4EF6\u4F1A\u8DF3\u8FC7\u5B83\u3002",
    "\u6388\u6743\u4E00\u4E2A\u76EE\u5F55\u5373\u5141\u8BB8 ChatGPT \u5728\u5176\u4E2D\u8BFB\u5199\u5E76\u6267\u884C\u53D7\u63A7\u547D\u4EE4\uFF08\u53D7\u4E0A\u9762\u4E24\u4E2A\u5F00\u5173\u7EA6\u675F\uFF09\uFF0C\u8BF7\u6309\u6700\u5C0F\u5FC5\u8981\u8303\u56F4\u52FE\u9009\u3002",
    "\u6539\u52A8\u9700\u8981\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\u3002"
  ]
};
function Help({ id, lines }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  return (0, import_react2.createElement)("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px" } }, [
    (0, import_react2.createElement)("button", {
      key: "btn",
      type: "button",
      "aria-label": "\u5B57\u6BB5\u8BF4\u660E",
      "aria-expanded": open,
      "aria-controls": id,
      onClick: () => setOpen(!open),
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        width: "24px",
        height: "24px",
        padding: 0,
        border: 0,
        borderRadius: R.sm,
        background: open ? T.bgLayer4 : "none",
        color: open ? T.labelSecondary : T.labelTertiary,
        cursor: "pointer"
      }
    }, (0, import_react2.createElement)(import_dsh_client_ui_primitives2.IconInfoOutlineRegular, { size: 12 })),
    open ? (0, import_react2.createElement)("div", {
      key: "body",
      id,
      role: "region",
      "aria-label": "\u5B57\u6BB5\u8BF4\u660E",
      style: { flex: "1 1 100%", paddingTop: "4px" }
    }, lines.map((line, index) => (0, import_react2.createElement)("p", {
      key: index,
      style: { margin: index === 0 ? 0 : "6px 0 0", fontSize: "12px", color: T.labelSecondary, lineHeight: "1.6" }
    }, line))) : null
  ]);
}
function FieldBox({ label, hint, help, first, children }) {
  const helpId = `codexpro-help-${label}`;
  return (0, import_react2.createElement)("div", { style: fieldBox(first) }, [
    (0, import_react2.createElement)("div", { key: "head", style: { display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" } }, [
      (0, import_react2.createElement)("span", { key: "l", style: fieldLabel }, label),
      help ? (0, import_react2.createElement)(Help, { key: "help", id: helpId, lines: help }) : null
    ]),
    children,
    hint ? (0, import_react2.createElement)("p", { key: "hint", style: hintText }, hint) : null
  ]);
}
function Group({ id, title, note, trailing, first, children }) {
  const headingId = `codexpro-group-${id}`;
  return (0, import_react2.createElement)("section", { style: groupBox(first), "aria-labelledby": headingId }, [
    (0, import_react2.createElement)("div", { key: "head", style: { display: "flex", alignItems: "baseline", gap: "8px" } }, [
      (0, import_react2.createElement)("h3", { key: "t", id: headingId, style: groupTitle }, title),
      trailing ?? null
    ]),
    note ? (0, import_react2.createElement)("p", { key: "n", style: { ...hintText, margin: "2px 0 0" } }, note) : null,
    children
  ]);
}
function NetworkGroup({ fields, disabled, onEdit }) {
  const needsHost = NEEDS_HOSTNAME.has(fields.tunnelMode.text);
  const needsName = needsTunnelName(fields.tunnelMode.text);
  return (0, import_react2.createElement)(Group, { id: "network", title: "\u7F51\u7EDC\u63A5\u5165", first: true, note: "ChatGPT \u901A\u8FC7\u54EA\u4E2A\u5730\u5740\u8FDE\u5230\u672C\u673A\u3002\u6539\u5B8C\u9700\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\u3002" }, [
    (0, import_react2.createElement)(FieldBox, {
      key: "tunnel",
      label: "Tunnel \u65B9\u5F0F",
      first: true,
      hint: "\u9ED8\u8BA4 none\uFF1A\u53EA\u5728\u672C\u673A\u53EF\u7528\uFF0C\u4E0D\u66B4\u9732\u5230\u516C\u7F51",
      help: HELP.tunnelMode
    }, (0, import_react2.createElement)("select", {
      value: fields.tunnelMode.text,
      disabled,
      onChange: (event) => onEdit(TUNNEL_MODE, event.target.value),
      style: { ...selectStyle, maxWidth: "320px", cursor: disabled ? "default" : "pointer" }
    }, TUNNEL_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, TUNNEL_LABELS[mode] ?? mode)))),
    needsHost ? (0, import_react2.createElement)(FieldBox, {
      key: "hostname",
      label: "\u516C\u7F51 hostname",
      hint: "\u8BE5 tunnel \u65B9\u5F0F\u5FC5\u9700\uFF0Ccodexpro \u4EA6\u5F3A\u5236\u8981\u6C42",
      help: HELP.tunnelHostname
    }, (0, import_react2.createElement)("input", {
      type: "text",
      value: fields.tunnelHostname.text,
      disabled,
      placeholder: "your-domain.ngrok-free.dev",
      onChange: (event) => onEdit(TUNNEL_HOSTNAME, event.target.value),
      style: { ...fieldStyle, maxWidth: "320px" }
    })) : null,
    needsName ? (0, import_react2.createElement)(FieldBox, {
      key: "tunnelName",
      label: "Cloudflare \u96A7\u9053\u540D",
      hint: "Cloudflare \u540E\u53F0\u91CC\u90A3\u6761\u5177\u540D\u96A7\u9053\u7684\u540D\u5B57\uFF1B\u4E0E\u4E0A\u9762\u7684 hostname \u662F\u4E24\u4E2A\u4E0D\u540C\u7684\u503C",
      help: HELP.tunnelName
    }, (0, import_react2.createElement)("input", {
      type: "text",
      value: fields.tunnelName.text,
      disabled,
      placeholder: "codexpro",
      "aria-invalid": fields.tunnelName.invalid ? true : void 0,
      onChange: (event) => onEdit(TUNNEL_NAME, event.target.value),
      style: {
        ...fieldStyle,
        maxWidth: "320px",
        borderColor: fields.tunnelName.invalid ? T.error : T.borderL4
      }
    }), fields.tunnelName.invalid ? (0, import_react2.createElement)("p", { key: "bad", style: { ...hintText, color: T.error } }, "\u96A7\u9053\u540D\u4E0D\u80FD\u8D85\u8FC7 128 \u4E2A\u5B57\u7B26") : null) : null,
    (0, import_react2.createElement)(FieldBox, {
      key: "port",
      label: "\u672C\u5730\u7AEF\u53E3",
      hint: "\u4EC5\u5728\u672C\u673A\u7AEF\u53E3\u51B2\u7A81\u65F6\u624D\u9700\u4FEE\u6539",
      help: HELP.port
    }, (0, import_react2.createElement)("input", {
      type: "text",
      inputMode: "numeric",
      value: fields.port.text,
      disabled,
      placeholder: "8787",
      "aria-invalid": fields.port.invalid ? true : void 0,
      onChange: (event) => onEdit(PORT, event.target.value),
      style: {
        ...fieldStyle,
        maxWidth: "140px",
        borderColor: fields.port.invalid ? T.error : T.borderL4
      }
    }), fields.port.invalid ? (0, import_react2.createElement)("p", { key: "bad", style: { ...hintText, color: T.error } }, "\u7AEF\u53E3\u9700\u4E3A 1\u201365535 \u7684\u6574\u6570") : null)
  ]);
}
function OptionsFields({ fields, disabled, onEdit, onReset }) {
  return (0, import_react2.createElement)("div", null, [
    (0, import_react2.createElement)(NetworkGroup, { key: "net", fields, disabled, onEdit }),
    (0, import_react2.createElement)(Group, { key: "perm", id: "permission", title: "\u6743\u9650", note: "\u51B3\u5B9A ChatGPT \u80FD\u5728\u4F60\u7684\u9879\u76EE\u91CC\u505A\u5230\u4EC0\u4E48\u7A0B\u5EA6\uFF0C\u662F\u98CE\u9669\u63A7\u5236\u7684\u4E3B\u8981\u5F00\u5173\u3002" }, [
      (0, import_react2.createElement)(FieldBox, {
        key: "bash",
        label: "bash \u6A21\u5F0F",
        first: true,
        hint: "safe \u8986\u76D6\u5927\u591A\u6570\u573A\u666F\uFF1Bfull \u7B49\u540C\u4E8E\u4F60\u81EA\u5DF1\u5728\u7EC8\u7AEF\u64CD\u4F5C",
        help: HELP.bashMode
      }, (0, import_react2.createElement)("select", {
        value: fields.bashMode.text,
        disabled,
        onChange: (event) => onEdit(BASH_MODE, event.target.value),
        style: { ...selectStyle, maxWidth: "140px", cursor: disabled ? "default" : "pointer" }
      }, BASH_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, mode)))),
      (0, import_react2.createElement)(FieldBox, {
        key: "write",
        label: "\u5199\u5165\u6A21\u5F0F",
        hint: "workspace \u5141\u8BB8\u5728\u5DF2\u6388\u6743\u76EE\u5F55\u5185\u76F4\u63A5\u8BFB\u5199",
        help: HELP.writeMode
      }, (0, import_react2.createElement)("select", {
        value: fields.writeMode.text,
        disabled,
        onChange: (event) => onEdit(WRITE_MODE, event.target.value),
        style: { ...selectStyle, maxWidth: "140px", cursor: disabled ? "default" : "pointer" }
      }, WRITE_MODES.map((mode) => (0, import_react2.createElement)("option", { key: mode, value: mode }, mode))))
    ])
  ]);
}
function WorkspacesField({ workspaces, authorized, disabled, onEdit }) {
  const toggle = (path, next) => {
    const mapped = { ...authorized };
    if (next) mapped[path] = true;
    else delete mapped[path];
    onEdit(AUTHORIZED, JSON.stringify(mapped));
  };
  const selected = Object.keys(authorized).length;
  const list = Array.isArray(workspaces) ? workspaces : [];
  return (0, import_react2.createElement)(Group, {
    id: "workspaces",
    title: "\u6388\u6743\u5DE5\u4F5C\u533A",
    note: "\u672A\u52FE\u9009\u7684\u76EE\u5F55 ChatGPT \u770B\u4E0D\u5230\u3002",
    // 计数与帮助按钮放标题行（官方 .groupHead 的计数位），使三组结构一致：
    // 标题（+ 计数）→ 说明 → 内容。
    trailing: (0, import_react2.createElement)("span", { key: "tail", style: { display: "inline-flex", alignItems: "center", gap: "4px" } }, [
      list.length ? (0, import_react2.createElement)("span", { key: "c", style: { ...captionText, fontVariantNumeric: "tabular-nums" } }, `\u5DF2\u9009 ${selected} / ${list.length}`) : null,
      (0, import_react2.createElement)(Help, { key: "help", id: "codexpro-help-authorized", lines: HELP.authorized })
    ])
  }, [
    list.length === 0 ? (0, import_react2.createElement)(
      "p",
      { key: "empty", style: { ...hintText, marginTop: "8px" } },
      "\u5F53\u524D\u5B9E\u4F8B\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u533A\u3002\u5728 DSH \u91CC\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\u540E\uFF0C\u5B83\u5C31\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"
    ) : (0, import_react2.createElement)("div", {
      key: "list",
      style: { marginTop: "6px", border: `${HAIRLINE} solid ${T.borderL4}`, borderRadius: R.md, overflow: "hidden" }
    }, list.map((item, index) => (0, import_react2.createElement)("div", {
      key: item.path,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        fontSize: "13px",
        borderTop: index === 0 ? "none" : `${HAIRLINE} solid ${T.borderL2}`,
        background: T.bgLayer3,
        opacity: item.exists ? 1 : 0.55
      }
    }, [
      (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Checkbox, {
        key: "box",
        checked: authorized[item.path] === true,
        disabled: disabled || !item.exists,
        onChange: (next) => toggle(item.path, next)
      }),
      (0, import_react2.createElement)("span", { key: "title", style: { ...fieldLabel, fontWeight: 400, flex: "none" } }, item.title),
      (0, import_react2.createElement)("span", { key: "path", style: { ...captionText, flex: "1 1 auto", wordBreak: "break-all" } }, item.path),
      item.exists ? null : (0, import_react2.createElement)(import_dsh_client_ui_primitives2.Tag, { key: "miss", tone: "neutral" }, "\u76EE\u5F55\u4E0D\u5B58\u5728")
    ])))
  ]);
}

// src/client/use-catalog.js
var import_react3 = require("react");
function useCatalog(call) {
  const [catalog, setCatalog] = (0, import_react3.useState)(null);
  const [error, setError] = (0, import_react3.useState)("");
  const refresh = (0, import_react3.useCallback)(async () => {
    try {
      setCatalog(await call("catalog"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [call]);
  (0, import_react3.useEffect)(() => {
    refresh();
  }, [refresh]);
  return { catalog, anchorDir: catalog?.anchorDir ?? "", error, refresh };
}

// src/client/use-process.js
var import_react4 = require("react");
function describeError(failure) {
  return failure instanceof Error ? failure.message : String(failure);
}
function useProcess(call) {
  const [status, setStatus] = (0, import_react4.useState)(null);
  const [error, setError] = (0, import_react4.useState)("");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const refresh = (0, import_react4.useCallback)(async () => {
    try {
      setStatus(await call("status"));
    } catch (failure) {
      setError(describeError(failure));
    }
  }, [call]);
  (0, import_react4.useEffect)(() => {
    refresh();
  }, [refresh]);
  const act = (0, import_react4.useCallback)(async (action) => {
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
var LABELS = {
  unavailable: "\u672C profile \u672A\u63D0\u4F9B\u8BE5\u914D\u7F6E\u9879\uFF08\u63D2\u4EF6\u884C\u672A\u6FC0\u6D3B\u6216\u8BBE\u7F6E\u9762\u53EA\u8BFB\uFF09\uFF0C\u5F53\u524D\u6309\u63D2\u4EF6\u884C\u914D\u7F6E\u5DE5\u4F5C\u3002",
  readOnly: "\u5F53\u524D profile \u7684\u8BBE\u7F6E\u9762\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u3002",
  saveFailed: "\u4FDD\u5B58\u672A\u751F\u6548\uFF1AHost \u672A\u63A5\u53D7\uFF08\u6821\u9A8C\u672A\u901A\u8FC7\u6216\u7248\u672C\u51B2\u7A81\uFF09\uFF0C\u5DF2\u56DE\u8BFB\u5F53\u524D\u751F\u6548\u503C\uFF1B\u8349\u7A3F\u4FDD\u7559\uFF0C\u8BF7\u8C03\u6574\u540E\u91CD\u8BD5\u3002",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026"
};
function CodexProCard(props) {
  const form = props.useCodexProForm((snapshot) => snapshot);
  const process = useProcess(props.call);
  const { catalog } = useCatalog(props.call);
  if (props.view === "summary") {
    return (0, import_react5.createElement)("span", null, "\u7BA1\u7406 codexpro\uFF1A\u6388\u6743\u5DE5\u4F5C\u533A\u3001\u63A7\u5236\u8FDB\u7A0B\u3001\u9009\u62E9 tunnel \u65B9\u5F0F");
  }
  const disabled = !form.writable || form.saving;
  return (0, import_react5.createElement)("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } }, [
    (0, import_react5.createElement)(ProcessBlock, { key: "process", status: process.status, error: process.error, busy: process.busy, onAction: process.act, onRefresh: process.refresh }),
    (0, import_react5.createElement)(import_dsh_client_ui_primitives3.SettingsForm, {
      key: "form",
      labels: LABELS,
      state: form,
      onSave: props.save,
      onDiscard: props.discard
    }, [
      (0, import_react5.createElement)(OptionsFields, {
        key: "options",
        fields: {
          tunnelMode: form[TUNNEL_MODE],
          tunnelHostname: form[TUNNEL_HOSTNAME],
          tunnelName: form[TUNNEL_NAME],
          port: form[PORT],
          bashMode: form[BASH_MODE],
          writeMode: form[WRITE_MODE]
        },
        disabled,
        onEdit: props.edit,
        onReset: props.resetField
      }),
      (0, import_react5.createElement)(WorkspacesField, {
        key: "workspaces",
        workspaces: catalog?.workspaces ?? [],
        authorized: authorizedOfText(form[AUTHORIZED]?.text ?? ""),
        disabled,
        onEdit: props.edit
      }),
      (0, import_react5.createElement)(
        "p",
        { key: "note", style: captionText },
        "\u6388\u6743\u4E0E\u53C2\u6570\u6539\u52A8\u9700\u91CD\u542F\u8FDB\u7A0B\u624D\u751F\u6548\uFF1B\u300C\u4FDD\u5B58\u300D\u5199\u5165\u672C profile \u7684\u884C\u914D\u7F6E\uFF08cordis.patch.yml\uFF09\u3002"
      )
    ])
  ]);
}
function ProcessBlock({ status, error, busy, onAction, onRefresh }) {
  const state = status?.state ?? "idle";
  const canStart = state === "idle" || state === "failed";
  const canStop = state === "running" || state === "starting";
  return (0, import_react5.createElement)("section", { style: cardStyle }, [
    (0, import_react5.createElement)("div", { key: "head", style: { ...S.listRow, justifyContent: "space-between" } }, [
      (0, import_react5.createElement)("div", { key: "left", style: { display: "flex", alignItems: "center", gap: "10px" } }, [
        (0, import_react5.createElement)(StatePill, { key: "pill", state }),
        (0, import_react5.createElement)("span", { key: "meta", style: noteText }, status ? `\u7AEF\u53E3 ${status.port} \xB7 tunnel ${status.tunnel}` : "")
      ]),
      (0, import_react5.createElement)("div", { key: "actions", style: S.toolbar }, [
        (0, import_react5.createElement)(ActionButton, { key: "start", label: "\u542F\u52A8", primary: true, disabled: busy || !canStart, onClick: () => onAction("start") }),
        (0, import_react5.createElement)(ActionButton, { key: "stop", label: "\u505C\u6B62", disabled: busy || !canStop, onClick: () => onAction("stop") }),
        (0, import_react5.createElement)(ActionButton, { key: "refresh", label: "\u5237\u65B0\u72B6\u6001", disabled: busy, onClick: onRefresh })
      ])
    ]),
    (0, import_react5.createElement)(Divider, { key: "div" }),
    (0, import_react5.createElement)("div", { key: "url", style: { padding: "8px 12px" } }, [
      (0, import_react5.createElement)("div", { key: "l", style: { ...noteText, marginBottom: "4px" } }, "Server URL\uFF08\u7C98\u8D34\u5230 ChatGPT \u8FDE\u63A5\u5668\u7684 Server URL \u5B57\u6BB5\uFF09"),
      (0, import_react5.createElement)("code", {
        key: "v",
        style: {
          display: "block",
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "18px",
          borderRadius: R.sm,
          background: T.bgModulePlatform,
          color: T.labelSecondary,
          wordBreak: "break-all"
        }
      }, status?.url || "\uFF08\u672A\u8FD0\u884C\u6216\u5C1A\u672A\u751F\u6210 token\uFF09")
    ]),
    error ? (0, import_react5.createElement)(ErrorBar, { key: "err", message: error }) : null,
    status?.lastError ? (0, import_react5.createElement)(ErrorBar, { key: "last", message: status.lastError }) : null
  ]);
}
function ActionButton({ label, primary, disabled, onClick }) {
  return (0, import_react5.createElement)("button", {
    type: "button",
    disabled,
    onClick,
    style: {
      border: primary ? "none" : `${HAIRLINE} solid ${T.borderL2}`,
      borderRadius: R.sm,
      background: primary ? T.labelPrimary : "transparent",
      color: primary ? T.bgLayer3 : T.labelSecondary,
      font: "inherit",
      fontSize: "13px",
      padding: "4px 12px",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1
    }
  }, label);
}

// src/client/index.jsx
var inject = ["slots", "configForms", "connection"];
function apply(ctx) {
  const call = createCall(ctx);
  const scope = ctx.configForms.get(CONFIG_NS);
  const controller = createController(scope);
  ctx.effect(() => () => controller.form.dispose(), "dsh-codexpro: settings form model");
  ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => ctx.slots.inject(
    "plugins.row.config",
    () => ctx.slots.register(
      { name: "plugins.row.config", key: ROW_CONFIG_KEY, inject: () => ({ call, ...controller.inject() }) },
      CodexProCard
    )
  )), "dsh-codexpro: row config slot");
}
return module.exports; } });
