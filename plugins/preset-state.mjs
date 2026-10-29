/**
 * 三个预设开关的进程内镜像。
 *
 * 主插件 agent-preset 从宿主配置里读开关并写入这里；三个汉化层在每次组装时读它。
 * 默认值与 host Config、客户端表单三处必须一致。
 */
export const PRESET_KEYS = ['yayan', 'cangjie', 'maliang']

/** 三份汉化层默认关闭，预设保持原生出货内容。 */
export const PRESET_DEFAULTS = Object.freeze({
	yayan: false,
	cangjie: false,
	maliang: false,
})

const state = { ...PRESET_DEFAULTS }

/** 用已校验的开关值覆盖进程内镜像。 */
export function setPresetState(next) {
	for (const key of PRESET_KEYS) {
		state[key] = next?.[key] === true
	}
	return getPresetState()
}

/** 当前某预设的汉化状态。 */
export function isPresetEnabled(key) {
	return state[key] === true
}

/** 当前三个开关的只读快照。 */
export function getPresetState() {
	return { ...state }
}
