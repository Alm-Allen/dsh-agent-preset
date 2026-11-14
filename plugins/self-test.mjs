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

/** 当前基准（0.2.2-rc.3）里 schedule_create 与 schedule_edit 共用的一段 title 参数说明 */
const TITLE_DOC = '/** Task name of at most 120 characters in the user\'s language: action plus object. Omit timing, status, ids, and bracketed suffixes. */'

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

// 预设行逐行重述 0.2.2-rc.3 的 shipped 文件
for (const [label, section] of [['雅言', standard], ['仓颉', ptc], ['马良', cordis]]) {
	ok(!section.includes('list-agents'), label + '不再挂 list_agents 垫片行（主包已注册该工具）')
	ok(section.includes('modelSelection: true') && section.includes('modelDiscovery: true') && !section.includes('modelSelectionSettings'), label + '只写当前版本的模型选择键')
	ok(section.includes('applyPatch: false'), label + '显式关闭 apply_patch 工具')
}
ok(ptc.includes("name: '@deepseek-ai/dsh-tool-executor-ptc'") && !ptc.includes('dsh-agent-tool-presentation'), '仓颉用 PTC 执行器而不是旧的呈现转发层')
ok(standard.includes("disabled: !!js \"!ctx.get('profileContext')\"") && !standard.includes('id: tool-plugin-manager\n        name: \'@deepseek-ai/dsh-plugin-manager/tools\'\n        disabled: true'), '雅言的插件管理工具跟随 shipped 的 profileContext 开关')

// 0.2.2-rc.3 的 shipped 形状：standard 带 customSkillDirs、standard 与 ptc 多 tool-office、三份都关 interrupt
for (const [label, section] of [['雅言', standard], ['仓颉', ptc], ['马良', cordis]]) {
	ok(section.includes('interrupt: false'), label + '重述 shipped 的 interrupt: false')
}
ok(standard.includes('customSkillDirs') && standard.includes("resolve('@deepseek-ai/dsh-agent-preset/package.json')"), '雅言重述 shipped 的 customSkillDirs，指向上游 agent-preset 包的 skills')
ok(!ptc.includes('customSkillDirs'), '仓颉不挂 customSkillDirs（shipped ptc 没有）')
ok(standard.includes("name: '@deepseek-ai/dsh-tool-office'") && ptc.includes("name: '@deepseek-ai/dsh-tool-office'"), '雅言与仓颉重述 shipped 的 tool-office 行')
ok(!cordis.includes("name: '@deepseek-ai/dsh-tool-office'"), '马良不带 tool-office（shipped cordis 没有）')
ok(cordis.includes('You help the user customize DeepSeek Harness itself.'), '马良重述 shipped 的 persona 第二句')

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
	ok(identity?.text.includes('思维链（reasoning）内容必须是中文'), key + ' 身份段要求中文思维链')

	// 0.2.2-rc.1 把 tool:write / tool:edit 的 guidance 改写成不带原因括注的短句，旧键不再命中
	const guidanceAssembly = {
		...BASE_ASSEMBLY,
		sections: [
			{ name: 'tool:write', text: 'Read an existing file before overwriting it with write and prefer edit for targeted changes.' },
			{ name: 'tool:write-solo', text: 'Read an existing file before overwriting it with write.' },
			{ name: 'tool:edit', text: 'Read a file before editing it unless you just created or edited it in this session.' },
			{ name: 'tools:sdk', text: TITLE_DOC + '\n' + TITLE_DOC },
		],
	}
	const guidance = await assemble({}, {}, async () => guidanceAssembly)
	const textOf = name => guidance.sections.find(section => section.name === name)?.text ?? ''
	ok(textOf('tool:write').includes('覆盖已有文件之前先读取它'), key + ' 翻掉 write 的 guidance')
	ok(textOf('tool:write-solo').includes('覆盖已有文件之前先读取它'), key + ' 翻掉只挂 write 时的 guidance')
	ok(textOf('tool:edit').includes('编辑之前先读取该文件'), key + ' 翻掉 edit 的 guidance')
	equal((textOf('tools:sdk').match(/任务名称/g) ?? []).length, 2, key + ' 同一段里重复出现的参数说明都翻')
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


