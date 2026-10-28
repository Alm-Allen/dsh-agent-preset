import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { Config, apply as applyPack } from './agent-preset.mjs'
import { PRESET_DEFAULTS, getPresetState, setPresetState } from './preset-state.mjs'
import { apply as applyYayan } from './yayan-zh.mjs'
import { apply as applyCangjie } from './cangjie-zh.mjs'
import { apply as applyMaliang } from './maliang-zh.mjs'
import { apply as applyYinyu, PROMPT_TEXT, TOOLING_CONTEXT } from './yinyu-stage.mjs'
import { apply as applyNoGlobalTools } from './no-global-tools.mjs'
import { apply as applyZeroInjection } from './zero-injection.mjs'

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

// 包与组合
const manifest = JSON.parse(await read('package.json'))
ok(manifest.name === '@alm-allen/dsh-agent-preset', '包名固定为 @alm-allen/dsh-agent-preset')
const zhLocale = JSON.parse(await read('locale/zh.json'))
const enLocale = JSON.parse(await read('locale/en.json'))
equal(zhLocale.meta?.title, '智能体预设', '插件管理页中文显示名为智能体预设')
equal(enLocale.meta?.title, 'Agent Presets', '插件管理页英文显示名为 Agent Presets')
ok(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle patch 指向 cordis.patch.yml')
ok(manifest.peerDependencies?.['@deepseek-ai/dsh-tool-subagent-control'] !== undefined, '垫片依赖声明为 peer，linked 安装才走引擎解析')
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
const cordis = block(patch, '- id: preset-cordis', '- id: preset-yinyu')
const yinyu = block(patch, '- id: preset-yinyu', '- id: preset-chat')
const chat = block(patch, '- id: preset-chat')
ok(standard.includes('prefix: You are a coding agent powered by the {{model}} model.'), '雅言保留原生 persona')
ok(standard.includes('@alm-allen/dsh-agent-preset/yayan-zh'), '雅言挂载包内汉化层')
ok(!standard.includes('prefix: ""'), '雅言不再把 persona 静态置空')
ok(ptc.includes('@alm-allen/dsh-agent-preset/cangjie-zh'), '仓颉挂载包内汉化层')
ok(cordis.includes('@alm-allen/dsh-agent-preset/maliang-zh'), '马良挂载包内汉化层')
ok(yinyu.includes("name: '@alm-allen/dsh-agent-preset/yinyu-stage'"), '引玉挂载包内 stage')
ok(yinyu.includes('id: preset-yinyu'), '引玉仍是新增 preset 条目')
ok(chat.includes('disabled: true') && chat.includes('id: preset-chat'), 'Chat 预设条目默认停用')
ok(chat.includes('id: minimal') && chat.includes("name: 'Chat 模式'"), 'Chat 与原生 minimal 共用 config.id')
ok(chat.includes('@alm-allen/dsh-agent-preset/no-global-tools') && chat.includes('@alm-allen/dsh-agent-preset/zero-injection'), 'Chat 挂载零工具与零注入兜底')

// rc 与 α 的行差异：list_agents 走垫片，tool-subagent 共存两套模型选择键
const shimSource = await read('plugins/list-agents-shim.mjs')
ok(shimSource.includes('ERR_MODULE_NOT_FOUND') && shimSource.includes('ERR_PACKAGE_PATH_NOT_EXPORTED'), '垫片对子包缺失的两种错误都静默退让')
ok(!patch.includes("'@deepseek-ai/dsh-tool-subagent-control/list-agents'"), '不再直连 rc 的 list-agents 子包')
for (const [label, section] of [['雅言', standard], ['仓颉', ptc], ['马良', cordis], ['引玉', yinyu]]) {
	ok(section.includes("name: '@alm-allen/dsh-agent-preset/list-agents-shim'"), label + '的 list_agents 行挂版本垫片')
	ok(section.includes('modelSelectionSettings: true') && section.includes('modelSelection: true') && section.includes('modelDiscovery: true'), label + '同时写 rc 与 α 的模型选择键')
}

// 默认值
equal(PRESET_DEFAULTS, { yayan: false, cangjie: false, maliang: false, chat: false, yinyu: true }, '进程内默认值符合要求')
equal(getPresetState(), PRESET_DEFAULTS, '进程内镜像初始值正确')
for (const key of ['yayan', 'cangjie', 'maliang', 'chat']) {
	equal(Config.dict[key].meta.default, false, key + ' Host 默认关闭')
	equal(Config.dict[key].meta.volatile, true, key + ' 是 volatile 字段')
}
equal(Config.dict.yinyu.meta.default, true, '引玉 Host 默认开启')
equal(Config.dict.yinyu.meta.volatile, true, '引玉是 volatile 字段')
const client = await read('plugins/client.js')
const fallbacks = [...client.matchAll(/fallback: (true|false)/g)].map(match => match[1])
equal(fallbacks.sort(), ['false', 'false', 'false', 'false', 'true'], '客户端五个默认值与 Host 一致')

// 主插件：开关镜像、Chat 预设交换与引玉条目启停
{
	const updates = []
	const makeEntry = (id, disabled) => ({
		id,
		disabled,
		async update(options) {
			updates.push({ id, disabled: options.disabled })
			this.disabled = options.disabled === true
		},
	})
	const entries = {
		'preset-minimal': makeEntry('preset-minimal', false),
		'preset-chat': makeEntry('preset-chat', true),
		'preset-yinyu': makeEntry('preset-yinyu', false),
	}
	let volatileHandler
	const ctx = {
		loader: { resolve(id) { const entry = entries[id]; if (entry === undefined) throw new Error('missing ' + id); return entry } },
		on(name, handler) { if (name === 'loader/volatile-update') volatileHandler = handler },
		effect(effect) { const dispose = effect(); return typeof dispose === 'function' ? dispose : () => {} },
		logger: { warn() {} },
	}
	const config = { yayan: false, cangjie: false, maliang: false, chat: true, yinyu: false }
	applyPack(ctx, config)
	await new Promise(resolve => setTimeout(resolve, 140))
	const firstMinimalOff = updates.findIndex(update => update.id === 'preset-minimal' && update.disabled === true)
	const firstChatOn = updates.findIndex(update => update.id === 'preset-chat' && update.disabled === false)
	ok(firstMinimalOff >= 0 && firstChatOn > firstMinimalOff, '开启 Chat 时先停原生 minimal，再启用 Chat')
	ok(entries['preset-yinyu'].disabled === true, '引玉关闭时停用 Loader 条目')

	config.chat = false
	config.yinyu = true
	volatileHandler()
	await new Promise(resolve => setTimeout(resolve, 180))
	const lastChatOff = updates.map(update => update.id + ':' + String(update.disabled)).lastIndexOf('preset-chat:true')
	const lastMinimalOn = updates.map(update => update.id + ':' + String(update.disabled)).lastIndexOf('preset-minimal:false')
	ok(lastChatOff >= 0 && lastMinimalOn > lastChatOff, '关闭 Chat 时先停 Chat，再恢复原生 minimal')
	ok(entries['preset-yinyu'].disabled === false, '引玉重新打开时启用 Loader 条目')
	const chatSource = await read('plugins/no-global-tools.mjs')
	const zeroSource = await read('plugins/zero-injection.mjs')
	// 对象字面量里的空白不作为契约，只认 restrict 一个空 allow
	ok(/ctx\.tools\.restrict\(\{\s*allow:\s*\[\]\s*\}\)/.test(chatSource), 'Chat 的 no-global-tools 仍清空继承工具')
	ok(zeroSource.includes('tools: []') && zeroSource.includes('contexts: []'), 'Chat 的 zero-injection 仍清空组装面')
}

// Chat 被 profile 覆盖行（插件管理页的条目开关）抢先启用时，仍要先摘掉再按顺序装回。
// 这里的 loader 照真实组合来：profile 条目在 include 子组下，根 resolve 找不到，只能遍历 entries。
{
	const updates = []
	const makeEntry = (id, disabled) => ({
		id,
		options: { id },
		disabled,
		async update(options) {
			updates.push({ id, disabled: options.disabled })
			this.disabled = options.disabled === true
		},
	})
	const entries = {
		'preset-minimal': makeEntry('preset-minimal', false),
		'preset-chat': makeEntry('preset-chat', false),
		'preset-yinyu': makeEntry('preset-yinyu', true),
	}
	const all = Object.values(entries)
	const ctx = {
		loader: {
			entries() { return all },
			resolve(id) { throw new Error('cannot resolve entry ' + id) },
		},
		on() {},
		effect(effect) { const dispose = effect(); return typeof dispose === 'function' ? dispose : () => {} },
		logger: { warn() {} },
	}
	applyPack(ctx, { yayan: false, cangjie: false, maliang: false, chat: true, yinyu: false })
	await new Promise(resolve => setTimeout(resolve, 160))
	const chatOff = updates.findIndex(update => update.id === 'preset-chat' && update.disabled === true)
	const minimalOff = updates.findIndex(update => update.id === 'preset-minimal' && update.disabled === true)
	const chatOn = updates.findIndex(update => update.id === 'preset-chat' && update.disabled === false)
	ok(chatOff >= 0 && chatOff < minimalOff && chatOn > minimalOff, 'Chat 被外部启用时先摘掉，再停 minimal、再装回')
}

// 已经切换好的 Chat 不重启；启动收尾重载把状态冲回后，主插件要自己补一次同步
{
	const updates = []
	const makeEntry = (id, disabled) => ({
		id,
		options: { id },
		disabled,
		async update(options) {
			updates.push({ id, disabled: options.disabled })
			this.disabled = options.disabled === true
		},
	})
	const entries = {
		'preset-minimal': makeEntry('preset-minimal', true),
		'preset-chat': makeEntry('preset-chat', false),
		'preset-yinyu': makeEntry('preset-yinyu', true),
	}
	const all = Object.values(entries)
	const handlers = {}
	const ctx = {
		loader: {
			entries() { return all },
			resolve(id) { throw new Error('cannot resolve entry ' + id) },
		},
		on(name, handler) { (handlers[name] ??= []).push(handler) },
		effect(effect) { const dispose = effect(); return typeof dispose === 'function' ? dispose : () => {} },
		logger: { warn() {} },
	}
	applyPack(ctx, { yayan: false, cangjie: false, maliang: false, chat: true, yinyu: false })
	await new Promise(resolve => setTimeout(resolve, 160))
	ok(updates.length === 0, '已经切换好的 Chat 不会被反复重启')

	// 模拟 profile 重载：条目按 patch 重新解析回初始值，然后 Loader 广播 partial-dispose
	entries['preset-minimal'].disabled = false
	entries['preset-chat'].disabled = true
	for (const handler of handlers['loader/partial-dispose'] ?? []) handler()
	await new Promise(resolve => setTimeout(resolve, 1400))
	ok(entries['preset-minimal'].disabled === true && entries['preset-chat'].disabled === false, '条目重载后补同步 Chat 开关')
}

// Chat 的两个零注入模块仍按契约工作
{
	let restriction
	applyNoGlobalTools({
		effect(effect) { effect() },
		tools: { restrict(value) { restriction = value; return () => {} } },
	})
	equal(restriction, { allow: [] }, 'Chat no-global-tools 仍声明空 allow')

	let assemble
	let assembleOptions
	let shadowed
	applyZeroInjection({
		on(name, handler, options) {
			if (name !== 'system-prompt/assemble') return
			assemble = handler
			assembleOptions = options
		},
		systemPrompt: {
			context(entry) { shadowed = entry; return () => {} },
			getContextOrder(name) { return name === 'WORKING_DIRECTORY' ? 100 : 0 },
		},
	})
	equal(shadowed?.name, 'working-directory:current', 'Chat 遮蔽宿主的工作目录上下文')
	ok(shadowed?.required === true && shadowed?.interpolate === false && shadowed?.text === '', '遮蔽条目是 required 的空文本')
	ok(assembleOptions?.prepend === true, 'Chat 的 zero-injection 排到最外层收尾')
	const withRuntime = {
		sections: [{ name: 'keep', text: 'x' }],
		contexts: [{ name: 'required', text: 'must go' }],
		tools: [{ name: 'leak' }],
		variables: {},
	}
	const stripped = await assemble({}, {}, async () => withRuntime)
	equal(stripped.tools, [], 'Chat zero-injection 清空 tools')
	equal(stripped.contexts, [], 'Chat zero-injection 清空 contexts')
	equal(stripped.sections, withRuntime.sections, 'Chat zero-injection 保留 sections 处理权')
}

// 三个汉化层的关闭直通 / 开启替换
for (const [key, apply, batchName] of [
	['yayan', applyYayan, undefined],
	['cangjie', applyCangjie, 'cangjie:batch-calls'],
	['maliang', applyMaliang, undefined],
]) {
	setPresetState({ yayan: false, cangjie: false, maliang: false, chat: false, yinyu: true })
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

	setPresetState({ yayan: false, cangjie: false, maliang: false, chat: false, yinyu: true, [key]: true })
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
	setPresetState({ yayan: false, cangjie: true, maliang: false, chat: false, yinyu: true })
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
	setPresetState({ yayan: true, cangjie: true, maliang: true, chat: false, yinyu: true })
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang], ['yinyu', applyYinyu]]) {
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => LEAKY)
		const leaked = assembled.sections.filter(section => LEAK.test(section.text ?? '')).map(section => section.name)
		equal(leaked, [], key + ' 的系统提示词不含路径与提示词变量')
		ok(assembled.contexts.some(context => context.name === 'working-directory:current'), key + ' 工作目录仍留在运行时上下文里')
	}
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

