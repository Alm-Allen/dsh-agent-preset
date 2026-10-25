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
	await fiber?.dispose?.()
	await tick()
}

/** 找一条预设行；同一次组合里可能稍晚才创建，因此短暂重试。 */
async function resolveEntry(ctx, id) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		try {
			return ctx.loader.resolve(id)
		} catch {
			// 行还没创建，下一帧再试
			await tick()
		}
	}
	return undefined
}

/**
 * Chat 用“换人”而不是覆盖：原生 minimal 与 preset-chat 使用同一个 config.id，
 * 同一时刻只能有一个注册。开启时先停原生再启用 Chat，关闭时反过来。
 */
async function syncChat(ctx, enabled) {
	const minimal = await resolveEntry(ctx, MINIMAL_ENTRY)
	const chat = await resolveEntry(ctx, CHAT_ENTRY)
	if (minimal === undefined || chat === undefined) {
		ctx.logger?.warn?.('agent-preset: preset-minimal or preset-chat entry was not found; chat switch left pending')
		return
	}
	if (enabled) {
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
	ctx.effect(() => {
		sync()
		return () => {
			active = false
		}
	}, 'agent-preset: publish switches')
}

export { PRESET_DEFAULTS, PRESET_KEYS }