// 0.2.2-rc.3 新增与改写的模型可见文本：office 工具、subagent 族措辞、office 与 dsh-doc 技能描述
{
	const CASES = [
		["Render document pages, slides, or worksheet areas as images you can view.", "office_render 描述"],
		["A1 range, such as A1:H40; requires sheet. Omit for the used area.", "office_render 的 range 参数"],
		["Word: pdf, docx, odt, txt. Excel: pdf, xlsx, ods, csv. PowerPoint: pdf, pptx, odp.", "office_convert 的 format 参数"],
		["Send a message to an agent. A working agent receives it at its next step; an idle agent starts a new turn with it. Returns delivery confirmation.", "send_message 描述"],
		["Wait for input at your next step, including agent messages, completion notifications, and user steering. Returns immediately if new input is pending. `timedOut: false` means new input is pending. Pending input is delivered to the model after code execution finishes.", "wait_agent 描述"],
		["This tool starts an independently managed subagent and immediately returns its name. If you are still online when it finishes, the runtime automatically delivers its completion notice. The notice includes the final answer unless the child sent you a message just before finishing.", "subagent 描述的新措辞"],
		["Inspect the routes available for explicit subagent model selection. No arguments: authorized providers. `provider`: that provider's authorized models. `provider` + `model`: that model and its reasoning efforts. Query when choosing an explicit child route or reasoning effort. Omit optional fields rather than sending empty strings.", "list_subagent_models 描述"],
		["Reasoning effort id; requires `provider` and `model`. Omit to use the selected model's default, even when it matches the parent or configured route.", "subagent 的 reasoning_effort 参数"],
		["List your entire subagent tree: the root agent and all reachable continuable descendants, including yourself. Rows carry names, descriptions, and status. A descendant's name is its path from the root, such as reviewer/checker. You can message any other agent in the subagent tree. running means it is working; inactive means no turn is executing; it does not indicate task completion, success, or failure. corrupt, unsupported, or unavailable means this row's own descendants could not be read; the row itself is still a member you can message. While you remain active, you will be notified when a direct child finishes; there is no need to keep checking its status. Use send_message to continue the conversation.", "list_agents 描述"],
	]

	// rc.3 的整段散文：SDK 说明、MCP 资源段、run_code 描述、subagent 纪律、goal 收尾、RRULE 与 target 说明
	const PARAGRAPHS = [
		[[
			"## Writing code for run_code",
			"",
			"`run_code` takes two required arguments: `code`, the body of an async TypeScript function (erasable syntax only — no `enum` or namespaces; type annotations are advisory, the code runs type-stripped), and `description`, a short summary of what the program does. The declarations below are SDK bindings for this program. A declaration does not make its name a directly callable tool; only names supplied as separate tool schemas may be called directly.",
			"",
			"Inside the program:",
			"",
			"- Call tools as `await tools.name(args)` — quoted access for exotic names: `tools[\"my-tool\"](args)`. Every call resolves to its declared value, which may be an Image. Tool arguments must be lossless JSON.",
			"- A FAILED tool call rejects with `ToolCallError`, whose `toolName` identifies the failed tool and whose `message` is human-readable — `try/catch` it to handle and continue.",
			"- Independent read-only calls MAY overlap under `Promise.all` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with `await`.",
			"- Show selected values and images with `inspect(...values)`; every other intermediate result stays out of the conversation, so extract just what you need.",
			"",
			"Program-only SDK bindings:",
		].join('\n'), 'PTC 的 SDK 说明段'],
		["## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, or read_mcp_resource with one of these names as the server argument: [\"idea\"].", 'MCP 资源服务器段'],
		["Execute a TypeScript program against the available tools. Takes two required arguments: `code`, the BODY of an async function (erasable syntax only; top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Show selected text and images with inspect(...values).", 'run_code 工具描述'],
		["Start independent delegations with `subagent` or `subagent_fork` together in one assistant message and continue useful work while they run. When only waiting for their results remains, end your turn instead of sleeping or polling; the next result starts a new turn. Collect the subagent results required to complete the task before giving the user a final answer.\n\nBash, formatters, code generators, and scripts can overwrite concurrent edits without conflict detection; coordinate their changes explicitly. The agent integrating the work must review the final diff and run relevant tests.", 'subagent 委托纪律段'],
		["<goal_complete>\nObjective: \"ship it\"\nThe goal is marked complete and this autonomous run is ending. Write the closing message to the user now: state the outcome, summarize what was done and how it was verified, and point to the concrete results (files, commits, or other artifacts). Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Note anything the user should review or do next. Address the user directly. Do not call any more tools in this run; further work waits for the user's next instruction.\n</goal_complete>", 'goal 完成的收尾提示'],
		["Supported RFC 5545 subset: one DTSTART line, a newline, and one RRULE line. DTSTART ends in Z for UTC or carries TZID with an IANA time zone; a fixed offset such as UTC+5 is Etc/GMT-5, with the sign reversed. DTSTART must name an existing local time. A TZID rule keeps local clock time across daylight-saving changes; generated nonexistent local times are skipped, and repeated ones occur once, at the earlier instant. DTSTART may be in the past; delivery starts with the first occurrence after creation. A one-time delivery is RRULE:FREQ=DAILY;COUNT=1. No SECONDLY; BYSECOND takes one value. COUNT is at most 1000; use UNTIL for longer rules. MINUTELY and HOURLY accept no BY parts, so select clock times with DAILY or WEEKLY plus BYHOUR and BYMINUTE. BYMONTHDAY and ordinal BYDAY require MONTHLY or YEARLY; BYYEARDAY and BYWEEKNO require YEARLY. Ordinal BYDAY cannot combine with BYWEEKNO. Each FREQ period allows at most 10080 candidates before BYSETPOS, which accepts at most 31 values. UNTIL is a UTC instant ending in Z. Example: \"DTSTART;TZID=Asia/Singapore:20260901T080000\nRRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1\"", 'schedule 的 RRULE 说明'],
		["this_session delivers to this session; new_once delivers to the same new session every time, opened at the first delivery; new opens a different new session for every delivery, at most once every 5 minutes. New sessions use this session's working directory and preset. With this_session or new_once, a delivery waits until the previous one finishes, and only the latest occurrence that passed meanwhile is delivered. Use this_session for reminders and for follow-ups to this conversation; use new_once or new for independent work, such as a recurring report, and whenever the user asks for a new conversation.", 'schedule 的 target 说明'],
	]

	const SKILLS = [
		["Create or edit Office files; inspect Office files and PDFs. Load before rendering, conversion, or recalculation to enable office_render, office_convert, and office_recalculate next step.", "office 技能描述"],
		["Use when a task needs facts about DeepSeek Harness (DSH) itself, such as how a feature, setting, plugin, agent preset, tool, or Cordis API of the running installation works; when the user asks to design, review, build, install, enable, or debug a DSH plugin, bundle, MCP connection, agent preset, plugin icon or detail page, or a DSH tool definition or skill; and when upgrading a plugin or profile to a newer DSH release. Loading it grants no permission to change files or the profile.", "dsh-doc 技能描述"],
	]
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, handlers } = harness()
		apply(ctx)
		const assemble = handlers.get('system-prompt/assemble')
		const preStep = handlers.get('agent/pre-step')
		for (const [en, label] of CASES) {
			const tools = [{ name: 'probe', description: en, parameters: { type: 'object', properties: {} } }]
			const assembled = await assemble({}, {}, async () => ({ sections: [], contexts: [], tools, variables: { provider: 'p', model: 'm' } }))
			ok(assembled.tools[0].description !== en, key + ' 翻掉 ' + label)
		}
		for (const [en, label] of SKILLS) {
			const wrapped = '<system-reminder>\n' + en + '\n</system-reminder>'
			const decision = await preStep({}, async () => ({ kind: 'continue', messages: [{ role: 'user', content: [{ type: 'text', text: wrapped }] }] }))
			ok(decision.messages[0].content[0].text !== wrapped, key + ' 翻掉 ' + label)
		}
		for (const [en, label] of PARAGRAPHS) {
			const assembled = await assemble({}, {}, async () => ({ sections: [{ name: 'probe', text: en }], contexts: [], tools: [], variables: {} }))
			const probe = assembled.sections.find(section => section.name === 'probe')
			ok(probe?.text !== en, key + ' 翻掉 ' + label)
		}
	}
	// subagent 的自我介绍段：agent 名字由 harness 注入，按模式匹配
	setPresetState({ yayan: false, cangjie: false, maliang: true })
	{
		const { ctx, handlers } = harness()
		applyMaliang(ctx)
		const identity = 'You are a subagent delegated by agent "lead".\nYour name is "reviewer".\nThe root agent of your collaboration tree is "lead".'
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
			sections: [], tools: [], variables: {},
			contexts: [{ name: 'subagent:identity', text: identity }],
		}))
		ok(!assembled.contexts[0].text.includes('delegated by agent'), '马良翻掉 subagent 的自我介绍段')
	}
}
// 0.2.2-rc.3 的实验性 Timeline 插件：任务树提示词、turn-start 状态段、注入通知与五个 timeline_* 工具
{
	const PLANNING = `## Task planning with Timeline

Before substantive multi-step work, reuse the goal's tree or start one with timeline_tree. Group work by deliverable and split large steps into checkable child tasks. Use timeline_tasks at meaningful checkpoints to update leaves and revise the tree as scope changes. Preserve completed work.

Before a final answer on planned work, save progress and call timeline_pull for that goal. Continue eligible work in scope and repeat the check. Recheck blocked dependencies once and record remaining blockers. Resume paused work only at the user's request.

Own the shared tree. Save tasks before delegating. Include "Timeline: tree=<id>; tasks=<ids>", scope, and completion criteria in assignments and reassignments. Relay relevant discussions and pause/continue requests. Save worker progress and blockers, verify results before marking tasks done, and save shared replies yourself. Save progress and yield when waiting for workers.

Interval reports run independently when enabled. Keep replies focused on the user's work.

For Timeline task-tree content only, write titles, descriptions, progress notes, results, and discussion replies in 简体中文. Follow the user's language instructions for all other work and conversation.`
	const WORKER = `## Shared task planning
The manager owns the shared Timeline tree. At milestones, blockers, and completion, report the assigned tree/task IDs, verified results, and remaining work to your parent through normal agent messages. Ask for missing IDs at the first checkpoint. Follow the latest assignment and pause/continue requests at safe checkpoints. Send discussion findings to your parent for a saved reply. Pass the same references if you delegate further.`
	const MAINTENANCE = 'Task progress checkpoint: Save changes to the current goal’s tree, or start one if this multi-step goal has none. Use timeline_pull when choosing the next task.'
	const STATE = 'Current Timeline plan (turn-start state, not a new request): {"selectedTree":"t1"}\nAddress open discussions at a safe checkpoint. Use timeline_read with annotation set to the ID if you need the full message or context. Save replies with timeline_reply. Apply pause or continue to the requested scope before confirming it.'
	const DELEGATION = 'Timeline delegation: parent s9; plan owner s1; current tree t1: "计划". These are references, not assignments. Use the tree/task IDs in the latest assignment message; report missing IDs to the parent.'
	const TASK_TOOL = 'Patch tasks in one tree. Send parents and children in the same batch when adding a branch. Groups derive status and progress from their leaves. The batch is atomic and omitted tasks and fields stay unchanged.\n\nTask writing guidance:\nUse short, outcome-based titles. Break deliverables into checkable child actions. State the result or blocker in note. Use details for evidence, limits, and the effect on the goal. Explain unfamiliar names and what meaningful measurements show. Include counts only when they answer the user\'s question.'
	const PULL = 'Check what remains before closing the current goal. Returns active or pending leaves in priority order, or blocked leaves if none are runnable. Paused leaves are counted but never suggested.'
	const PULL_LIMIT = 'Maximum suggestions, 1–500. Default 12. hasMore indicates more candidates in the same category.'
	const PRIORITY = 'Timeline priority update: P0 changed. At the next safe checkpoint, prefer the highest-priority eligible work within the current goal.\nEligible prioritized tasks: [{"id":"t1"}]'
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
			sections: [
				{ name: 'timeline:planning', text: PLANNING },
				{ name: 'timeline:worker', text: WORKER },
				{ name: 'timeline:maintenance', text: MAINTENANCE },
			],
			contexts: [{ name: 'timeline:state', text: STATE }, { name: 'timeline:delegation', text: DELEGATION }],
			tools: [{
				name: 'timeline_pull',
				description: PULL,
				parameters: { type: 'object', properties: { limit: { type: 'integer', description: PULL_LIMIT } } },
			}],
			variables: {},
		}))
		const section = name => assembled.sections.find(item => item.name === name)?.text ?? ''
		const context = name => assembled.contexts.find(item => item.name === name)?.text ?? ''
		ok(section('timeline:planning').includes('## 用 Timeline 规划任务') && section('timeline:planning').includes('一律用 简体中文 写'),
			key + ' 翻掉 Timeline 的规划段与语言规则')
		ok(section('timeline:worker').includes('## 共享的任务规划'), key + ' 翻掉 Timeline 的 worker 规划段')
		ok(section('timeline:maintenance').includes('任务进度检查点：'), key + ' 翻掉 Timeline 的进度检查点提示')
		ok(context('timeline:state').includes('当前 Timeline 计划') && context('timeline:state').includes('{"selectedTree":"t1"}'),
			key + ' 翻掉 turn-start 状态段并保留其中的 JSON')
		ok(context('timeline:delegation').includes('Timeline 委派：父会话 s9'), key + ' 翻掉 Timeline 的委派上下文')
		ok(!assembled.tools[0].description.includes('Check what remains') && assembled.tools[0].parameters.properties.limit.description.includes('最多给出的建议数，1–500'),
			key + ' 翻掉 timeline_pull 的描述与随配置变化的 limit 说明')
		const decision = await handlers.get('agent/pre-step')({}, async () => ({
			kind: 'continue',
			messages: [
				{ role: 'user', content: [{ type: 'text', text: PRIORITY }] },
				{ role: 'user', content: [{ type: 'text', text: 'Ordinary user message about Timeline and the tree.' }] },
			],
		}))
		ok(decision.messages[0].content[0].text.includes('Timeline 优先级更新：P0 有变化'),
			key + ' 翻掉 Timeline 注入的优先级通知')
		ok(decision.messages[1].content[0].text === 'Ordinary user message about Timeline and the tree.',
			key + ' 注入白名单之外的用户消息逐字不变')
	}
	// 白名单只放这两类注入：运行时上下文快照等其它 user 文本不能翻
	ok(/const INJECTED_PREFIXES = \['<system-reminder>', 'Timeline priority update:'\]/.test(commonSource),
		'注入白名单只含技能目录与 Timeline 优先级通知')
	// timeline_tasks 的说明在 PTC 里还带一段可自定义的写法指引
	setPresetState({ yayan: false, cangjie: true, maliang: false })
	const { ctx, handlers } = harness()
	applyCangjie(ctx)
	const sdk = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
		sections: [{ name: 'tools:sdk', text: '/** ' + TASK_TOOL + ' */' }],
		contexts: [],
		tools: [],
		variables: {},
	}))
	const sdkText = sdk.sections.find(item => item.name === 'tools:sdk')?.text ?? ''
	ok(sdkText.includes('任务写法指引：') && sdkText.includes('标题要短，落在结果上'), '仓颉翻掉 timeline_tasks 的说明与默认写法指引')
}

