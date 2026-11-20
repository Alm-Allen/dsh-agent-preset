# Changelog

## [2026.11.20] - 2026-11-20

### Fixed

- **修掉 `schedule` 的 RRULE 说明**：示例里的 \n 在 dsh 源码里是字面反斜杠加 n，三份表的键写成了真换行，`schedule_create` 与 `schedule_edit` 的 `rrule` 参数说明在三个预设下都没命中，原生 schema 与 PTC 的 JSDoc 两条路径都透英文。九处（三份表的键与译文、自测用例）一并改正，用源码求值后的文本实测命中；自测加一条断言盯住这个转义。

### Changed

- **基准升到 dsh 0.2.2-rc.5**。rc.4 与 rc.5 没有改动 shipped 预设：`standard`、`ptc`、`cordis`、`minimal` 四个 patch.yml 与 rc.3 逐字相同，`cordis.patch.yml` 的三个 override 原样保留。逐行比对三个 override 与 rc.5 shipped（剔除四个汉化层行）为 0 差异；桌面版 0.2.2-rc.5 的 `app.asar` 内出货副本与源码逐字一致。
- **复核了 rc.5 的两处行为变化，都不改汉化层**：base 组合删掉 `web.searchProvider`，搜索改按模型路由自动选择（DeepSeek 模型走 Messages 搜索，不按次收费但多耗模型 token）；新增 `CONTENT_REFUSED` 错误码与拒答消息，`web_search` 的激活条件改成 `searchReady(llmProvider)`。运行时错误串与 `tool-cordis` 的服务 API 目录按既有策略不翻。
- `self-test` 241 项在 rc.5 上全过；`audit-coverage` 三份（雅言 106、仓颉 105、马良 106 条未覆盖）与 rc.3 源码树上的结果逐条相同，没有新增模型可见文本。
- **关掉 `dsh-harness-dev-context`**：`cordis.patch.yml` 顶层把 `dsh-web-app` bundle 挂的这一行整行 `disabled: true`。系统提示里少 `harness:source` 与 `app:web-surface` 两段（检出目录说明、Web GUI 定位与改产物须知），运行时上下文少检出路径与 GUI URL 两条。该插件在 0.2.2-rc.5 上没有 config 可调，只能整行禁用；`hide-harness-source` 留在三个预设里做重开时的兜底。
- **身份段删掉工作目录那句**：三份汉化层的 identity 段不再写「当前工作目录由每一轮用户消息里的运行时上下文给出，形如 `Current working directory: …`」。目录本来就由 `working-directory:current` 上下文携带，这句每轮占一行提示词却不带来新信息。

### Docs

- `文档/机制/双版本兼容.md` 基准改到 rc.5，补「rc.5 变了什么」一节与本次复核数据。
- `AGENTS.md`、`README.md`、`cordis.patch.yml` 顶注、`self-test.mjs` 注释同步到 rc.5。
- `文档/机制/运行时上下文.md` 的「检出目录那条由 hide-harness-source 遮蔽」改写成禁用 `dsh-harness-dev-context` 的说明；`文档/机制/双版本兼容.md` 记下这处 bundle 层偏离。

## [2026.11.14] - 2026-11-14

### Fixed

- **修掉 rc.3 里成段透出的英文**：`tools:sdk` 的固定说明与 `run_code` 描述、MCP 资源服务器段与三个资源工具、`subagent` 的 continuation 与 structured output 提示、`tool:subagent` 的委托纪律段、`office` 的输出参数与 Python 环境段、`read` 与 `grep` 的新 guidance、`ask_user_question` 的 timed 描述、审批启用段、技能资源提示、web 标签、plan mode 通知、schedule 的 target 说明与变更通知、goal 的收尾与轮次提示。
- RRULE 示例里的换行写成了字面反斜杠加 n，整条说明不命中；按源码的真换行改写。
- **补智能体团队的英文**：打开 Agent Teams 后注入的 `team:policy`（rc.3 改成三段，旧键命中不了）、`team_task_list` 的 `owner` 与 `unowned`、`team_task_update` 的 `owner` 三处新措辞，三份汉化层都已覆盖。
- **补 `apply_patch` 的英文**：`tool-fs` 的 `applyPatch` 默认关闭，打开后模型的 guidance 段、工具描述与 `input` 参数说明会露英文；三份汉化层已补上。
- 自测加到 239 项：SDK、MCP、run_code、subagent、goal、RRULE、target 七段整段散文在三个预设下各跑一遍；Timeline 的规划段、状态段、委派上下文、进度检查点、优先级通知与 `timeline_*` 工具说明另加了 26 项，cua 的 guidance 段、注入的限额行、PTC 初始化段与工具描述另加了 18 项，`apply_patch` 另加了 6 项，智能体团队的 policy 与三个参数另加了 10 项。
- **补实验性 cua 的英文**：打开电脑操控开关后注入的 `computer-use:dsh-cua` 段（平台段、五节方法目录、`AX read defaults` 与 `Maximum click holdMs` 两行）、PTC 初始化段，以及 `cua` 工具描述与 `cua_run_code` 程序说明，三份汉化层都已覆盖。方法目录只翻 `— ` 之后的说明，签名、类型定义与代码块原样保留。
- **补实验性 Timeline 的英文**：打开实验开关后注入的任务树规划段、`timeline:state` 状态段、进度检查点与优先级通知、委派上下文、五个 `timeline_*` 工具的描述与参数、`timeline_tasks` 的默认写法指引，三份汉化层都已覆盖。`agent/pre-step` 的注入白名单从只认 `<system-reminder>` 扩到再认 `Timeline priority update:`。

