/* @alm-allen/dsh-agent-preset — 插件管理页配置卡。手写单文件客户端 bundle，无构建步骤。 */
window.__ModuleLoader__.load({
  id: "@alm-allen/dsh-agent-preset",
  factory: (require) => {
    const React = require("react")
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives")

    const PACKAGE_NAME = "@alm-allen/dsh-agent-preset"
    const SETTINGS_NAMESPACE = "agent-preset"
    const FIELDS = [
      { key: "yayan", zh: ["雅言 · 标准模式", "把标准模式的系统提示词与工具说明切换为中文。关闭时保持原生英文标准模式。"], en: ["Yayan · Standard", "Switch Standard to Chinese prompts and tool descriptions. Off keeps the shipped English preset unchanged."], fallback: false },
      { key: "cangjie", zh: ["仓颉 · PTC 模式", "把 PTC 模式的系统提示词与 run_code 说明切换为中文。关闭时保持原生英文 PTC 模式。"], en: ["Cangjie · PTC", "Switch PTC to Chinese prompts and run_code documentation. Off keeps the shipped English preset unchanged."], fallback: false },
      { key: "maliang", zh: ["马良 · 创造模式", "把创造模式的系统提示词、工具与技能目录说明切换为中文。关闭时保持原生英文创造模式。"], en: ["Maliang · Creator", "Switch Creator prompts, tools and skill catalog text to Chinese. Off keeps the shipped English preset unchanged."], fallback: false },
    ]

    const COPY = {
      zh: {
        summary: "雅言、仓颉与马良的开关都在这里调。",
        overridden: "已覆盖",
        reset: "重置",
        failed: "保存未生效，请重试。",
        unavailable: "暂时读不到这个插件的配置。请确认插件已启用，然后重新打开本页。",
        readOnly: "当前设置不可修改。",
      },
      en: {
        summary: "Switches for Yayan, Cangjie and Maliang are all here.",
        overridden: "Overridden",
        reset: "Reset",
        failed: "The save did not take effect. Please try again.",
        unavailable: "This plugin's configuration is unavailable right now. Check that the plugin is enabled, then reopen this page.",
        readOnly: "These settings cannot be changed.",
      },
    }

    const CSS = `
.dsh-agent-preset-form { display:flex; flex-direction:column; }
.dsh-agent-preset-notice { margin:0 0 12px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:1.5; }
.dsh-agent-preset-row { display:flex; align-items:center; gap:12px; padding:12px 0; }
.dsh-agent-preset-row:not(:first-child) { border-top:.5px solid var(--dsw-alias-border-l2); }
.dsh-agent-preset-row-text { display:flex; flex:1; flex-direction:column; gap:4px; min-width:0; }
.dsh-agent-preset-label-line { display:flex; align-items:center; gap:6px; min-width:0; }
.dsh-agent-preset-label { min-width:0; color:var(--dsw-alias-label-primary); font-size:13px; font-weight:500; line-height:1.5; }
.dsh-agent-preset-hint { margin:0; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:1.5; }
.dsh-agent-preset-badges { display:inline-flex; align-items:center; gap:8px; }
.dsh-agent-preset-reset { padding:0; border:none; background:none; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:1.5; cursor:pointer; }
.dsh-agent-preset-reset:hover:not(:disabled) { color:var(--dsw-alias-label-primary); }
.dsh-agent-preset-reset:disabled { cursor:default; }
.dsh-agent-preset-failed { margin:0 0 4px; color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-error)); font-size:12px; line-height:1.5; }
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
              React.createElement("span", { className: "dsh-agent-preset-label" }, text[0])
            ),
            React.createElement("p", { className: "dsh-agent-preset-hint" }, text[1])
          ),
          overridden(snapshot, field) && React.createElement("span", { className: "dsh-agent-preset-badges" },
            React.createElement(primitives.Tag, { tone: "neutral" }, copy.overridden),
            React.createElement("button", { type: "button", className: "dsh-agent-preset-reset", disabled: controlsDisabled, onClick: () => void resetField(field) }, copy.reset)
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

      return React.createElement("div", { className: "dsh-agent-preset-form", "data-plugin-config-form": SETTINGS_NAMESPACE },
        readOnly && React.createElement("p", { className: "dsh-agent-preset-notice", role: "status" }, copy.readOnly),
        FIELDS.map(row),
        failed && React.createElement("p", { className: "dsh-agent-preset-failed", role: "status" }, copy.failed)
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