// 0.2.2-rc.3 的实验性 cua 插件：guidance 段、注入的限额行、PTC 初始化段与工具描述
{
	const CUA = `Windows: accessibility tree operations are available only at window level. Simulated mouse and keyboard input are available at window level. Supported modifiers: ctrl, alt, shift, win. control is an alias for ctrl.

Call inspect(...values) to display selected observation results.

Setup and discovery:
- cua.getCapabilities() -> { platform: string, permissions: { accessibility: boolean, screenRecording: boolean }, appLevelAccessibility: boolean, systemPointer: boolean, keyboard: ('app' | 'window')[], sessionLocked: boolean | null, methods: string[], coordinateSpace: 'screenshot-pixels', browser: false } — inspect reported permissions, sessionLocked, methods, and keyboard scopes without requesting permissions.
- cua.findApps(query: string) -> { id: string, displayName: string, path: string, isRunning: boolean, pid?: number }[] — search installed applications, including stopped matches. Not implemented on Windows. Use listApps to discover applications, or pass a known absolute .exe path to getApp.
- listActions(elementId: string) -> string[] — list the actions an element advertises. Actions use case-sensitive Pattern.Action names, such as "Invoke.Invoke", "Toggle.Toggle", and "ExpandCollapse.Expand". Each pattern has a known set of native UI Automation operations. One pattern can expose multiple actions. Use a known operation of an advertised pattern directly; call listActions when you need to confirm the exposed operations. Query methods are not exposed through performAction.

## Accessibility tree
Available at app or window level depending on the platform.
- getAccessibilityTree(options?: { includeMenus?: boolean, details?: boolean, maxElements?: number, maxDepth?: number }) -> string — Set the node count or depth for one read. Windows accepts maxElements from 1 to 10000 and maxDepth from 1 to 100. Omitted limits use the provider settings; maxDepth=1 includes only the window root. If the tree is truncated, select a narrower window or increase the relevant limit. includeMenus expands menu contents. Element IDs are UI Automation RuntimeIds formatted as slash-separated integer strings, such as "12/345/6". Pass the complete string unchanged as elementId. Each element lists all its supported patterns, not action names. Disabled is an observed state, not a prohibition on attempting an operation.

## Simulated mouse
- drag(from: [number, number], to: [number, number], options?: { mouseButton?: 'left' | 'right' | 'middle', modifiers?: Modifier[], relative?: boolean }) -> ActionResult — drag between two points of one window.

## Simulated keyboard
- sendKeyEvent(key: string, direction: 'down' | 'up') -> ActionResult — send one key-down or key-up event; key accepts a single key name, including a modifier.

Raw tools use { method, params }: include appHandle for app calls and windowId for window calls, and use snapshotId with elementId for element routes. getAccessibilityTree maps to getState; getWindow has no raw method; getWindows maps to listWindows; getScreenshot maps to screenshot; cua.getState maps to listApps; every other named operation uses the same method name.

AX read defaults: maxElements=2000, maxDepth=25.

Maximum click holdMs: 5000 ms.

In persistent PTC, use the host-provided bridge initialization once and retain the returned objects; cua comes from that bridge and is not a preinstalled global.

Persistent PTC initialization:

\`\`\`ts
var { connectCua } = await import("file:///bridge.js");
var cua = connectCua(() => tools.cua);
\`\`\``
	const CUA_DESC = 'Inspect desktop access, select an application and window, read AX state, capture screenshots or dispatch input. Use appHandle from getApp; verify actions by reading fresh state.'
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
			sections: [{ name: 'computer-use:dsh-cua', text: CUA }],
			contexts: [],
			tools: [{ name: 'cua', description: CUA_DESC, parameters: { type: 'object' } }],
			variables: {},
		}))
		const text = assembled.sections.find(item => item.name === 'computer-use:dsh-cua')?.text ?? ''
		ok(text.includes('Windows：辅助功能树操作只在窗口作用域可用') && text.includes('准备工作与发现：') && text.includes('## 模拟鼠标') && text.includes('原生调用写成'),
			key + ' 翻掉 cua 的 guidance 段')
		ok(!text.includes('accessibility tree') && !text.includes('Accessibility tree') && !text.includes('Setup and discovery') && !text.includes('Simulated mouse') && !text.includes('Raw tools use') && !text.includes('Not implemented on Windows'),
			key + ' 不残留 cua guidance 的英文小节与追加句')
		ok(text.includes('AX 读取默认值：maxElements=2000，maxDepth=25。') && text.includes('click 的 holdMs 上限：5000 毫秒。'),
			key + ' 翻掉随配置注入的 AX 限额与 holdMs 上限')
		ok(text.includes('持久 PTC 的初始化：') && text.includes('var cua = connectCua(() => tools.cua);'),
			key + ' 翻掉 PTC 初始化段并保留代码块')
		ok(!/。 [\u4e00-\u9fff]/.test(text) && text.includes('cua.getCapabilities() -> { platform: string'),
			key + ' 拼接处不留空格、签名原样保留')
		ok(assembled.tools[0].description.startsWith('查看桌面访问权限'), key + ' 翻掉 cua 工具描述')
	}
}