### Changed

- **同步 dsh 0.2.2-rc.3 的 shipped 预设**。三个 override 照 rc.3 的 shipped 文件重述：
  - `standard` 与 `ptc` 在 `present` 之后加 `tool-office` 行；
  - `standard` 的 `skill-filesystem` 加 `customSkillDirs`，用 `!!js` 指向上游 `@deepseek-ai/dsh-agent-preset` 包的 `skills`；
  - 三个预设的 `tool-subagent-control` 加 `config: interrupt: false`；
  - `cordis` 的 persona prefix 补上 shipped 的第二句；
  - ptc 与 cordis 的 `tool-fs` 注释改回 shipped 的措辞。
- **补 rc.3 的模型可见文本**：office 三个工具的描述与参数说明、`subagent` 族的改写措辞（`subagent`、`list_subagent_models`、`send_message`、`list_agents`、`wait_agent`）、`office` 与 `dsh-doc` 两个技能描述，以及 `subagent:identity` 的 root 与 subagent 自我介绍段（名字是动态的，走正则）。
- 自测从 116 项增到 158 项：加 rc.3 的 shipped 行断言，以及上面这批文本的翻译断言。

### Docs

- `文档/机制/双版本兼容.md` 重写为 rc.3 基准，记下 shipped 的形状变化与 asar 内 shipped 文件的读法。
- `AGENTS.md`、`README.md` 的基准更新到 0.2.2-rc.3。

## [2026.11.5] - 2026-11-05

### Fixed

- **0.2.2-rc.1 上仍会透出英文原文，两处都修掉。**
  - `tool:write` / `tool:edit` 的 guidance 在 0.2.2-rc.1 改成不带 `(the default fs-observation-policy requires it)` 的短句，三份表里只有旧长句的键，命中不了。键换成新句子，中文译文里那句括注一并去掉。
  - `PATTERNS` 走 `replace`，非全局：`schedule_create` 与 `schedule_edit` 共用的 title 说明在 `tools:sdk` 里出现两次，只有第一处被翻，第二处留英文。`createZhLayer` 现在统一把 `PATTERNS` 转成全局正则，字符串条目转义后同样全局。
  - 自测加四条断言：write / 只挂 write / edit 的 guidance，以及同一段里重复的 title；三份预设各跑一遍，现共 116 项。

### Changed

- **身份段加回语言与思维链要求**：「你必须使用汉语的思维方式进行思考和推理：思维链（reasoning）内容必须是中文，对用户的回答也使用中文。」2026.11.3 以「翻译本身已经决定输出语言」为由删掉，但汉化换的只是提示词与工具说明，推理用什么语言不由此决定，少了这句思维链会滑回英文。三份身份段一起加回，`文档/机制/身份段.md` 记下这条是有意为之、别再删。自测每个预设加一条断言。

### Removed

- **删掉 npm 发布配置**：`package.json` 的 `publishConfig`（registry 与 `access: public`）与 `prepublishOnly` 钩子都去掉，仓库里不再有 npm 发布相关的元数据与自动步骤。npm 由维护者手动发布，registry 与 `access` 在命令上自己带；`.github/workflows/release.yml` 仍然只建 GitHub Release。

## [2026.11.4] - 2026-11-04

