import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { Config } from './agent-preset.mjs'
import { PRESET_DEFAULTS, getPresetState, setPresetState } from './preset-state.mjs'
import { apply as applyYayan } from './yayan-zh.mjs'
import { apply as applyCangjie } from './cangjie-zh.mjs'
import { apply as applyMaliang } from './maliang-zh.mjs'
import { apply as applyHideHarnessSource } from './hide-harness-source.mjs'

const ROOT = new URL('../', import.meta.url)
const read = path => fs.readFile(new URL(path, ROOT), 'utf8')
let checkCount = 0
const ok = (condition, message) => {
	checkCount += 1
	assert.ok(condition, message)
	console.log('✓ ' + message)
}
const equal = (actual, expected, message) => {
	checkCount += 1
	assert.deepEqual(actual, expected, message)
	console.log('✓ ' + message)
}

/** 收集一个预设块，避免多个组合里的同名行互相掩盖。 */
function block(text, start, end) {
	const from = text.indexOf(start)
	assert.notEqual(from, -1, 'missing block start ' + start)
	const to = end === undefined ? text.length : text.indexOf(end, from + start.length)
	assert.notEqual(to, -1, 'missing block end ' + end)
	return text.slice(from, to)
}

/** 只注册监听器的极简 Cordis 宿主。 */
function harness() {
	const handlers = new Map()
	const ctx = {
		on(name, handler) { handlers.set(name, handler) },
		effect(effect) { const dispose = effect(); return typeof dispose === 'function' ? dispose : () => {} },
		logger: { warn() {} },
	}
	return { ctx, handlers }
}

