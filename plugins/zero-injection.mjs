/**
 * chat-zero-injection：把 **Agent 作用域** 注入的工具与上下文从本预设的组装结果里摘掉。
 *
 * 背景：`persona` 的 `complete: true` 只约束 sections；`includeRuntimeContext: false`
 * 只过滤**可选**的 context（`required: true` 的仍保留）；`tools.restrict({ allow: [] })`
 * 只过滤本 scope **继承到**的工具——agent 自己那层注册的工具照旧可见。
 *
 * 于是像 Agent Teams 这类在 `agent.ctx` 上 `tools.register()`、再挂一个
 * `systemPrompt.context({ required: true })` 的插件，会同时绕过前两道防线：9 个团队
 * 工具出现在纯对话会话里，`team:identity` 也进提示词。会话那边看起来只是"多了一点
 * 东西"，从对话历史里根本看不出来——这正是本文件存在的原因。
 *
 * 做法：在 `system-prompt/assemble` 瀑布末端（`await next()` 之后）把 `tools` 与
 * `contexts` 置空。sections 不在这里动：`persona` 的 `complete` 会在组装引擎里
 * 把它们恢复成 persona 那一节。
 *
 * 为什么不按名字过滤：本预设的语义是「一个工具、一条上下文都没有」，与注入者是谁无关；
 * 白名单/黑名单都要跟着上游改，而空集不会。
 *
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 `@deepseek-ai/*`。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'chat-zero-injection'

/** 组装瀑布是硬依赖：没有它就无法改写最终的 tools/contexts。 */
export const inject = ['systemPrompt']

/** 在组装结果的末端清空 tools 与 contexts。 */
export function apply(ctx) {
	ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
		const assembled = await next()
		if (assembled === null || typeof assembled !== 'object') return assembled
		return { ...assembled, contexts: [], tools: [] }
	})
}