### Changed

- **同步 dsh 0.2.2-rc.1 的 shipped 预设**。web（0.2.1-rc.5，其 `dsh-web-app` 与核心包都是 0.2.2-rc.1）与 desktop（0.2.2-rc.1）的四个 preset patch.yml 已经逐行一致，`cordis.patch.yml` 的三个 override 照此重述：
  - `tool-fs` 显式写 `applyPatch: false`（0.2.2-rc.1 的出货值）；
  - `tool-subagent` 只写 `modelSelection` 与 `modelDiscovery`，删掉旧的 `modelSelectionSettings`；
  - ptc 预设改用 `@deepseek-ai/dsh-tool-executor-ptc`，删掉旧的 `dsh-agent-tool-presentation` 转发行；
  - standard 的 `tool-plugin-manager` 跟随出货改成 `!!js "!ctx.get('profileContext')"`。
- **删掉 list_agents 垫片**：`@deepseek-ai/dsh-tool-subagent-control` 0.2.2-rc.1 的主入口已经注册 `list_agents`，shipped 不再单列该行。`plugins/list-agents-shim.mjs`、`package.json` 的 export 与 peer 声明、自测里的垫片断言一并删除。
- 自测新增「预设行逐行重述」断言：三个预设都不得再挂垫片行、只写当前模型选择键、显式关闭 apply_patch；仓颉用 PTC 执行器；雅言的插件管理工具跟随 profileContext。现共 101 项。
- **不再为旧版 dsh 保留兼容**。目标版本只有 0.2.2-rc.1：翻译表里旧 reminder 的 schedule 条目、旧版带路径的 harness / Web GUI 正则、旧 office 长描述已删除；其余历史条目仍在表里，但只保证 0.2.2-rc.1 的文本被正确命中。

### Added

- 汉化层补 dsh 0.2.2-rc.1 重写的 `tool-schedule`：从 reminder 模型换成计划任务（task）模型，新增工具描述、RRULE 帮助、target/active/expectedUpdatedAt 等参数说明，以及带数字的标题与分页说明（走正则）。旧 reminder 条目保留，旧版 dsh 仍能命中。
- 补技能目录的其余状态说明（未确认到技能、发现不完整、部分技能未检查），此前只有「目录已更新」与「当前没有技能」两条。
- 补文件策略的 `read-only` 与 `workspace-write` 两种模式；此前只有 `danger-full-access`。`workspace-write` 的工作区路径与额外可写目录是动态的，走正则。

### Removed

- 删除 `.github/workflows/publish.yml`：npm 发布改为手动执行，推标签只触发 GitHub Release。`package.json` 的 `prepublishOnly` 保留，手动 `npm publish` 前仍会跑离线自测。

### Docs

- `文档/机制/双版本兼容.md` 重写：只支持 0.2.2-rc.1，记录已删除的旧版兼容项与新的升级复核步骤。
- `AGENTS.md` 与 `README.md` 的基准更新到 rc 0.2.1-rc.5 / 0.2.2-rc.1，包结构删掉垫片文件。

## [2026.11.3] - 2026-11-03

### Added

- npm 发布配置：`publishConfig` 把发布口固定到 `registry.npmjs.org` 并声明 `access: public`；补 `homepage`、`bugs`、MIT `LICENSE`，`files` 白名单加上 LICENSE。
- `.github/workflows/publish.yml`：推 `v*` 标签时用 npm trusted publishing（OIDC + `--provenance`）发布。发布前校验标签与版本逐字一致、版本无前导零、tarball 里该有的一样不少、不该有的一样不混。
- `package.json` 加 `test`、`check`、`prepublishOnly`：`prepublishOnly` 跑离线自测，自测不过就发布不出去。

### Changed

- `version` 改成合法 semver `2026.11.3`。semver 不允许前导零，npm 会把 `2026.11.03` 静默清理成 `2026.11.3` 并警告，标签与版本就对不上。历史段标题保持旧写法，只有新版本按合法格式写。
- `文档/机制/身份段.md` 开头同步成新的正文构成，并记下不再写语言要求的原因。
- 机制说明补进 `文档/机制/npm 发布.md`：发布口为什么固定在 npmjs、日期式版本的前导零坑、包里放什么、trusted publishing 的前置与 npm 版本要求。

### Removed

