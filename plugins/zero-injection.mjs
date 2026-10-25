/**
 * chat-zero-injection：把 Agent 作用域注入的工具与上下文从本预设的组装结果里摘掉。
 *
 * persona 的 complete 只管 sections，includeRuntimeContext 只管可选 context，restrict 只管继承工具，
 * 所以还需要在组装瀑布末端清空 tools 与 contexts。原因见 文档/机制/Chat-零注入.md。
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 @deepseek-ai/*。
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
