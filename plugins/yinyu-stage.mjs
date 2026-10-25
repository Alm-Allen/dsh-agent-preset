/**
 * yinyu-stage：引玉的提示词与工具说明重排。
 *
 * 在 system-prompt/assemble 末端把 sections 收成一句 persona，并把共用执行政策、
 * tools:ptc-only 与 tools:sdk 移到第一个 runtime context：这一版的系统提示词必须严格只有那一句，
 * 工具声明只能住在这里。另在 agent/pre-step 把运行时上下文提到工作区指令之前。
 * 机制与取舍见 文档/机制/引玉.md。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'yinyu-stage'

/** 只依赖提示词注册表；工具由 PTC presentation 负责。 */
export const inject = ['systemPrompt']

/** 极简模式唯一的系统提示词。整份预设从头到尾只用这一句。 */
export const PROMPT_TEXT = 'You are a helpful software engineer assistant.'

/** 该句在提示词注册表里的段名（与 @deepseek-ai/dsh-persona 一致）。 */
export const PROMPT_SECTION = 'deployment:persona-prefix'

/** PTC 的「只能直连 run_code」说明段名。 */
export const PTC_ONLY_SECTION = 'tools:ptc-only'

/** PTC 生成的 SDK 声明段名。 */
export const SDK_SECTION = 'tools:sdk'

/** 第一个 runtime context 的名字：共用执行政策 + PTC 工具说明。 */
export const TOOLING_CONTEXT = 'yinyu:ptc-tooling'

/** dsh 侧的两类消息来源标记：运行时上下文快照与工作区指令。 */
const RUNTIME_CONTEXT_SOURCE = 'runtime-context'
const WORKSPACE_INSTRUCTIONS_SOURCE = 'agent-instructions'

/** 共用执行政策：安全边界、提问、成本与用户协作。四个预设各自保存一份正文，不要跨包 import */
export const EXECUTION_POLICY = `Execution policy:
Decide whether to act based only on reversibility and scope: reversible work within the current request (reading files, editing code, running tests, cleaning up temporary files you created in this task) is authorized—do it directly. Ask the user before irreversible operations or work outside the request (deleting or overwriting user data, rewriting git history, changing global configuration or credentials, installing dependencies, or touching content outside the workspace).

The user is patient and will not be annoyed by questions that materially affect the work; if uncertainty would affect the approach, result, or acceptance, ask directly instead of guessing or silently second-guessing.

Do not sacrifice correctness to save tokens; context is compacted automatically after milestones, so focus on delivering efficiently and with quality. Quality means locating the root cause, making the smallest correct change, and verifying it—not a surface-level patch chosen to avoid work.

The user is your collaborator: during development, when a feature is still incomplete, when real-environment or human verification is needed, or when you genuinely lack reference material, tools, or runtime access, ask the user directly for testing, feedback, or support. Verify locally first when you can; never pretend you verified something, and do not silently carry the problem alone.`

/**
 * 把 sections 收成那一句 persona，并把执行政策与工具说明放到第一个 runtime context。
 *
 * 幂等：每次返回新数组；同名 context 先剔除再前置。输入里没有 PTC 段时保留已有的
 * yinyu:ptc-tooling，并仍然保证它在第一位。
 */
export function apply(ctx) {
	ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
		const assembled = await next()
		if (assembled === null || typeof assembled !== 'object') return assembled
		const sections = Array.isArray(assembled.sections) ? assembled.sections : []
		const contexts = Array.isArray(assembled.contexts) ? assembled.contexts : []
		const readText = (name) => {
			const section = sections.find(candidate => candidate?.name === name)
			return typeof section?.text === 'string' ? section.text : ''
		}
		const tooling = [EXECUTION_POLICY, readText(PTC_ONLY_SECTION), readText(SDK_SECTION)]
			.filter(text => text.length > 0)
			.join('\n\n')
		const previous = contexts.find(context => context?.name === TOOLING_CONTEXT)
		const others = contexts.filter(context => context?.name !== TOOLING_CONTEXT)
		const toolingContext = tooling.length > 0
			? { name: TOOLING_CONTEXT, text: tooling, interpolate: false }
			: previous
		const nextContexts = toolingContext === undefined ? others : [toolingContext, ...others]
		return {
			...assembled,
			sections: [{ name: PROMPT_SECTION, text: PROMPT_TEXT, interpolate: false }],
			contexts: nextContexts,
		}
	}, { prepend: true })

	// dsh 把工作区指令插在运行时上下文之前。工具说明住在这条快照里，所以把它提高到指令之前：
	// 恒定内容排在随项目变化的内容前面，缓存前缀不被 AGENTS.md 的差异挡住
	ctx.on('agent/pre-step', async (_payload, next) => {
		const decision = await next()
		if (decision === null || typeof decision !== 'object' || decision.kind === 'reject') return decision
		if (!Array.isArray(decision.messages)) return decision
		const isRuntimeContext = (message) => message?.source?.kind === RUNTIME_CONTEXT_SOURCE
		const isInstructions = (message) => message?.source?.kind === WORKSPACE_INSTRUCTIONS_SOURCE
		const contextMessages = decision.messages.filter(isRuntimeContext)
		if (contextMessages.length === 0) return decision
		const rest = decision.messages.filter((message) => !isRuntimeContext(message))
		const instructionsIndex = rest.findIndex(isInstructions)
		if (instructionsIndex < 0) return decision
		const messages = [...rest.slice(0, instructionsIndex), ...contextMessages, ...rest.slice(instructionsIndex)]
		const unchanged = messages.every((message, index) => message === decision.messages[index])
		return unchanged ? decision : { ...decision, messages }
	}, { prepend: true })
}