// apply_patch 默认关闭（tool-fs 的 applyPatch: false），打开开关后这三处必须已经中文
{
	const GUIDE = 'Prefer apply_patch over separate edit calls for changes across files or separated regions. Give every hunk enough surrounding context lines to match one place in the current file. The whole patch is checked first (syntax, hunk matching, missing files) and a rejected patch changes nothing; once applying starts, operations run in order, stop at the first failure, and are not rolled back, so re-read affected files before retrying when needed.'
	const DESC = 'Create, update, delete, or move UTF-8 text files with one patch; prefer it over multiple edit calls when a change spans several files or separated regions.'
	const INPUT = 'Patch text: start with *** Begin Patch and end with *** End Patch. Use *** Add File: path with + lines; *** Update File: path, optionally followed by *** Move to: path, with @@ or @@ context and space-prefixed context, + added, or - removed lines; *** End of File anchors the last hunk to the file end. Use *** Delete File: path to delete. Paths are relative to the Session working directory.'
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
			sections: [{ name: 'tool:apply_patch', text: GUIDE }],
			contexts: [],
			tools: [{ name: 'apply_patch', description: DESC, parameters: { type: 'object', properties: { input: { type: 'string', description: INPUT } } } }],
			variables: {},
		}))
		ok(assembled.sections.find(item => item.name === 'tool:apply_patch')?.text.startsWith('跨文件') === true,
			key + ' 翻掉 apply_patch 的 guidance 段')
		ok(assembled.tools[0].description.startsWith('用一份补丁') && assembled.tools[0].parameters.properties.input.description.startsWith('补丁正文：'),
			key + ' 翻掉 apply_patch 的工具描述与 input 参数')
	}
}