const BASE_ASSEMBLY = {
	sections: [
		{ name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' },
		{ name: 'deployment:persona-prefix', text: 'You are a coding agent powered by the {{model}} model.' },
	],
	contexts: [],
	tools: [],
	variables: {},
}

/**
 * 带装配层的宿主：瀑布之后用 tool provider 的原始 schema 覆盖 tools。
 *
 * α 0.2.2 起 SystemPrompt.assemble 就是这么返回的（`{ ...transformed, tools }`），
 * 瀑布里翻好的工具描述会被丢掉；rc 0.2.1 直接返回瀑布结果。两种行为都要过测试。
 */
function assemblingHarness(rawTools) {
	const { ctx, handlers } = harness()
	const service = {
		async assemble() {
			const collected = rawTools.map(tool => ({ ...tool }))
			const assembly = { ...BASE_ASSEMBLY, tools: collected }
			const waterfall = handlers.get('system-prompt/assemble')
			const transformed = waterfall === undefined ? assembly : await waterfall(assembly, {}, async () => assembly)
			// α 的行为：瀑布结果展开在前，组装期的 tools 写在后面覆盖
			return { ...transformed, tools: collected }
		},
	}
	ctx.systemPrompt = service
	return { ctx, handlers, service }
}

// 包与组合
const manifest = JSON.parse(await read('package.json'))
ok(manifest.name === '@alm-allen/dsh-agent-preset', '包名固定为 @alm-allen/dsh-agent-preset')
const zhLocale = JSON.parse(await read('locale/zh.json'))
const enLocale = JSON.parse(await read('locale/en.json'))
equal(zhLocale.meta?.title, '智能体预设', '插件管理页中文显示名为智能体预设')
equal(enLocale.meta?.title, 'Agent Presets', '插件管理页英文显示名为 Agent Presets')
ok(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle patch 指向 cordis.patch.yml')
ok(manifest.dsh?.client?.platform === 'web', '客户端半区声明为 web')
for (const [key, value] of Object.entries(manifest.exports ?? {})) {
	if (key.includes('*')) continue
	const file = typeof value === 'string' ? value : value.default
	ok(file && await fs.stat(new URL(file, ROOT)).then(() => true, () => false), 'export ' + key + ' 指向存在的文件')
}

const patch = await read('cordis.patch.yml')
const controller = block(patch, '- id: agent-preset', '- id: preset-standard')
ok((controller.match(/- id: agent-preset/g) ?? []).length === 1, '只有一个 agent-preset 控制行')
const standard = block(patch, '- id: preset-standard', '- id: preset-ptc')
const ptc = block(patch, '- id: preset-ptc', '- id: preset-cordis')
const cordis = block(patch, '- id: preset-cordis')
ok(standard.includes('prefix: You are a coding agent powered by the {{model}} model.'), '雅言保留原生 persona')
ok(standard.includes('@alm-allen/dsh-agent-preset/yayan-zh'), '雅言挂载包内汉化层')
ok(!standard.includes('prefix: ""'), '雅言不再把 persona 静态置空')
ok(ptc.includes('@alm-allen/dsh-agent-preset/cangjie-zh'), '仓颉挂载包内汉化层')
ok(cordis.includes('@alm-allen/dsh-agent-preset/maliang-zh'), '马良挂载包内汉化层')
for (const [label, section] of [['雅言', standard], ['仓颉', ptc], ['马良', cordis]]) {
	equal((section.match(/name: '@alm-allen\/dsh-agent-preset\/hide-harness-source'/g) ?? []).length, 1, label + '挂载检出目录遮蔽行')
}

// 预设行逐行重述 0.2.2-rc.1 的 shipped 文件
for (const [label, section] of [['雅言', standard], ['仓颉', ptc], ['马良', cordis]]) {
	ok(!section.includes('list-agents'), label + '不再挂 list_agents 垫片行（主包已注册该工具）')
	ok(section.includes('modelSelection: true') && section.includes('modelDiscovery: true') && !section.includes('modelSelectionSettings'), label + '只写当前版本的模型选择键')
	ok(section.includes('applyPatch: false'), label + '显式关闭 apply_patch 工具')
}
ok(ptc.includes("name: '@deepseek-ai/dsh-tool-executor-ptc'") && !ptc.includes('dsh-agent-tool-presentation'), '仓颉用 PTC 执行器而不是旧的呈现转发层')
ok(standard.includes("disabled: !!js \"!ctx.get('profileContext')\"") && !standard.includes('id: tool-plugin-manager\n        name: \'@deepseek-ai/dsh-plugin-manager/tools\'\n        disabled: true'), '雅言的插件管理工具跟随 shipped 的 profileContext 开关')

// 默认值
equal(PRESET_DEFAULTS, { yayan: false, cangjie: false, maliang: false }, '进程内默认值符合要求')
equal(getPresetState(), PRESET_DEFAULTS, '进程内镜像初始值正确')
for (const key of ['yayan', 'cangjie', 'maliang']) {
	equal(Config.dict[key].meta.default, false, key + ' Host 默认关闭')
	equal(Config.dict[key].meta.volatile, true, key + ' 是 volatile 字段')
}
const client = await read('plugins/client.js')
const fallbacks = [...client.matchAll(/fallback: (true|false)/g)].map(match => match[1])
equal(fallbacks.sort(), ['false', 'false', 'false'], '客户端三个默认值与 Host 一致')

// 三个汉化层的关闭直通 / 开启替换
for (const [key, apply, batchName] of [
	['yayan', applyYayan, undefined],
	['cangjie', applyCangjie, 'cangjie:batch-calls'],
	['maliang', applyMaliang, undefined],
]) {
	setPresetState({ yayan: false, cangjie: false, maliang: false })
	const { ctx, handlers } = harness()
	apply(ctx)
	const assemble = handlers.get('system-prompt/assemble')
	const preStep = handlers.get('agent/pre-step')
	assert.equal(typeof assemble, 'function', key + ' 注册 assemble')
	assert.equal(typeof preStep, 'function', key + ' 注册 pre-step')
	const untouched = await assemble({}, {}, async () => BASE_ASSEMBLY)
	ok(untouched === BASE_ASSEMBLY, key + ' 关闭时原样直通')
	const untouchedStep = { kind: 'continue', messages: [] }
	const stepResult = await preStep({}, async () => untouchedStep)
	ok(stepResult === untouchedStep, key + ' 关闭时 pre-step 原样直通')

	setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
	const translated = await assemble({}, {}, async () => BASE_ASSEMBLY)
	const identity = translated.sections.find(section => section.name === 'harness:identity')
	const persona = translated.sections.find(section => section.name === 'deployment:persona-prefix')
	ok(identity?.text.includes('你是由 DeepSeek Harness 驱动的 AI Agent') && identity?.interpolate === false, key + ' 打开时写入中文身份段')
	ok(identity?.text.includes('回答的表达风格'), key + ' 身份段带表达风格')
	ok(persona?.text === '', key + ' 打开时清空原生 persona')
	if (batchName === undefined) {
		ok(!translated.sections.some(section => section.name === batchName), key + ' 不追加多余的批处理段')
	} else {
		ok(translated.sections.at(-1)?.name === batchName, key + ' 在末尾追加批处理段')
	}
}

// PTC 的 tools:sdk：工具描述走 DOCS，按渲染侧折叠后的单行文本查表
{
	setPresetState({ yayan: false, cangjie: true, maliang: false })
	const { ctx, handlers } = harness()
	applyCangjie(ctx)
	const assemble = handlers.get('system-prompt/assemble')
	const PRESENT_DOC = 'Declare existing files as final deliverables for the user. Hosts may show presented files only after your turn ends, so call it once the files are final. If the user needs to review files earlier, such as before a tool call that waits for their answer, link them in your message instead. Use it when the user needs a separate file, especially Office documents, spreadsheets, and slide decks; prefer your final response when that suffices. The user opens the current files; their contents are not copied.'
	const sdk = await assemble({}, {}, async () => ({
		sections: [{ name: 'tools:sdk', text: `/** ${PRESENT_DOC} */` }],
		contexts: [],
		tools: [],
		variables: {},
	}))
	const sdkSection = sdk.sections.find(section => section.name === 'tools:sdk')
	ok(sdkSection?.text.includes('把已存在的文件声明为'), '仓颉翻译 PTC 里 present 的新措辞')
	const wrapped = await assemble({}, {}, async () => ({
		sections: [{ name: 'tools:sdk', text: '/** Submitted answer batch with one item per question.\n   A skipped question has empty selected and no custom; unlike pending, the user has completed the batch. */' }],
		contexts: [],
		tools: [],
		variables: {},
	}))
	const wrappedSection = wrapped.sections.find(section => section.name === 'tools:sdk')
	ok(wrappedSection?.text.includes('已提交的答案批'), '渲染侧把描述折叠成单行后仍能命中带换行的键')
}

// 工具描述必须穿过装配层：α 会用 tool provider 的原始 schema 覆盖瀑布里的 tools
// 只有雅言与马良走原生 schema；仓颉的工具描述在 tools:sdk 段里，本来就过瀑布
{
	const READ_TOOL_EN = 'Read a UTF-8 text file and return line-numbered content.'
	const readTool = () => [{ name: 'read', description: READ_TOOL_EN, parameters: { type: 'object', properties: {} } }]
	for (const [key, apply] of [['yayan', applyYayan], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, service } = assemblingHarness(readTool())
		apply(ctx)
		const assembled = await service.assemble()
		ok(/[\u4e00-\u9fff]/.test(assembled.tools[0].description), key + ' 的工具描述穿过装配层仍然汉化')
		ok(assembled.tools[0].parameters.type === 'object', key + ' 只改文本，工具结构原样')
	}
	setPresetState({ yayan: true, cangjie: false, maliang: false })
	const { ctx, service } = assemblingHarness(readTool())
	applyYayan(ctx)
	setPresetState({ yayan: false, cangjie: false, maliang: false })
	const closed = await service.assemble()
	ok(closed.tools[0].description === READ_TOOL_EN, '开关关闭时装配层返回原样工具描述')
}

// 只遮蔽检出目录那一条：其余运行时上下文照常注入
{
	const { ctx } = harness()
	const registered = []
	ctx.systemPrompt = {
		getContextOrder: () => 200,
		context: entry => { registered.push(entry) },
	}
	applyHideHarnessSource(ctx)
	equal(registered.map(entry => entry.name), ['harness:source'], '只注册一条遮蔽条目')
	const shadow = registered[0]
	ok(shadow.required === true && shadow.text === '' && shadow.interpolate === false && shadow.order === 200, '遮蔽条目为空文本、required、沿用宿主排序')
	const source = await read('plugins/hide-harness-source.mjs')
	ok(!source.includes("'agent/pre-step'") && !source.includes('system-prompt/assemble'), '不改组装结果，也不碰消息注入')
}

// 系统提示词恒定性：工作目录与提示词变量不能渗进 sections
{
	// 注入一条哨兵路径：它只该出现在 contexts 里，不能出现在 sections
	const LEAKY = {
		sections: [
			{ name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness. Your working directory is Z:\\sentinel-leak-path\\project.' },
			{ name: 'deployment:persona-prefix', text: 'You are a coding agent powered by the {{model}} model. Your working directory is Z:\\sentinel-leak-path\\project.' },
			{ name: 'tool:read', text: 'Use the read tool — not shell commands like cat — to inspect text files.' },
		],
		contexts: [{ name: 'working-directory:current', text: 'Current working directory: "Z:\\\\sentinel-leak-path\\\\project".' }],
		tools: [],
		variables: { model: 'a-model', provider: 'a-provider' },
	}
	const LEAK = /sentinel-leak-path|\{\{/
	setPresetState({ yayan: true, cangjie: true, maliang: true })
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => LEAKY)
		const leaked = assembled.sections.filter(section => LEAK.test(section.text ?? '')).map(section => section.name)
		equal(leaked, [], key + ' 的系统提示词不含路径与提示词变量')
		ok(assembled.contexts.some(context => context.name === 'working-directory:current'), key + ' 工作目录仍留在运行时上下文里')
	}
}

// contexts 每步按注册表重建：翻译必须穿过 refreshContext，否则身份段变回英文
{
	const TEAM_IDENTITY_EN = 'You are the Team Lead named "lead".\nUse list_agents({}) to find your teammates and their names.\nTo message another teammate, use send_message({ target: "<teammate name>", message: "..." }).'
	/** 带 refreshContext 的服务：模拟 dsh 每个 step 用注册表原文重建 contexts。 */
	const refreshingHarness = () => {
		const { ctx, handlers } = harness()
		const raw = () => [{ name: 'team:identity', text: TEAM_IDENTITY_EN }, { name: 'working-directory:current', text: 'Current working directory: "E:\\work".' }]
		const service = {
			async assemble() {
				const assembly = { ...BASE_ASSEMBLY, contexts: raw() }
				const waterfall = handlers.get('system-prompt/assemble')
				return waterfall === undefined ? assembly : await waterfall(assembly, {}, async () => assembly)
			},
			refreshContext(assembly) {
				return { ...assembly, contexts: raw() }
			},
		}
		ctx.systemPrompt = service
		return { ctx, handlers, service }
	}
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, service } = refreshingHarness()
		apply(ctx)
		const assembled = await service.assemble()
		const refreshed = service.refreshContext(assembled)
		const identity = refreshed.contexts.find(entry => entry.name === 'team:identity')
		ok(/[\u4e00-\u9fff]/.test(identity?.text ?? ''), key + ' 的 context 翻译穿过 refreshContext')
		ok(refreshed.contexts.some(entry => entry.name === 'working-directory:current'), key + ' 不增删 context，只改文本')
		// 两阶段必须是同一份文本：不同就会让运行时上下文快照每步重发
		const assembledIdentity = assembled.contexts.find(entry => entry.name === 'team:identity')
		ok(assembledIdentity.text === identity.text, key + ' 的 assemble 与 refreshContext 文本逐字一致')
	}
	// 开关关闭时必须逐字节回到宿主行为
	setPresetState({ yayan: false, cangjie: false, maliang: false })
	const { ctx, service } = refreshingHarness()
	applyYayan(ctx)
	const passthrough = service.refreshContext({ sections: [], contexts: [], tools: [], variables: {} })
	ok(passthrough.contexts[0].text === TEAM_IDENTITY_EN, '开关关闭时 refreshContext 原样返回')
	// 三层共用同一个包装，卸到最后一层才还原
	setPresetState({ yayan: true, cangjie: true, maliang: true })
	const shared = refreshingHarness()
	applyYayan(shared.ctx)
	const wrappedOnce = shared.service.refreshContext
	applyCangjie(shared.ctx)
	applyMaliang(shared.ctx)
	ok(shared.service.refreshContext === wrappedOnce, '三层共用同一个 refreshContext 包装')
	ok(Object.hasOwn(shared.service, 'refreshContext'), '包装是自有属性，卸载时能整个删掉')
	// 卸载到最后一层必须还原，否则关掉开关后 context 还是会被包着
	const disposers = []
	const unloading = refreshingHarness()
	const original = unloading.service.refreshContext
	const ctx2 = { ...unloading.ctx, effect: effect => { const dispose = effect(); if (typeof dispose === 'function') disposers.push(dispose); return () => {} } }
	applyYayan(ctx2)
	ok(unloading.service.refreshContext !== original, '启用时包上 refreshContext')
	for (const dispose of disposers.splice(0)) dispose()
	ok(unloading.service.refreshContext === original, '关闭后 refreshContext 还原成原方法')
}

// plan mode 不在 YAML 里静态汉化，而由开关打开时的翻译层负责
for (const file of ['yayan-zh.mjs', 'cangjie-zh.mjs', 'maliang-zh.mjs']) {
	const source = await read('plugins/' + file)
	ok(source.includes('const PLAN_MODE_EN = ') && source.includes('const PLAN_MODE_ZH = '), file + ' 带 plan mode 表')
}
const commonSource = await read('plugins/zh-common.mjs')
ok(commonSource.includes('entry.text === planMode.en'), '公共层按原文精确匹配 plan mode 段')
ok(commonSource.includes('ctx.on(\'agent/pre-step\''), '公共层注册 agent/pre-step')
ok(commonSource.includes('isPresetEnabled(presetKey)'), '公共层按预设开关直通')

// 客户端 bundle 协议
{
	let registered
	const sandbox = { window: { __ModuleLoader__: { load(value) { registered = value } } } }
	vm.runInNewContext(client, sandbox, { filename: 'plugins/client.js' })
	ok(registered?.id === '@alm-allen/dsh-agent-preset', '客户端 bundle 用包名注册')
	const exports = registered.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? { Switch() {} } : {})
	equal([...exports.inject], ['slots', 'configForms'], '客户端注入 slots 与 configForms')
	ok(typeof exports.apply === 'function', '客户端导出 apply')
}

console.log('\n全部通过（' + checkCount + ' 项）')