// 引玉：系统提示词严格只有一句，tooling 在第一个 runtime context
setPresetState(PRESET_DEFAULTS)
{
	const { ctx, handlers } = harness()
	applyYinyu(ctx)
	const assemble = handlers.get('system-prompt/assemble')
	const result = await assemble({}, {}, async () => ({
		...BASE_ASSEMBLY,
		sections: [
			...BASE_ASSEMBLY.sections,
			{ name: 'tools:ptc-only', text: 'PTC only' },
			{ name: 'tools:sdk', text: 'SDK declarations' },
		],
		contexts: [{ name: 'other', text: 'keep me' }],
	}))
	equal(result.sections, [{ name: 'deployment:persona-prefix', text: PROMPT_TEXT, interpolate: false }], '引玉系统提示词严格只有一句')
	const tooling = result.contexts[0]
	equal(tooling?.name, TOOLING_CONTEXT, '引玉 tooling context 在第一位')
	ok(tooling.text.includes('Reversible work that falls within the current request'), '引玉 tooling 段含执行政策')
	ok(tooling.text.includes('PTC only'), '引玉 tooling 段含 PTC-only 规则')
	ok(tooling.text.includes('SDK declarations'), '引玉 tooling 段含 SDK 声明')
	ok(tooling.text.includes('multi-step workflow'), '引玉 tooling 段含 run_code 用法引导')
	ok(tooling.text.includes('concrete nouns'), '引玉 tooling 段含表达风格')
	ok(tooling.interpolate === false, '引玉 tooling 段钉 interpolate: false')
	equal(result.contexts.map(context => context.name), [TOOLING_CONTEXT, 'other'], '引玉保留其它 runtime context')
}

// 引玉把运行时上下文提到工作区指令之前
{
	const { ctx, handlers } = harness()
	applyYinyu(ctx)
	const preStep = handlers.get('agent/pre-step')
	const userMessage = { source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] }
	const instructions = { source: { kind: 'agent-instructions' }, content: [] }
	const snapshot = { source: { kind: 'runtime-context' }, content: [] }
	const reordered = await preStep({}, async () => ({ kind: 'enter', messages: [userMessage, instructions, snapshot] }))
	equal(reordered.messages.map(message => message.source.kind), ['user', 'runtime-context', 'agent-instructions'], '引玉把运行时上下文提到工作区指令之前')
	const withoutInstructions = await preStep({}, async () => ({ kind: 'enter', messages: [userMessage, snapshot] }))
	equal(withoutInstructions.messages.map(message => message.source.kind), ['user', 'runtime-context'], '没有工作区指令时不改动顺序')
	const twice = await preStep({}, async () => reordered)
	equal(twice.messages.map(message => message.source.kind), ['user', 'runtime-context', 'agent-instructions'], '重排是幂等的')
}

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
