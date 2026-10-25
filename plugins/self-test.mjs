import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { Config, apply as applyPack } from './preset-pack.mjs'
import { PRESET_DEFAULTS, getPresetState, setPresetState } from './preset-state.mjs'
import { apply as applyYayan } from './yayan-zh.mjs'
import { apply as applyCangjie } from './cangjie-zh.mjs'
import { apply as applyMaliang } from './maliang-zh.mjs'
import { apply as applyYinyu, PROMPT_TEXT, TOOLING_CONTEXT } from './yinyu-stage.mjs'

const ROOT = new URL('../', import.meta.url)
const read = path => fs.readFile(new URL(path, ROOT), 'utf8')
let checks = 0
const ok = (condition, message) => {
	checks += 1
	assert.ok(condition, message)
	console.log('✓ ' + message)
}
const equal = (actual, expected, message) => {
	checks += 1
	assert.deepEqual(actual, expected, message)
	console.log('✓ ' + message)
}

/** 收集一个预设块，避免四个组合里的同名行互相掩盖。 */
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

// ── 包与组合 ────────────────────────────────────────────────────────────────
const manifest = JSON.parse(await read('package.json'))
ok(manifest.name === '@alm-allen/dsh-preset-pack', '包名固定为 @alm-allen/dsh-preset-pack')
ok(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle patch 指向 cordis.patch.yml')
ok(manifest.dsh?.client?.platform === 'web', '客户端半区声明为 web')
for (const [key, value] of Object.entries(manifest.exports ?? {})) {
	if (key.includes('*')) continue
	const file = typeof value === 'string' ? value : value.default
	ok(file && await fs.stat(new URL(file, ROOT)).then(() => true, () => false), 'export ' + key + ' 指向存在的文件')
}

const patch = await read('cordis.patch.yml')
const controller = block(patch, '- id: preset-pack', '- id: preset-standard')
ok((controller.match(/- id: preset-pack/g) ?? []).length === 1, '只有一个 preset-pack 控制行')
const standard = block(patch, '- id: preset-standard', '- id: preset-ptc')
const ptc = block(patch, '- id: preset-ptc', '- id: preset-cordis')
const cordis = block(patch, '- id: preset-cordis', '- id: preset-yinyu')
const yinyu = block(patch, '- id: preset-yinyu')
ok(standard.includes('prefix: You are a coding agent powered by the {{model}} model.'), '雅言保留原生 persona')
ok(standard.includes('@alm-allen/dsh-preset-pack/yayan-zh'), '雅言挂载包内汉化层')
ok(!standard.includes('prefix: ""'), '雅言不再把 persona 静态置空')
ok(ptc.includes('@alm-allen/dsh-preset-pack/cangjie-zh'), '仓颉挂载包内汉化层')
ok(cordis.includes('@alm-allen/dsh-preset-pack/maliang-zh'), '马良挂载包内汉化层')
ok(yinyu.includes("name: '@alm-allen/dsh-preset-pack/yinyu-stage'"), '引玉挂载包内 stage')
ok(yinyu.includes('id: preset-yinyu'), '引玉仍是新增 preset 条目')

// ── 默认值 ──────────────────────────────────────────────────────────────────
equal(PRESET_DEFAULTS, { yayan: false, cangjie: false, maliang: false, yinyu: true }, '进程内默认值符合要求')
equal(getPresetState(), PRESET_DEFAULTS, '进程内镜像初始值正确')
for (const key of ['yayan', 'cangjie', 'maliang']) {
	equal(Config.dict[key].meta.default, false, key + ' Host 默认关闭')
	equal(Config.dict[key].meta.volatile, true, key + ' 是 volatile 字段')
}
equal(Config.dict.yinyu.meta.default, true, '引玉 Host 默认开启')
equal(Config.dict.yinyu.meta.volatile, true, '引玉是 volatile 字段')
const client = await read('plugins/client.js')
const fallbacks = [...client.matchAll(/fallback: (true|false)/g)].map(match => match[1])
equal(fallbacks.sort(), ['false', 'false', 'false', 'true'], '客户端四个默认值与 Host 一致')

// ── 主插件：开关镜像与引玉条目启停 ─────────────────────────────────────────
{
	const updates = []
	const entry = {
		disabled: false,
		async update(options) {
			updates.push({ ...options })
			this.disabled = options.disabled === true
		},
	}
	let volatileHandler
	const ctx = {
		loader: { resolve(id) { assert.equal(id, 'preset-yinyu'); return entry } },
		on(name, handler) { if (name === 'loader/volatile-update') volatileHandler = handler },
		effect(effect) { const dispose = effect(); return typeof dispose === 'function' ? dispose : () => {} },
		logger: { warn() {} },
	}
	const config = { yayan: false, cangjie: false, maliang: false, yinyu: false }
	applyPack(ctx, config)
	await new Promise(resolve => setTimeout(resolve, 50))
	ok(updates.some(update => update.disabled === true) && entry.disabled === true, '引玉关闭时停用 Loader 条目')
	config.yinyu = true
	volatileHandler()
	await new Promise(resolve => setTimeout(resolve, 50))
	ok(updates.some(update => update.disabled === false) && entry.disabled === false, '引玉重新打开时启用 Loader 条目')
}

// ── 三个汉化层的关闭直通 / 开启替换 ───────────────────────────────────────
for (const [key, apply, batchName] of [
	['yayan', applyYayan, undefined],
	['cangjie', applyCangjie, 'cangjie:batch-calls'],
	['maliang', applyMaliang, undefined],
]) {
	setPresetState({ yayan: false, cangjie: false, maliang: false, yinyu: true })
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

	setPresetState({ yayan: false, cangjie: false, maliang: false, yinyu: true, [key]: true })
	const translated = await assemble({}, {}, async () => BASE_ASSEMBLY)
	const identity = translated.sections.find(section => section.name === 'harness:identity')
	const persona = translated.sections.find(section => section.name === 'deployment:persona-prefix')
	ok(identity?.text.includes('执行政策') && identity?.interpolate === false, key + ' 打开时写入中文身份段')
	ok(persona?.text === '', key + ' 打开时清空原生 persona')
	if (batchName === undefined) {
		ok(!translated.sections.some(section => section.name === batchName), key + ' 不追加多余的批处理段')
	} else {
		ok(translated.sections.at(-1)?.name === batchName, key + ' 在末尾追加批处理段')
	}
}

// ── plan mode 不在 YAML 里静态汉化，而由开关打开时的翻译层负责 ─────────────
for (const file of ['yayan-zh.mjs', 'cangjie-zh.mjs', 'maliang-zh.mjs']) {
	const source = await read('plugins/' + file)
	ok(source.includes('entry.text === PLAN_MODE_EN ? PLAN_MODE_ZH : translateText(entry.text)'), file + ' 带 plan mode 翻译')
}

// ── 引玉：仍是单段提示词 + 第一个 tooling context ───────────────────────────
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
	equal(result.sections, [{ name: 'deployment:persona-prefix', text: PROMPT_TEXT, interpolate: false }], '引玉系统提示词仍只有一句')
	ok(result.contexts[0]?.name === TOOLING_CONTEXT, '引玉 tooling context 仍在第一位')
	ok(result.contexts[0]?.text.includes('Execution policy:'), '引玉上下文仍含执行政策')
	ok(result.contexts[0]?.text.includes('SDK declarations'), '引玉上下文仍含 SDK')
	ok(result.contexts.some(context => context.name === 'other'), '引玉保留其它 runtime context')
}

// ── 客户端 bundle 协议 ─────────────────────────────────────────────────────
{
	let registered
	const sandbox = { window: { __ModuleLoader__: { load(value) { registered = value } } } }
	vm.runInNewContext(client, sandbox, { filename: 'plugins/client.js' })
	ok(registered?.id === '@alm-allen/dsh-preset-pack', '客户端 bundle 用包名注册')
	const exports = registered.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? { Switch() {} } : {})
	equal([...exports.inject], ['slots', 'configForms'], '客户端注入 slots 与 configForms')
	ok(typeof exports.apply === 'function', '客户端导出 apply')
}

console.log('\n全部通过（' + checks + ' 项）')
