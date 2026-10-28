/**
 * list_agents 的版本垫片：rc 把它放在 @deepseek-ai/dsh-tool-subagent-control/list-agents 子包，
 * α（0.2.2）把工具并进主包并删掉了这个子路径导出。
 *
 * 子包还在就原样转挂，子包没了就什么都不做；同一份 cordis.patch.yml 因此在两版上都不会缺行或炸行。
 * 两版差异与判定依据见 文档/机制/双版本兼容.md。
 */

/** Cordis 插件名，与 rc 子包同名，loader 诊断看起来与原生一致。 */
export const name = 'tool-subagent-list-agents'

/** 子包不存在不是错误：α 的主包已经注册了同名工具。 */
const MISSING = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'])

/** 转发 rc 的独立工具；α 下静默退让。 */
export async function apply(ctx) {
	let subagentTools
	try {
		subagentTools = await import('@deepseek-ai/dsh-tool-subagent-control/list-agents')
	} catch (error) {
		if (MISSING.has(error?.code)) return
		throw error
	}
	ctx.plugin(subagentTools)
}
