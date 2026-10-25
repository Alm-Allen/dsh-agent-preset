/**
 * chat-no-global-tools：把继承来的工具从本预设的 agent 视野里整体摘掉。
 *
 * 声明式空 allow 没有时间窗口：restrict 过滤的是本 scope 继承到的工具，与工具名和注册时刻无关。
 * 为什么不按快照加 deny 名单、为什么还要第二道 zero-injection，见 文档/机制/Chat-零注入.md。
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 @deepseek-ai/*。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'chat-no-global-tools'

/** 工具注册表是硬依赖：没有它就无法声明这个限制。 */
export const inject = ['tools']

/** 在调用者 scope 上屏蔽一切继承来的工具（全局层 + 祖先层）。 */
export function apply(ctx) {
	ctx.effect(() => ctx.tools.restrict({ allow: [] }))
}
