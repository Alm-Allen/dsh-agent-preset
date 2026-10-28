/**
 * chat-zero-injection：把 Agent 作用域注入的工具与上下文从本预设的组装结果里摘掉。
 *
 * persona 的 complete 只管 sections，includeRuntimeContext 只管可选 context，restrict 只管继承工具，
 * 所以还需要在组装瀑布末端清空 tools 与 contexts。宿主的 required 工作目录上下文每步都被
 * refreshContext 补回，只能在 provider 层用同 scope 的同名空条目遮蔽，清组装结果拦不住它。
 * 两个坑的成因见 文档/机制/Chat-零注入.md。
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 @deepseek-ai/*。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'chat-zero-injection'

/** 组装瀑布是硬依赖：没有它就无法改写最终的 tools/contexts。 */
export const inject = ['systemPrompt']

/** 宿主注册的 required 工作目录上下文名：同 scope 同名遮蔽后它的文本为空，渲染不出快照。 */
const WORKING_DIRECTORY_CONTEXT = 'working-directory:current'

/** 遮蔽条目的排序：沿用 dsh 给工作目录分配的那一档，取不到服务方法时退回同一个数。 */
const WORKING_DIRECTORY_ORDER = 100

/** 遮蔽宿主的工作目录上下文，并在组装瀑布末端清空 tools 与 contexts。 */
export function apply(ctx) {
	// 必须 prepend：宿主的注入者在 await next() 之后再补 content，排在它们外层才清得掉
	const order = typeof ctx.systemPrompt.getContextOrder === 'function'
		? ctx.systemPrompt.getContextOrder('WORKING_DIRECTORY')
		: WORKING_DIRECTORY_ORDER
	ctx.systemPrompt.context({
		name: WORKING_DIRECTORY_CONTEXT,
		order,
		required: true,
		interpolate: false,
		text: '',
	})

	ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
		const assembled = await next()
		if (assembled === null || typeof assembled !== 'object') return assembled
		return { ...assembled, contexts: [], tools: [] }
	}, { prepend: true })
}
