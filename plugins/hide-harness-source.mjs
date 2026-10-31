/**
 * hide-harness-source：只关掉运行时上下文里的「检出目录」那一条。
 *
 * 快照里其余条目（工作目录、文件策略、审批状态、GUI URL）照常注入。
 * 为什么要在 provider 层遮蔽而不是改组装结果，见 文档/机制/运行时上下文.md。
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 @deepseek-ai/*。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'hide-harness-source'

/** 组装瀑布与上下文注册都是硬依赖。 */
export const inject = ['systemPrompt']

/** dsh-harness-dev-context 注册检出目录用的上下文名。 */
const HARNESS_SOURCE_CONTEXT = 'harness:source'

/** 取不到服务方法时退回 dsh 给这一档分配的排序。 */
const HARNESS_SOURCE_ORDER = 200

/** 用同 scope 的同名空条目遮蔽检出目录。 */
export function apply(ctx) {
	const order = typeof ctx.systemPrompt.getContextOrder === 'function'
		? ctx.systemPrompt.getContextOrder('HARNESS_SOURCE')
		: HARNESS_SOURCE_ORDER
	// 必须在 provider 层遮蔽：refreshContext 每步按注册表重建 context，
	// 只改组装结果拦不住它。空文本会被渲染侧滤掉，快照里这一条就不出现了。
	ctx.systemPrompt.context({
		name: HARNESS_SOURCE_CONTEXT,
		order,
		required: true,
		interpolate: false,
		text: '',
	})
}
