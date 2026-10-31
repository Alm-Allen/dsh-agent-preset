/**
 * 覆盖率审计：拿 DSH 源码里的英文原文逐条实测本插件的翻译。
 *
 * 用法：node audit-coverage.mjs <DSH 源码根目录> [yayan|cangjie|maliang]，也可用环境变量 DSH_CHECKOUT。
 * preset 省略时按 yayan（标准模式的工具描述走独立 schema）。只读，不改任何源码。
 * 结果怎么读、真缺口补进哪张表，见 文档/机制/翻译层.md。
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.argv[2] ?? process.env.DSH_CHECKOUT
if (ROOT === undefined || ROOT.length === 0) {
	console.error('用法：node audit-coverage.mjs <DSH 源码根目录>（或用环境变量 DSH_CHECKOUT）')
	process.exit(2)
}
const PRESET = process.argv[3] ?? 'yayan'
if (!['yayan', 'cangjie', 'maliang'].includes(PRESET)) {
	console.error(`未知预设 ${PRESET}：只能是 yayan、cangjie 或 maliang`)
	process.exit(2)
}
const PLUGIN = new URL(`./${PRESET}-zh.mjs`, import.meta.url)

const SKIP = /(\\|\/)(node_modules|dist|lib|build|\.git|\.probe|\.idea|\.npm-cache|coverage|snapshots|fixtures|\.agents)(\\|\/)/i
const IS_TEST = /(\\|\/)tests?(\\|\/)|\.spec\.ts$|\.test\.ts$/i
const normalize = text => text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()

/** 就近锚点：文本离它够近，才当成模型能看到的提示词。 */
const ANCHORS = [['defineTool(', 'tool'], ['systemPrompt.section(', 'section'], ['systemPrompt.context(', 'section']]

// 1. 源码里的 section / 工具 / 参数文本
const quoted = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
const sourceItems = []
const scanSource = dir => {
	let entries
	try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) { if (!SKIP.test(full + path.sep)) scanSource(full); continue }
		if (!/\.(ts|tsx)$/.test(entry.name) || SKIP.test(full) || IS_TEST.test(full)) continue
		let raw
		try { raw = fs.readFileSync(full, 'utf8') } catch { continue }
		const folded = raw.replace(/['"]\s*\+\s*['"]/g, '')
		quoted.lastIndex = 0
		let hit
		while ((hit = quoted.exec(folded)) !== null) {
			const value = hit[1] ?? hit[2] ?? hit[3]
			if (value === undefined) continue
			const plain = value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\`/g, '`')
			if (plain.length < 80 || (plain.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length < 8) continue
			if (/[\u4e00-\u9fff]|=>|process\.|require\(|import |function |JSON\./.test(plain)) continue
			// 图标与转义过的中文（`\uXXXX`）不是提示词文本。
			if (/base64,|\\u[0-9a-fA-F]{4}/.test(plain)) continue
			// 只收**就近挂在锚点上的**文本：离最近的 `defineTool(` / `systemPrompt.section(` /
			// `systemPrompt.context(` 超过 4000 字符就不认（config-schema 的字段文档、GUI 文案
			// 都远离这些锚点，不属于模型看到的系统提示词）。
			// 锚点可以在文本之后，也可以在文本之前：section 正文常写成文件顶部的常量，
			// 注册调用在下面几十行处。只往前找会把这类段落整段漏掉。
			let kind
			let nearest = Number.POSITIVE_INFINITY
			for (const [anchor, anchorKind] of ANCHORS) {
				for (const at of [folded.lastIndexOf(anchor, hit.index), folded.indexOf(anchor, hit.index)]) {
					if (at < 0) continue
					const distance = Math.abs(hit.index - at)
					if (distance <= 4000 && distance < nearest) { nearest = distance; kind = anchorKind }
				}
			}
			if (kind === undefined) continue
			const line = folded.slice(0, hit.index).split('\n').length
			// 只有落在 description: 上的才算工具/参数提示词；render、throw、日志一类是运行时
			// 返回值与错误消息，模型看到的形态由运行时拼装，不在本表的覆盖范围内。
			const dotted = folded.lastIndexOf('description:', hit.index)
			const inDescription = dotted >= 0 && hit.index - dotted <= 600
			const role = kind === 'section' ? 'section' : (inDescription ? 'desc' : 'runtime')
			sourceItems.push({ file: path.relative(ROOT, full), kind, role, text: normalize(plain), line })
		}
	}
}
scanSource(path.join(ROOT, 'packages'))

// 2. 技能描述与技能目录散文（走 `agent/pre-step`）
const skillItems = []
const scanSkills = dir => {
	let entries
	try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) { if (!SKIP.test(full + path.sep)) scanSkills(full); continue }
		if (entry.name !== 'SKILL.md') continue
		const raw = fs.readFileSync(full, 'utf8')
		const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)
		if (front === null) continue
		const lines = front[1].split(/\r?\n/)
		for (const [index, line] of lines.entries()) {
			const match = /^description:\s*(.*)$/.exec(line)
			if (match === null) continue
			let value = match[1].trim()
			if (['>', '|', '>-', '|-'].includes(value)) {
				const block = []
				for (const next of lines.slice(index + 1)) {
					if (!/^\s+\S/.test(next)) break
					block.push(next.trim())
				}
				value = block.join(' ')
			}
			value = value.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim()
			if (value.length > 0) skillItems.push({ file: path.relative(ROOT, full), kind: 'skill', text: value })
		}
	}
}
scanSkills(path.join(ROOT, 'packages'))

