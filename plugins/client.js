/* @alm-allen/dsh-agent-preset — 插件管理页配置卡。手写单文件客户端 bundle，无构建步骤。 */
window.__ModuleLoader__.load({
  id: "@alm-allen/dsh-agent-preset",
  factory: (require) => {
    const React = require("react")
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives")

    const PACKAGE_NAME = "@alm-allen/dsh-agent-preset"
    const SETTINGS_NAMESPACE = "agent-preset"
    const FIELDS = [
      { key: "yayan", zh: ["雅言 · 标准模式", "把标准模式的系统提示词与工具说明切换为中文。关闭时保持原生英文标准模式。"], en: ["Yayan · Standard", "Switch Standard to Chinese prompts and tool descriptions. Off keeps the shipped English preset unchanged."], fallback: false, group: "native" },
      { key: "cangjie", zh: ["仓颉 · PTC 模式", "把 PTC 模式的系统提示词与 run_code 说明切换为中文。关闭时保持原生英文 PTC 模式。"], en: ["Cangjie · PTC", "Switch PTC to Chinese prompts and run_code documentation. Off keeps the shipped English preset unchanged."], fallback: false, group: "native" },
      { key: "maliang", zh: ["马良 · 创造模式", "把创造模式的系统提示词、工具与技能目录说明切换为中文。关闭时保持原生英文创造模式。"], en: ["Maliang · Creator", "Switch Creator prompts, tools and skill catalog text to Chinese. Off keeps the shipped English preset unchanged."], fallback: false, group: "native" },
      { key: "chat", zh: ["Chat · 极简模式", "把极简模式换成零工具、零系统提示词的纯对话组合。关闭时保持原生英文极简模式。"], en: ["Chat · Minimal", "Replace Minimal with a zero-tool, zero-system-prompt conversation preset. Off keeps the shipped Minimal preset unchanged."], fallback: false, group: "native" },
      { key: "yinyu", zh: ["引玉 · 独立预设", "保留极简系统提示词与 PTC run_code 环境的新增预设。关闭后该预设从可选列表中移除。"], en: ["Yinyu · standalone preset", "The extra preset with a minimal system prompt and the PTC run_code environment. Off removes it from the preset roster."], fallback: true, group: "standalone" },
    ]

    const COPY = {
      zh: {
        summary: "四个原生预设替代默认关闭，引玉默认开启。",
        nativeTitle: "原生预设替代（汉化 / 纯对话）",
        nativeHint: "四个替代项默认关闭。关闭时对应预设与原生版本完全一致；打开汉化项会立即改为中文，打开 Chat 会切换为零工具、零系统提示词的纯对话组合，都不需要重装插件。",
        standaloneTitle: "非原生预设",
        standaloneHint: "引玉是新增条目，没有原生版本可回退；关闭后从 Agent 预设列表中移除。",
        offByDefault: "默认关闭",
        onByDefault: "默认开启",
        overridden: "已覆盖",
        reset: "恢复默认",
        saving: "正在保存…",
        failed: "保存未生效，请重试。",
        unavailable: "暂时读不到这个插件的配置。请确认插件已启用，然后重新打开本页。",
        readOnly: "当前设置不可修改。",
      },
      en: {
        summary: "The four native-preset replacements default off; Yinyu defaults on.",
        nativeTitle: "Native preset replacements",
        nativeHint: "All four replacements default off. Off keeps each preset identical to the shipped version; on switches localization presets to Chinese or Chat to a zero-tool, zero-system-prompt conversation, with no reinstall.",
        standaloneTitle: "Standalone preset",
        standaloneHint: "Yinyu has no native counterpart. Turning it off removes it from the Agent preset roster.",
        offByDefault: "Default off",
        onByDefault: "Default on",
        overridden: "Overridden",
        reset: "Reset",
        saving: "Saving…",
        failed: "The save did not take effect. Please try again.",
        unavailable: "This plugin's configuration is unavailable right now. Check that the plugin is enabled, then reopen this page.",
        readOnly: "These settings cannot be changed.",
      },
    }

    const CSS = `
.dsh-agent-preset-form { display:flex; flex-direction:column; gap:18px; }
.dsh-agent-preset-group { display:flex; flex-direction:column; gap:4px; }
.dsh-agent-preset-heading { margin:0; color:var(--dsw-alias-label-primary); font-size:14px; font-weight:600; line-height:22px; }
.dsh-agent-preset-intro { margin:0 0 8px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.dsh-agent-preset-row { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:12px 0; border-top:.5px solid var(--dsw-alias-border-l2); }
.dsh-agent-preset-row-text { min-width:0; }
.dsh-agent-preset-label-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dsh-agent-preset-label { color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:20px; }
.dsh-agent-preset-default { color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:18px; }
.dsh-agent-preset-hint { margin:2px 0 0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.dsh-agent-preset-badges { display:inline-flex; align-items:center; gap:6px; }
.dsh-agent-preset-badge { color:var(--dsw-alias-state-business-primary); font-size:11px; line-height:18px; }
.dsh-agent-preset-reset { border:0; background:none; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:11px; cursor:pointer; padding:0; }
.dsh-agent-preset-reset:hover { color:var(--dsw-alias-label-primary); }
.dsh-agent-preset-status { margin:0; color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-tertiary)); font-size:12px; line-height:18px; }
.dsh-agent-preset-notice { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
`

    function activeLanguage(locale) {
      const value = locale?.getSnapshot?.().active
      if (typeof value === "string" && value) return value
      return typeof navigator === "undefined" ? "zh" : navigator.language
    }

    function stored(snapshot, field) {
      const value = snapshot && snapshot.value
      const actual = value && value[field.key]
      return typeof actual === "boolean" ? actual : field.fallback
    }

    function overridden(snapshot, field) {
      const user = snapshot && snapshot.user
      return user !== null && typeof user === "object" && Object.prototype.hasOwnProperty.call(user, field.key)
    }

    function ConfigCard(props) {
      const scope = props.scope
      const locale = props.locale
      const view = props.view
      const subscribe = React.useCallback((listener) => scope.subscribe(listener), [scope])
      const getSnapshot = React.useCallback(() => scope.getSnapshot(), [scope])
      const snapshot = React.useSyncExternalStore(subscribe, getSnapshot)
      const subscribeLocale = React.useCallback((listener) => locale ? locale.subscribe(listener) : () => {}, [locale])
      const localeSnapshot = React.useCallback(() => locale ? locale.getSnapshot() : null, [locale])
      React.useSyncExternalStore(subscribeLocale, localeSnapshot)
      const language = activeLanguage(locale)
      const copy = language.toLowerCase().split("-")[0] === "en" ? COPY.en : COPY.zh
      const [saving, setSaving] = React.useState(null)
      const [failed, setFailed] = React.useState(false)

      if (view === "summary") return copy.summary

      const unavailable = !snapshot || snapshot.status === "unavailable"
      const readOnly = snapshot?.writable === false
      const controlsDisabled = saving !== null || unavailable || readOnly

      async function writeField(field, next) {
        setSaving(field.key)
        setFailed(false)
        try {
          const accepted = await scope.set(field.key, next)
          if (!accepted || stored(scope.getSnapshot(), field) !== next) setFailed(true)
        } catch {
          setFailed(true)
        } finally {
          setSaving(null)
        }
      }

      async function resetField(field) {
        setSaving(field.key)
        setFailed(false)
        try {
          await scope.unset(field.key)
          if (overridden(scope.getSnapshot(), field)) setFailed(true)
        } catch {
          setFailed(true)
        } finally {
          setSaving(null)
        }
      }

      function row(field) {
        const text = language.toLowerCase().split("-")[0] === "en" ? field.en : field.zh
        return React.createElement("div", { className: "dsh-agent-preset-row", key: field.key },
          React.createElement("div", { className: "dsh-agent-preset-row-text" },
            React.createElement("div", { className: "dsh-agent-preset-label-line" },
              React.createElement("span", { className: "dsh-agent-preset-label" }, text[0]),
              React.createElement("span", { className: "dsh-agent-preset-default" }, field.fallback ? copy.onByDefault : copy.offByDefault),
              overridden(snapshot, field) && React.createElement("span", { className: "dsh-agent-preset-badges" },
                React.createElement("span", { className: "dsh-agent-preset-badge" }, copy.overridden),
                React.createElement("button", { type: "button", className: "dsh-agent-preset-reset", disabled: controlsDisabled, onClick: () => void resetField(field) }, copy.reset)
              )
            ),
            React.createElement("p", { className: "dsh-agent-preset-hint" }, text[1])
          ),
          React.createElement(primitives.Switch, {
            checked: stored(snapshot, field),
            disabled: controlsDisabled,
            label: text[0],
            onChange: (next) => void writeField(field, next),
          })
        )
      }

      if (unavailable) return React.createElement("p", { className: "dsh-agent-preset-notice", role: "status" }, copy.unavailable)

      const nativeFields = FIELDS.filter(field => field.group === "native")
      const standaloneFields = FIELDS.filter(field => field.group === "standalone")
      return React.createElement("div", { className: "dsh-agent-preset-form", "data-plugin-config-form": SETTINGS_NAMESPACE },
        readOnly && React.createElement("p", { className: "dsh-agent-preset-notice", role: "status" }, copy.readOnly),
        React.createElement("section", { className: "dsh-agent-preset-group" },
          React.createElement("h3", { className: "dsh-agent-preset-heading" }, copy.nativeTitle),
          React.createElement("p", { className: "dsh-agent-preset-intro" }, copy.nativeHint),
          nativeFields.map(row)
        ),
        React.createElement("section", { className: "dsh-agent-preset-group" },
          React.createElement("h3", { className: "dsh-agent-preset-heading" }, copy.standaloneTitle),
          React.createElement("p", { className: "dsh-agent-preset-intro" }, copy.standaloneHint),
          standaloneFields.map(row)
        ),
        failed && React.createElement("p", { className: "dsh-agent-preset-status", role: "status" }, copy.failed),
        saving !== null && React.createElement("p", { className: "dsh-agent-preset-notice", role: "status" }, copy.saving)
      )
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement("style")
        style.dataset.plugin = "dsh-agent-preset"
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, "agent-preset: config card styles")

      const scope = ctx.configForms.get(SETTINGS_NAMESPACE)
      ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
        name: "plugins.bundle.config",
        key: PACKAGE_NAME,
        inject: () => {
          const locale = ctx.reflect.get("locale")
          return { scope, locale: locale == null ? undefined : locale }
        },
      }, ConfigCard))
    }

    const pluginExports = { inject: ["slots", "configForms"], apply }
    return pluginExports
  },
});