- 三份身份段删掉语言与思维链要求：「你必须使用汉语的思维方式进行思考和推理：思维链（reasoning）内容必须是中文，对用户的回答也使用中文」。汉化本身已经决定输出语言，多一句指令只会跟任务争注意力。身份段首句现在只剩身份声明与术语保留要求。

## [2026.11.01] - 2026-11-01

### Fixed

- **contexts 的翻译每步被覆盖回英文**。`SystemPrompt.refreshContext` 每个 step 按注册表原文重建 contexts，瀑布里翻好的文本只在第一步之前有效。症状是开了 Team 的会话里 `team:identity` 段一直是 `You are the Team Lead named "lead".`，而 `team:policy` 因为注册成 section 一直正常。现在包装了 `ctx.systemPrompt.refreshContext`，对返回值的 `contexts` 再翻一遍；关闭开关时原样返回，三层共用同一个包装，卸到最后一层才还原。

### Added

- 三份身份段各加两句团队协作引导：主代理分配完工作后静静等待反馈；本身已是子代理/队友时不再向下唤起，活儿重就向主代理申请加人。不点工具名，装了与没装团队插件的会话都成立。

### Changed

- 机制说明补进 `文档/机制/翻译层.md` 的「为什么还要包一层 refreshContext」，并说明它为什么不违反 `文档/机制/运行时上下文.md` 里那条「快照不翻」的结论：两阶段文本逐字相同，`RuntimeContextProjection` 的比较仍然成立。
- 自测新增 context 翻译穿过 refreshContext、两阶段文本逐字一致、关闭时原样、三层共用包装、卸载还原等断言，现共 100 项。
- 三个汉化层里「本机 chat 已被 excludePresets 排除」的注释改成与现状一致的说法。

## [2026.10.31] - 2026-10-31

### Fixed

- **工具描述与参数说明在 α 版上没被汉化**。α 0.2.2 起 `SystemPrompt.assemble` 会在瀑布之后用 tool provider 的原始 schema 覆盖 `tools`（`return { ...transformed, tools }`），瀑布里翻好的结果被原地丢掉；rc 0.2.1 是 `return transformed`，所以只有桌面版受影响。现在包装了 `ctx.systemPrompt.assemble`，对两版都生效，关闭开关时原样返回。
- 补 `subagent` 的 `provider` / `model` / `reasoning_effort` 与 `list_subagent_models` 的两个参数：α 把它们改成了短句，旧长句仍在表里。

### Added

- 三个预设各挂一行 `hide-harness-source`：遮蔽运行时上下文里的检出目录一条。桌面版那个路径指向打包后的 `resources/app.asar/dsh`，模型照着去找必然落空，还会被引离开当前项目。
- 只遮蔽 `harness:source` 这一条 context，工作目录、文件策略、审批状态与 GUI URL 照常注入；快照本身、GUI 段正文与两段系统提示词段落都不动。
- 自测加了「带装配层的宿主」：模拟 α 在瀑布后用原始 schema 覆盖 `tools`，断言工具描述仍然汉化、关闭时原样、结构不动。现共 86 项。

### Changed

- 机制说明补进 `文档/机制/运行时上下文.md`：为什么必须在 provider 层遮蔽、为什么条目要写 `required: true`。
- 机制说明补进 `文档/机制/翻译层.md`：为什么要包一层 `assemble`、装配层的覆盖顺序、工具词条为什么按句子片段收。

## [2026.10.29] - 2026-10-29

### Removed

- 删除 Chat 模式（`preset-chat` 条目、`no-global-tools` 与 `zero-injection` 两个插件）与引玉模式（`preset-yinyu` 条目、`yinyu-stage` 插件）。
- 插件只剩下雅言、仓颉、马良三个开关；`chat`、`yinyu` 两项从 Host 配置、进程内镜像与插件管理页一并移除。
- 主插件不再需要 `loader` 注入：没有预设条目要启停，只负责把三个开关发布到进程内镜像。
- 自测删掉 Chat 条目交换、零注入与引玉提示词相关断言，现共 74 项。

### Changed

- `cordis.patch.yml` 只保留主插件行与三个原生预设 override；`preset-chat`、`preset-yinyu` 及其说明一并删除。
- `package.json` 的 `exports`、关键词与描述同步收窄到三个预设。

### 升级提示

旧的 profile 里可能留着 `preset-chat` 或 `preset-yinyu` 条目（插件管理页的条目开关会写进去），本版本已无这两个预设，升级后需自行移除。

## [2026.10.28] - 2026-10-28

