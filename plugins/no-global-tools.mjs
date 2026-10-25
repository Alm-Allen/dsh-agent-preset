/**
 * chat-no-global-tools：把**继承来的**工具从本预设的 agent 视野里整体摘掉。
 *
 * 背景：预设本身一行 tool-* 都不挂，所以预设这一层没有任何工具注册——这是
 * "零工具"的一半。另一半在宿主侧：宿主行或第三方 bundle 会把工具注册进
 * **全局层**，而全局工具默认对每个 agent scope 可见。预设不声明就摘不掉，
 * 纯对话模式会平白多出一整套可调用工具。
 *
 * 做法：在 preset 自己的 standing scope（覆盖所有加入本预设的 agent）上声明
 * `tools.restrict({ allow: [] })`。`restrict` 过滤的是"本 scope **继承到**的
 * 东西"——全局层加上祖先 scope 链上的每一层——`allow` 取空集正是"继承面全部
 * 不可见"的精确表达，而且：
 *   - 与工具名字无关：不需要在挂载时刻枚举全局工具；
 *   - 与注册时刻无关：宿主稍后才异步注册的工具同样被挡住；
 *   - 不碰本 scope 自己注册的工具：`restrict` 从不约束 own layer，所以以后想在
 *     这个预设里挂工具行也不会被误伤。
 *
 * 为什么不能用"快照 + deny 名单"（本文件的上一版就是这么写的）：
 *   preset 的行在 `tools` 服务一出现就激活，而提供方可能 `await import(...)`
 *   并等原生 SDK 列出工具之后才 `register()`。两者是竞态：快照几乎总是早于工具
 *   注册，于是 `deny` 为空、一条限制都不设，之后注册的全局工具全部漏进对话模式。
 *   声明式空 `allow` 没有这个时间窗口。
 *
 * 零外部 import：预设里的行从 profile 目录解析，那里没有 `@deepseek-ai/*`。
 * 本文件同时是包的入口（见 package.json 的 `exports`）。
 */

/** Cordis 插件名，用于 loader 诊断。 */
export const name = 'chat-no-global-tools'

/** 工具注册表是硬依赖：没有它就无法声明这个限制。 */
export const inject = ['tools']

/** 在调用者 scope 上屏蔽一切继承来的工具（全局层 + 祖先层）。 */
export function apply(ctx) {
	ctx.effect(() => ctx.tools.restrict({ allow: [] }))
}
