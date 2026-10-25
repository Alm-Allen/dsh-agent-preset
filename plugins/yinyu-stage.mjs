/**
 * yinyu-stage：引玉的提示词 / 工具说明锚定器。
 *
 * 这一版仍是单段：没有两段式、没有 `step/end` 或 `compaction/end` 切换、没有会话内的
 * `presentAs`。预设选了 PTC presentation：模型直连的工具只有 `run_code`，
 * standard 的其余工具全部作为生成的 SDK 绑定经 `run_code` 调用。
 *
 * 本文件在 `system-prompt/assemble` 的瀑布末端做两件事：
 *
 *   1. 把 sections 换成极简模式的那一句
 *      `You are a helpful software engineer assistant.`；
 *   2. 把共用执行政策、`tools:ptc-only` 与 `tools:sdk` 从系统提示词移到 **第一个**
 *      runtime context（`yinyu:ptc-tooling`）。`run_code` 必须靠 SDK 才知道有哪些工具、
 *      参数是什么；但这一版又要求系统提示词严格只有一句，所以工具声明不能留在 sections 里。
 *      放进 context 后，模型仍然看得到完整的 PTC 工具说明，而 system prompt 仍只有那句 persona。
 *
 * 为什么把执行政策放回 context：它承载安全范围、提问门槛、成本判断与用户协作方式，
 * 不是工具 schema 的一部分，SDK 不会自动带上。四个预设共用同一套语义，但正文各自保存，
 * 文件层面互不依赖。
 *
 * 为什么不是「native 标准工具 + run_code 同时直连」：DSH 的 tool presentation 只有
 * `native` 与 `ptc` 两种，`run_code` 是 ptc 的保留传输，不能在 native 模式里注册第二个同名工具。
 * 因此「加 run_code」只能切到 PTC；标准工具的能力没有减少，只是入口变成 SDK。
 *
 * 不碰的东西：
 *   - `tools` 原引用透传（PTC 下就是 `run_code` 的 schema）；
 *   - `variables` 原引用透传；
 *   - 消息不过滤，其它 runtime contexts 保持 standard 原生，只把 `yinyu:ptc-tooling` 放到最前；
 *   - 不挂 `agent/pre-step`，不调用 `suppressRuntimeContext()`。
 *
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 `@deepseek-ai/*`。
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

/**
 * 共用执行政策：安全边界、提问、成本与用户协作。
 *
 * 四个预设各自保存一份同语义正文，文件层面互不依赖；本包使用英文版本，
 * 与中文预设的中文版本保持一致。
 */
export const EXECUTION_POLICY = `Execution policy:
Decide whether to act based only on reversibility and scope: reversible work within the current request (reading files, editing code, running tests, cleaning up temporary files you created in this task) is authorized—do it directly. Ask the user before irreversible operations or work outside the request (deleting or overwriting user data, rewriting git history, changing global configuration or credentials, installing dependencies, or touching content outside the workspace).

The user is patient and will not be annoyed by questions that materially affect the work; if uncertainty would affect the approach, result, or acceptance, ask directly instead of guessing or silently second-guessing.

Do not sacrifice correctness to save tokens; context is compacted automatically after milestones, so focus on delivering efficiently and with quality. Quality means locating the root cause, making the smallest correct change, and verifying it—not a surface-level patch chosen to avoid work.

The user is your collaborator: during development, when a feature is still incomplete, when real-environment or human verification is needed, or when you genuinely lack reference material, tools, or runtime access, ask the user directly for testing, feedback, or support. Verify locally first when you can; never pretend you verified something, and do not silently carry the problem alone.`

/**
 * 把每次组装出来的 sections 收敛成那一句 persona，并把共用执行政策与工具说明搬到第一个 context。
 *
 * 幂等：sections 每次都是新的一段；context 先按名字剔除再放到数组最前。若输入里没有 PTC 段
 * （例如 presentation 没装上，或重复拿已处理过的 assembly 再跑一次），保留已有的
 * `yinyu:ptc-tooling`，并仍然保证它在 contexts 的第一个位置。
 * @param ctx - 预设 scope 的 context。
 */
export function apply(ctx) {
	ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
		const assembled = await next()
		if (assembled === null || typeof assembled !== 'object') return assembled
		const sections = Array.isArray(assembled.sections) ? assembled.sections : []
		const contexts = Array.isArray(assembled.contexts) ? assembled.contexts : []
		const readText = (name) => {
			const section = sections.find((candidate) => candidate?.name === name)
			return typeof section?.text === 'string' ? section.text : ''
		}
		const tooling = [EXECUTION_POLICY, readText(PTC_ONLY_SECTION), readText(SDK_SECTION)]
			.filter((text) => text.length > 0)
			.join('\n\n')
		const previous = contexts.find((context) => context?.name === TOOLING_CONTEXT)
		const others = contexts.filter((context) => context?.name !== TOOLING_CONTEXT)
		const nextContexts = tooling.length > 0
			? [{ name: TOOLING_CONTEXT, text: tooling, interpolate: false }, ...others]
			: previous === undefined ? others : [previous, ...others]
		return {
			...assembled,
			sections: [{ name: PROMPT_SECTION, text: PROMPT_TEXT, interpolate: false }],
			contexts: nextContexts,
		}
	}, { prepend: true })
}