### Fixed

- 修复 desktop（dsh α 0.2.2-alpha.2）无法新建会话：`tool-subagent-list-agents` 行原来指向 `@deepseek-ai/dsh-tool-subagent-control/list-agents`，而 α 已删除该子路径导出、把工具并进主包，预设审计因此报 `never started` 并拒绝挂载整个预设。
- 四个预设（雅言、仓颉、马良、引玉）的该行一起改挂包内垫片 `plugins/list-agents-shim.mjs`：子包在就原样转挂，子包没了就静默退让，两版的实际工具集不变。
- `tool-subagent` 的模型选择同时写 `modelSelectionSettings`（rc）与 `modelSelection`、`modelDiscovery`（α）。schemastery 的 object 解析保留未声明的键，两版各取所需。
- 修复 Chat 模式不再零环境：宿主的 `dsh-working-directory` 以 `prepend: true` 排在瀑布最外层，`await next()` 之后又把 `required: true` 的 `working-directory:current` 补回，`refreshContext` 每步还会再补一次。现在 zero-injection 自己 prepend 收尾，并用同 scope 的同名空上下文在 provider 层遮蔽宿主的条目，运行时上下文快照不再产生。
- 修复 PTC 模式透出英文：工具描述走渲染侧折叠成单行的 JSDoc，表里带换行的键命中不了；查表两侧改为归一化空白，并补齐 present、timed `ask_user_question` 输出、`list_subagent_models` 与 bash 命令参数的新措辞。

### Changed

- 同一份 `cordis.patch.yml` 现在同时适用于 dsh rc（web）与 α（desktop）；两版 shipped 的全部差异与升级复核步骤写进 `文档/机制/双版本兼容.md`。
- 自测新增垫片行为、双版本配置键、Chat 遮蔽上下文的断言，共 118 项。
- `node plugins/audit-coverage.mjs <源码根> [yayan|cangjie|maliang]` 现在可以按预设审计覆盖率，PTC 的词条缺口靠它列出。

## [2026.10.25] - 2026-10-25

### Added

- 五个预设合并为单一插件 `@alm-allen/dsh-agent-preset`，一次安装、一个插件页。
- 插件管理页新增五个即时开关：
  - 雅言（标准模式汉化）
  - 仓颉（PTC 模式汉化）
  - 马良（创造模式汉化）
  - Chat（极简模式替换为零工具纯对话）
  - 引玉（独立新增预设）
- 四个原生预设替代默认关闭；关闭时保持原生预设不变。
- 引玉默认开启；关闭时从 Agent 预设列表移除。
- Chat 与原生 minimal 使用同一 `config.id`，开启/关闭时交换两个 Loader 条目。
- 汉化层公共机制抽到 `plugins/zh-common.mjs`；雅言、仓颉、马良只保留各自的翻译表。
- 引玉把运行时上下文提到工作区指令之前，恒定内容排在随项目变化的内容前面。
- 仓颉与引玉补上 `run_code` 用法引导：搜索探路、读改验与并行规则压进同一个程序，减少 agent 步数。
- 雅言、仓颉、马良、引玉补上表达风格约束（A 版：具体名词、一句一事、说完就停、不用装饰符号）。条款取自 `alm-code-style` §6，三份汉化层写进身份段，引玉写进 tooling context 的英文版；Chat 保持零注入不变。

### Changed

- 插件包、GitHub 仓库和目录统一命名为 `dsh-agent-preset`，包名为 `@alm-allen/dsh-agent-preset`。
- 插件管理页中文显示名改为「智能体预设」，英文显示名为「Agent Presets」。
- 五个仓库的源码、翻译层、自测与发布说明合并到一个仓库。
- 注释只保留结论，机制推导与踩坑记录移入本地 `文档/`（不进版本库）。
- 自测新增系统提示词恒定性、引玉消息顺序与用法引导等断言，共 94 项。
- 三份执行政策的正文精简；「执行政策：」与首句并为一行，`DISCIPLINE_MARK` 的兜底判断仍然有效。
- 自测里按字面空白匹配 `restrict({ allow: [] })` 的断言改为正则，源码格式变化不会再让它误报。
- 自测里两条失配的断言换上真实锚点：汉化层查中文身份句，引玉查执行政策的英文首句；原判据查的是正文里已被精简掉的「执行政策：」与 `Execution policy:` 前缀。
- 原有执行政策、提示词约束、工具翻译表与零工具契约保持不变。