const toolSkillPath = path.join(ROOT, 'packages/skill/tool-skill/src/index.ts')
if (fs.existsSync(toolSkillPath)) {
	const folded = fs.readFileSync(toolSkillPath, 'utf8').replace(/['"]\s*\+\s*['"]/g, '')
	quoted.lastIndex = 0
	let hit
	while ((hit = quoted.exec(folded)) !== null) {
		const value = hit[1] ?? hit[3]
		if (value === undefined) continue
		const plain = value.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\`/g, '`')
		if (plain.length < 60 || !/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(plain) || /[\u4e00-\u9fff]/.test(plain)) continue
		skillItems.push({ file: 'packages/skill/tool-skill/src/index.ts', kind: 'catalog', text: normalize(plain) })
	}
}

// 3. 用插件自己的翻译路径实测
const { setPresetState } = await import('./preset-state.mjs')
setPresetState({ yayan: PRESET === 'yayan', cangjie: PRESET === 'cangjie', maliang: PRESET === 'maliang' })
const mod = await import(PLUGIN.href)
let assembleHandler
let stepHandler
mod.apply({
	on: (event, fn) => {
		if (event === 'system-prompt/assemble') assembleHandler = fn
		if (event === 'agent/pre-step') stepHandler = fn
	},
	effect: fn => {
		const dispose = fn()
		return typeof dispose === 'function' ? dispose : () => {}
	},
	logger: { warn() {} },
})
if (assembleHandler === undefined || stepHandler === undefined) throw new Error('插件没有注册预期的监听器')

const throughAssemble = async text => {
	const sections = [
		{ name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' },
		{ name: 'probe', text },
	]
	const out = await assembleHandler(null, null, async () => ({ sections, contexts: [], tools: [], variables: { provider: 'p', model: 'm' } }))
	return out.sections[1].text
}
const throughStep = async text => {
	const wrapped = `<system-reminder>\n${text}\n</system-reminder>`
	const decision = await stepHandler(null, async () => ({
		kind: 'continue',
		messages: [{ id: 'probe', role: 'user', content: [{ type: 'text', text: wrapped }] }],
	}))
	return decision.messages[0].content[0].text
}
/**
 * 以独立工具 schema 的形式跑一遍：这是标准模式（native）真正到达模型的路径。
 *
 * 工具描述在标准模式下走 `translateTool`，在 PTC 下才落进 `tools:sdk` 的 JSDoc；
 * 只测 JSDoc 会把前者误报成缺口，所以两条路径都要试。
 */
const throughTool = async text => {
	const tools = [{ name: 'probe', description: text, parameters: { type: 'object', properties: {} } }]
	const sections = [{ name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' }]
	const out = await assembleHandler(null, null, async () => ({ sections, contexts: [], tools, variables: { provider: 'p', model: 'm' } }))
	return out.tools[0].description
}

const seenKeySet = new Set()
const uncoveredItemList = []
for (const item of sourceItems) {
	const key = item.text.slice(0, 90)
	if (seenKeySet.has(key)) continue
	seenKeySet.add(key)
	const viaTool = item.kind === 'section' ? item.text : await throughTool(item.text)
	const viaAssemble = await throughAssemble(item.kind === 'section' ? item.text : `/** ${item.text} */`)
	const toolTranslated = viaTool !== item.text
	const assembleTranslated = viaAssemble.replace(/^\/\*\* | \*\/$/g, '') !== item.text
	if (!toolTranslated && !assembleTranslated) uncoveredItemList.push(item)
}
for (const item of skillItems) {
	const key = item.text.slice(0, 90)
	if (seenKeySet.has(key)) continue
	seenKeySet.add(key)
	const after = await throughStep(item.text)
	if (after.includes(item.text)) uncoveredItemList.push(item)
}

console.log(`源码候选 ${sourceItems.length} 条、技能/目录 ${skillItems.length} 条｜未覆盖 ${uncoveredItemList.length} 条`)
console.log('')
for (const [index, item] of uncoveredItemList.entries()) {
	console.log(`#${index} [${item.kind}/${item.role ?? 'section'}] ${item.file}${item.line === undefined ? '' : ':' + item.line}`)
	console.log('   ' + item.text.slice(0, 170))
}
if (uncoveredItemList.length > 0) {
	console.log('')
	console.log(`含 \${...} 的条目多半是假缺口（运行时才填值，表里用 PATTERNS 匹配填好值的文本）——先用 self-test.mjs 的渲染用例复核。`)
}
