# Changelog

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
