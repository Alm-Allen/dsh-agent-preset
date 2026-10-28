import { isPresetEnabled } from './preset-state.mjs'

// 雅言、仓颉、马良三份汉化层共用的机制，各自的翻译表留在自己文件里。
// 机制与取舍见 文档/机制/翻译层.md 与 文档/机制/身份段.md。

/** 身份段的英文原文，也是各表 PROSE 的第一项 */
const IDENTITY_EN = 'You are an AI agent powered by DeepSeek Harness.'

/** 身份段的 section 名：dsh-system-prompt 里的常量，比那句英文稳定 */
const IDENTITY_SECTION = 'harness:identity'

/** 纪律已就位的标记：section 文本里出现它就不再注入 */
const DISCIPLINE_MARK = '执行政策'

/** 原生 persona 的段名。启用汉化时清空它，让身份段独占身份 */
const PERSONA_PREFIX_SECTION = 'deployment:persona-prefix'

// 历史防线，不要移除：早期版本把工作目录写进身份段，整份系统提示词的前缀缓存因此从头失效。
// 这行兜底把 {{cwd}} 整行删掉，既防路径回流，也避开未注册变量炸掉整份组装（见 文档/机制/身份段.md）
const CWD_PLACEHOLDER = '{{cwd}}'
const CWD_LINE = /^[^\S\n]*你的工作目录是 \{\{cwd\}\}。[^\S\n]*$/gm

/** 单行 JSDoc 注释：tools:sdk 的生成格式固定 */
const DOC_RE = /\/\*\* ([\s\S]*?) \*\//g

/** 翻译工作区指令预算的明细片段（truncated <路径> from A to B bytes 或 omitted <路径>） */
export function translateBudgetDetail(detail) {
	if (typeof detail !== 'string' || detail.length === 0) return detail
	return detail
		.replace(/truncated (.+?) from (\d+) to (\d+) bytes/g, '截断 $1：从 $2 字节到 $3 字节')
		.replace(/omitted ([^\n;]+)/g, '省略 $1')
}

/**
 * 造一个汉化层，返回注册两条监听的 apply。
 * prose 是精确段落表，patterns 是正则表，docs 是 tools:sdk 的 JSDoc 表（只有仓颉有），
 * planMode 是 plan mode 段的英中对照，batch 是只属于 PTC 的批量引导段。
 */