// 智能体团队：rc.3 的三段 team:policy 与 team_task_* 的新措辞
{
	const POLICY = `Agent Teams is available in this session.

The Team Lead and all teammates share the same working directory and filesystem. Edits are immediately visible to every member. Split write work into disjoint scopes, record expected write scopes on shared tasks, and use task dependencies when work must be ordered. Write-scope overlap is advisory, not a lock.

Use the names returned by subagent, subagent_fork, or list_agents as owner when assigning or filtering shared tasks. The root can reassign tasks to itself or any continuable descendant; other agents claim ready tasks themselves. Shared-task workflow is list, get, claim with the current revision, perform the work, then complete. Task readiness never starts an owner. The root agent must wait for required teammates before giving the final answer.

Task changes do not end wait_agent calls, add inbox messages, or start idle agents. Use send_message when another agent needs to act on a task.`
	const OWNER_LIST = 'Optional owner agent name filter; cannot be combined with unowned.'
	const UNOWNED = 'Filter tasks by whether they have no owner; cannot be combined with owner.'
	const OWNER_UPDATE = 'Agent name of the root or any continuable descendant for root-only reassign; omit to unassign.'
	for (const [key, apply] of [['yayan', applyYayan], ['cangjie', applyCangjie], ['maliang', applyMaliang]]) {
		setPresetState({ yayan: false, cangjie: false, maliang: false, [key]: true })
		const { ctx, handlers } = harness()
		apply(ctx)
		const assembled = await handlers.get('system-prompt/assemble')({}, {}, async () => ({
			sections: [{ name: 'team:policy', text: POLICY }],
			contexts: [],
			tools: [
				{
					name: 'team_task_list',
					description: 'List shared tasks, including readiness, owner, revision, blockers, and write-scope warnings.',
					parameters: { type: 'object', properties: { owner: { type: 'string', description: OWNER_LIST }, unowned: { type: 'boolean', description: UNOWNED } } },
				},
				{
					name: 'team_task_update',
					description: 'Compare-and-set a shared task action using the latest revision from team_task_get or team_task_list.',
					parameters: { type: 'object', properties: { owner: { type: 'string', description: OWNER_UPDATE } } },
				},
			],
			variables: {},
		}))
		const policy = assembled.sections.find(item => item.name === 'team:policy')?.text ?? ''
		ok(policy.startsWith('本会话可以使用 Agent Teams（智能体团队）') && policy.includes('任务变化不会结束 wait_agent 调用') && !policy.includes('Agent Teams is available'),
			key + ' 翻掉 team:policy 的三段')
		const list = assembled.tools[0].parameters.properties
		ok(list.owner.description.startsWith('可选，按归属者 agent 名过滤') && list.unowned.description.startsWith('按任务是否没有归属者过滤'),
			key + ' 翻掉 team_task_list 的 owner 与 unowned')
		ok(assembled.tools[1].parameters.properties.owner.description.startsWith('仅限根代理的 reassign'),
			key + ' 翻掉 team_task_update 的 owner 新措辞')
	}
	// PTC 把工具描述折进 tools:sdk 的 JSDoc，这条路径也要翻
	setPresetState({ yayan: false, cangjie: true, maliang: false })
	const sdkHarness = harness()
	applyCangjie(sdkHarness.ctx)
	const sdk = await sdkHarness.handlers.get('system-prompt/assemble')({}, {}, async () => ({
		sections: [{ name: 'tools:sdk', text: '/** List shared tasks, including readiness, owner, revision, blockers, and write-scope warnings. */' }],
		contexts: [],
		tools: [],
		variables: {},
	}))
	ok((sdk.sections.find(item => item.name === 'tools:sdk')?.text ?? '').includes('列出共享任务，包含就绪状态'), '仓颉在 tools:sdk 的 JSDoc 里也翻掉团队工具描述')
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
