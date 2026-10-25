import z from '@deepseek-ai/schemastery'
import { PRESET_DEFAULTS, PRESET_KEYS, setPresetState } from './preset-state.mjs'

/** Cordis 插件名；同时是 profile 里的条目 id 与设置表单命名空间。 */
export const name = 'preset-pack'

/** 需要 Loader 来启停新增的 preset-yinyu 条目。 */
export const inject = ['loader']

/** 预设条目的 Loader id。 */
const YINYU_ENTRY = 'preset-yinyu'

/**
 * 插件管理页上的四个开关。
 *
 * 三个原生预设汉化默认关闭；引玉（非原生、新增）默认开启。字段必须保持 volatile：
 * Loader 才会在设置写入后原地更新运行中的引用并通知本插件，无需重载整个 bundle。
 */
export const Config = z.object({
	yayan: z.boolean().default(PRESET_DEFAULTS.yayan).volatile(),
	cangjie: z.boolean().default(PRESET_DEFAULTS.cangjie).volatile(),
	maliang: z.boolean().default(PRESET_DEFAULTS.maliang).volatile(),
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

/** 等一帧，给同一次组合里的 preset-yinyu 条目留出创建时间。 */
const tick = () => new Promise(resolve => setTimeout(resolve, 20))

/**
 * 把引玉条目切换到期望的启用状态。直接更新 Loader 条目而不写 profile：
 * 持久化的是 preset-pack 的配置，启动时再由这里重新落到条目上。
 */
async function syncYinyu(ctx, enabled) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		let entry
		try {
			entry = ctx.loader.resolve(YINYU_ENTRY)
		} catch {
			await tick()
			continue
		}
		const disabled = !enabled
		if (entry.disabled !== disabled) await entry.update({ disabled })
		return
	}
	ctx.logger?.warn?.('preset-pack: preset-yinyu entry was not found; yinyu switch left pending')
}

/**
 * 主插件：同步四个开关。三个汉化层从 preset-state 读取；引玉条目在这里启停。
 * @param ctx - 当前 bundle 行的 Context。
 * @param config - 带 volatile 引用的配置。
 */
export function apply(ctx, config) {
	let active = true
	let queue = Promise.resolve()

	const publish = () => {
		const flags = snapshot(config)
		setPresetState(flags)
		return flags
	}

	const sync = () => {
		const flags = publish()
		queue = queue
			.then(() => active ? syncYinyu(ctx, flags.yinyu) : undefined)
			.catch(error => ctx.logger?.warn?.('preset-pack: failed to synchronize preset-yinyu', error))
	}

	ctx.on('loader/volatile-update', sync)
	ctx.effect(() => {
		sync()
		return () => {
			active = false
		}
	}, 'preset-pack: publish switches')
}

export { PRESET_DEFAULTS, PRESET_KEYS }