export function createZhLayer({ presetKey, prose, patterns, docs, planMode, batch }) {
	const identityZh = prose.get(IDENTITY_EN) ?? ''

	// 正文必须是常量：写进工作目录这类每轮都变的事实会让整份系统提示词的前缀缓存失效
	const identityText = () => {
		if (!identityZh.includes(CWD_PLACEHOLDER)) return identityZh
		return identityZh.replace(CWD_LINE, '').replace(/\n{3,}/g, '\n\n')
	}

	/** 把注释里的转义闭合符还原成真正的注释闭合符，用于查表 */
	const unescapeDoc = (body) => body.includes('*\\/') ? body.replaceAll('*\\/', '*/') : body

	/** 把中文里可能出现的注释闭合符重新转义，避免提前终止 JSDoc */
	const escapeDoc = (body) => body.replaceAll('*/', '*\\/')

	// 渲染侧把工具描述折叠成单行（docLines 的 \s+ → 空格），表里带换行的键必须
	// 也能命中折叠后的文本；两侧都归一化空白再查。
	const collapseDoc = (text) => text.replace(/\s+/g, ' ').trim()
	const docIndex = docs === undefined
		? undefined
		: new Map([...docs].map(([key, value]) => [collapseDoc(key), value]))

	// 顺序固定：精确段落、正则、JSDoc、子串。未知文本原样返回
	const translateText = (text) => {
		if (typeof text !== 'string' || text.length === 0) return text
		const exact = prose.get(text)
		if (exact !== undefined) return exact
		let translated = text
		for (const [pattern, replacement] of patterns) translated = translated.replace(pattern, replacement)
		if (docs !== undefined && translated.includes('/** ')) {
			translated = translated.replace(DOC_RE, (whole, body) => {
				const raw = unescapeDoc(body)
				const zh = docs.get(raw) ?? docIndex.get(collapseDoc(raw))
				return zh === undefined ? whole : `/** ${escapeDoc(zh)} */`
			})
		}
		for (const [en, zh] of prose) {
			if (translated.includes(en)) translated = translated.split(en).join(zh)
		}
		return translated
	}

	// 只认技能目录的 <system-reminder>：运行时上下文快照不能翻，见 文档/机制/运行时上下文.md
	const isInjectedBlock = (text) => text.startsWith('<system-reminder>')

	const translateMessage = (message) => {
		if (message === null || typeof message !== 'object' || message.role !== 'user') return message
		const content = message.content
		if (!Array.isArray(content)) return message
		let changed = false
		const next = content.map(block => {
			if (block === null || typeof block !== 'object' || block.type !== 'text') return block
			if (typeof block.text !== 'string' || !isInjectedBlock(block.text)) return block
			const zh = translateText(block.text)
			if (zh === block.text) return block
			changed = true
			return { ...block, text: zh }
		})
		return changed ? { ...message, content: next } : message
	}

	const translateContribution = (entry) => {
		if (entry === null || typeof entry !== 'object') return entry
		const zh = planMode !== undefined && entry.text === planMode.en ? planMode.zh : translateText(entry.text)
		return zh === entry.text ? entry : { ...entry, text: zh }
	}

	// 只翻顶层不够：workflow 的 meta.phases[].title 这类嵌套参数同样发给模型。深度上限只防异常结构
	const translateSchema = (schema, depth = 8) => {
		if (schema === null || typeof schema !== 'object' || depth <= 0) return schema
		let changed = false
		const next = { ...schema }
		const description = translateText(schema.description)
		if (description !== schema.description) {
			next.description = description
			changed = true
		}
		if (schema.properties !== null && typeof schema.properties === 'object') {
			let propertiesChanged = false
			const nextProperties = { ...schema.properties }
			for (const [name, property] of Object.entries(schema.properties)) {
				const translated = translateSchema(property, depth - 1)
				if (translated === property) continue
				nextProperties[name] = translated
				propertiesChanged = true
			}
			if (propertiesChanged) {
				next.properties = nextProperties
				changed = true
			}
		}
		if (schema.items !== null && typeof schema.items === 'object') {
			const items = translateSchema(schema.items, depth - 1)
			if (items !== schema.items) {
				next.items = items
				changed = true
			}
		}
		for (const key of ['oneOf', 'anyOf', 'allOf']) {
			const variants = schema[key]
			if (!Array.isArray(variants)) continue
			let variantsChanged = false
			const nextVariants = variants.map(variant => {
				const translated = translateSchema(variant, depth - 1)
				if (translated !== variant) variantsChanged = true
				return translated
			})
			if (variantsChanged) {
				next[key] = nextVariants
				changed = true
			}
		}
		return changed ? next : schema
	}

	const translateTool = (tool) => {
		if (tool === null || typeof tool !== 'object') return tool
		let changed = false
		const next = { ...tool }
		const description = translateText(tool.description)
		if (description !== tool.description) {
			next.description = description
			changed = true
		}
		const parameters = translateSchema(tool.parameters)
		if (parameters !== tool.parameters) {
			next.parameters = parameters
			changed = true
		}
		return changed ? next : tool
	}

	// 按 section 名写入而不是按句子匹配：句子会随 dsh 升级改写，纪律会静默消失（见 文档/机制/身份段.md）
	const pinDiscipline = (sections, identity) => {
		if (identity === '') return sections
		let pinned = false
		const next = sections.map(section => {
			if (pinned || section === null || typeof section !== 'object') return section
			if (section.name !== IDENTITY_SECTION || typeof section.text !== 'string') return section
			pinned = true
			if (section.text === identity && section.interpolate === false) return section
			return { ...section, text: identity, interpolate: false }
		})
		if (pinned) return next
		if (next.some(section => typeof section?.text === 'string' && section.text.includes(DISCIPLINE_MARK))) return next
		return [{ name: IDENTITY_SECTION, text: identity, interpolate: false }, ...next]
	}

	const clearNativePersona = (sections) => {
		if (!Array.isArray(sections)) return sections
		let changed = false
		const next = sections.map(section => {
			if (section === null || typeof section !== 'object' || section.name !== PERSONA_PREFIX_SECTION) return section
			changed = true
			if (section.text === '') return section
			return { ...section, text: '' }
		})
		return changed ? next : sections
	}

	// 追加成最后一段，离模型决定这一轮发哪些调用最近。同名先剔除，重复应用不会堆出两段
	const appendBatchSection = (sections) => {
		if (!Array.isArray(sections) || batch === undefined) return sections
		const rest = sections.filter(section => section?.name !== batch.section)
		return [...rest, { name: batch.section, text: batch.text, interpolate: false }]
	}

	return function apply(ctx) {
		ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
			if (!isPresetEnabled(presetKey)) return next()
			const assembled = await next()
			if (assembled === null || typeof assembled !== 'object') return assembled
			const sections = Array.isArray(assembled.sections)
				? pinDiscipline(clearNativePersona(assembled.sections.map(translateContribution)), identityText())
				: assembled.sections
			return {
				...assembled,
				sections: appendBatchSection(sections),
				contexts: Array.isArray(assembled.contexts) ? assembled.contexts.map(translateContribution) : assembled.contexts,
				tools: Array.isArray(assembled.tools) ? assembled.tools.map(translateTool) : assembled.tools,
			}
		})

		// 技能目录以 user 消息注入，不经过 assemble 瀑布，所以在这里补一层同样只做文本替换的处理
		ctx.on('agent/pre-step', async (_payload, next) => {
			if (!isPresetEnabled(presetKey)) return next()
			const decision = await next()
			if (decision === null || typeof decision !== 'object' || decision.kind === 'reject') return decision
			if (!Array.isArray(decision.messages)) return decision
			let changed = false
			const messages = decision.messages.map(message => {
				const translated = translateMessage(message)
				if (translated !== message) changed = true
				return translated
			})
			return changed ? { ...decision, messages } : decision
		})
	}
}
