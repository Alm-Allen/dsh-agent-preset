# Changelog

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
