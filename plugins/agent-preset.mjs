import z from '@deepseek-ai/schemastery'
import { PRESET_DEFAULTS, PRESET_KEYS, setPresetState } from './preset-state.mjs'

/** Cordis 插件名；同时是 profile 里的条目 id 与设置表单命名空间。 */
export const name = 'agent-preset'

/**
 * 插件管理页上的三个开关。
 *
 * 三份汉化层默认关闭，关闭时预设保持原生出货内容。
 * 字段必须保持 volatile：Loader 才会在设置写入后原地更新运行中的引用并通知本插件，
 * 无需重载整个 bundle。
 */
export const Config = z.object({
	yayan: z.boolean().default(PRESET_DEFAULTS.yayan).volatile(),
	cangjie: z.boolean().default(PRESET_DEFAULTS.cangjie).volatile(),
	maliang: z.boolean().default(PRESET_DEFAULTS.maliang).volatile(),
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

/** 主插件：把三个开关发布到进程内镜像，汉化层在每次组装时读它。 */
export function apply(ctx, config) {
	let active = true

	const publish = () => {
		const flags = snapshot(config)
		setPresetState(flags)
		return flags
	}

	const sync = () => {
		if (!active) return
		publish()
	}

	ctx.on('loader/volatile-update', sync)
	// 启动收尾会重载一次 profile，运行时的发布值被冲回初始值，而这次重载不会重新 apply 本插件。
	// 所以监听条目停用并在防抖后重发一次。
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
