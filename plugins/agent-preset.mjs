import z from '@deepseek-ai/schemastery'
import { PRESET_DEFAULTS, PRESET_KEYS, setPresetState } from './preset-state.mjs'

/** Cordis 插件名；同时是 profile 里的条目 id 与设置表单命名空间。 */
export const name = 'agent-preset'

/** 需要 Loader 来启停新增的 preset-yinyu 条目。 */
export const inject = ['loader']

/** 预设条目的 Loader id。 */
const YINYU_ENTRY = 'preset-yinyu'
const MINIMAL_ENTRY = 'preset-minimal'
const CHAT_ENTRY = 'preset-chat'

/**
 * 插件管理页上的五个开关。
 *
 * 四个原生预设替代（雅言/仓颉/马良/chat）默认关闭；引玉（非原生、新增）默认开启。
 * 字段必须保持 volatile：Loader 才会在设置写入后原地更新运行中的引用并通知本插件，
 * 无需重载整个 bundle。
 */
export const Config = z.object({
	yayan: z.boolean().default(PRESET_DEFAULTS.yayan).volatile(),
	cangjie: z.boolean().default(PRESET_DEFAULTS.cangjie).volatile(),
	maliang: z.boolean().default(PRESET_DEFAULTS.maliang).volatile(),
	chat: z.boolean().default(PRESET_DEFAULTS.chat).volatile(),
	yinyu: z.boolean().default(PRESET_DEFAULTS.yinyu).volatile(),
})

/** 读取一个 volatile 字段；Cordis 直接挂载测试时也接受普通布尔值。 */
function readFlag(config, key) {
	const value = config?.[key]
	return (value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value) === true
}

/** 当前配置的纯值快照。 */
function snapshot(config) {
	return Object.fromEntries(PRESET_KEYS.map(key => [key, readFlag(config, key)]))
}

/** 等 20 ms，给同一次组合里的预设行留出创建时间 */
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

/** 等一个条目真正停稳，避免同一个 config.id 在切换时短暂重复。 */
async function settle(entry) {
	const fiber = entry.fiber
	await entry.update({ disabled: true })
	// update 对运行中的条目已经 dispose 过；这里补等一次让异步清理跑完，重复调用失败不影响结果
	try {
		await fiber?.dispose?.()
	} catch {
		// 已经停掉
	}
	await tick()
}

/**
 * 按行 id 找一条预设行。
 *
 * profile 的条目挂在 include 子组下面，根 `loader.resolve(id)` 只会抛
 * `cannot resolve entry <id>`；必须遍历 `loader.entries()` 并按 options.id 匹配。
 * 极简的测试 loader 只提供 resolve，所以保留那一条退路。
 */
function findEntry(ctx, id) {
	const loader = ctx.loader
	if (loader !== undefined && typeof loader.entries === 'function') {
		for (const entry of loader.entries()) {
			if (entry.options?.id === id) return entry
		}
	}
	try {
		return loader?.resolve?.(id)
	} catch {
		return undefined
	}
}

/** 找一条预设行；同一次组合里可能稍晚才创建，因此短暂重试。 */
async function resolveEntry(ctx, id) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const entry = findEntry(ctx, id)
		if (entry !== undefined) return entry
		await tick()
	}
	return undefined
}

/**
 * Chat 用“换人”而不是覆盖：原生 minimal 与 preset-chat 使用同一个 config.id，
 * 同一时刻只能有一个注册。开启时先停原生再启用 Chat，关闭时反过来。
 *
 * 两种异常状态要分别处理：插件管理页的条目开关会把 "- id: preset-chat" 直接写进 profile，
 * 那种外部启用会让两条行同时注册（Duplicate agent preset: minimal），所以这时先把 Chat
 * 摘掉再按顺序装回；已经切换好的状态则一律不动，否则每次同步都会重启 Chat 会话。
 * 见 文档/机制/Chat-零注入.md。
 */
async function syncChat(ctx, enabled) {
	const minimal = await resolveEntry(ctx, MINIMAL_ENTRY)
	const chat = await resolveEntry(ctx, CHAT_ENTRY)
	if (minimal === undefined || chat === undefined) {
		ctx.logger?.warn?.('agent-preset: preset-minimal or preset-chat entry was not found; chat switch left pending')
		return
	}
	if (enabled) {
		if (!chat.disabled && !minimal.disabled) await settle(chat)
		if (!minimal.disabled) await settle(minimal)
		if (chat.disabled) await chat.update({ disabled: false })
	} else {
		if (!chat.disabled) await settle(chat)
		if (minimal.disabled) await minimal.update({ disabled: false })
	}
}

/**
 * 把引玉条目切换到期望的启用状态。直接更新 Loader 条目而不写 profile：
 * 持久化的是 agent-preset 的配置，启动时再由这里重新落到条目上。
 */
async function syncYinyu(ctx, enabled) {
	const entry = await resolveEntry(ctx, YINYU_ENTRY)
	if (entry === undefined) {
		ctx.logger?.warn?.('agent-preset: preset-yinyu entry was not found; yinyu switch left pending')
		return
	}
	const disabled = !enabled
	if (entry.disabled !== disabled) await entry.update({ disabled })
}

/** 主插件：同步五个开关。汉化层从 preset-state 读取，Chat 与引玉条目在这里启停 */
export function apply(ctx, config) {
	let active = true
	let syncQueue = Promise.resolve()

	const publish = () => {
		const flags = snapshot(config)
		setPresetState(flags)
		return flags
	}

	const sync = () => {
		const flags = publish()
		syncQueue = syncQueue
			.then(async () => {
				if (!active) return
				await syncChat(ctx, flags.chat)
				if (active) await syncYinyu(ctx, flags.yinyu)
			})
			.catch(error => ctx.logger?.warn?.('agent-preset: failed to synchronize preset switch', error))
	}

	ctx.on('loader/volatile-update', sync)
	// 启动收尾会重载一次 profile：条目的 disabled 按 patch 重新解析，运行时的启停被冲回初始值，
	// 而这次重载不会重新 apply 本插件。所以监听条目停用并在防抖后补一次同步。
	let resyncTimer
	const scheduleResync = () => {
		clearTimeout(resyncTimer)
		resyncTimer = setTimeout(() => {
			if (active) sync()
		}, 800)
	}
	ctx.on('loader/partial-dispose', scheduleResync)
	ctx.effect(() => () => clearTimeout(resyncTimer), 'agent-preset: cancel pending resync')
	ctx.effect(() => {
		sync()
		return () => {
			active = false
		}
	}, 'agent-preset: publish switches')
}

export { PRESET_DEFAULTS, PRESET_KEYS }
