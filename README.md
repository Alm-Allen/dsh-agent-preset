# dsh-preset-pack

把五个 **DeepSeek Harness（dsh）** Agent 预设合并成一个插件：

- **雅言**：把原生 **标准模式（standard）** 汉化；
- **仓颉**：把原生 **PTC 模式（ptc）** 汉化；
- **马良**：把原生 **创造模式（cordis）** 汉化；
- **Chat**：把原生 **极简模式（minimal）** 换成零工具、零系统提示词注入的纯对话组合；
- **引玉**：新增一个独立预设——一句极简系统提示词 + PTC 的 `run_code` 工具环境。

安装一次，到 **侧栏 → 插件 → 五预设合集** 的插件页里分别开关。不需要为每个预设各装一个插件。

| 开关 | 默认 | 关闭时 | 打开时 |
|---|---|---|---|
| 雅言 · 标准模式 | **关** | 原生英文标准模式 | 标准模式改为中文提示词与工具说明 |
| 仓颉 · PTC 模式 | **关** | 原生英文 PTC 模式 | PTC 模式改为中文提示词与 `run_code` 说明 |
| 马良 · 创造模式 | **关** | 原生英文创造模式 | 创造模式改为中文提示词、工具与技能目录说明 |
| Chat · 极简模式 | **关** | 原生极简模式 | 替换为零工具、零系统提示词的纯对话模式 |
| 引玉 · 独立预设 | **开** | 从 Agent 预设列表移除 | 保留在 Agent 预设列表 |

三份汉化关闭时，对应预设与当前 dsh 的 shipped 组合逐项一致；Chat 关闭时原生 `minimal` 保持原样。打开 Chat 时，主插件先停用原生 `preset-minimal`，再启用同 `config.id: minimal` 的 `preset-chat`；关闭时反向交换，所以预设列表里始终只有其中一个，已有 `minimal` 绑定也不会丢。

引玉没有原生版本可回退，关闭时由主插件停用 `preset-yinyu` Loader 条目。

## 安装

**插件页**：**插件** → **添加插件** → 输入

```
github:Alm-Allen/dsh-preset-pack
```

**命令行**（`--profile` 换成 profile 名，网页端通常是 `web`）：

```sh
dsh plugin --profile web add github:Alm-Allen/dsh-preset-pack
```

装完重启 dsh、刷新页面。插件详情页会出现五个即时保存的开关；改完不需要重装或重启。

从旧的五个独立包迁移时，先移除：

```sh
dsh plugin --profile web remove @alm-allen/dsh-yayan-preset
dsh plugin --profile web remove @alm-allen/dsh-cangjie-preset
dsh plugin --profile web remove @alm-allen/dsh-maliang-preset
dsh plugin --profile web remove @alm-allen/dsh-chat-preset
dsh plugin --profile web remove @alm-allen/dsh-yinyu-preset
```

再安装本包。两个版本同时安装会重复 override 或注册同名预设，不要并存。

## 行为细节

### 四个原生预设替代

`cordis.patch.yml` 覆盖随 dsh 出货的 `preset-standard`、`preset-ptc`、`preset-cordis`，并 insert 一个默认停用的 `preset-chat`。

- `yayan-zh`：标准模式汉化；
- `cangjie-zh`：PTC 模式汉化；
- `maliang-zh`：创造模式汉化；
- `preset-chat`：与原生 `preset-minimal` 交换，内部挂 `no-global-tools` 与 `zero-injection`。

三个汉化层只在开关打开时修改 `system-prompt/assemble` 的渲染结果与 `agent/pre-step` 注入的技能目录说明；关闭时两个监听器都直接调用 `next()`，不碰内容。原生 persona、计划模式文本与工具集保持 shipped 版本。

Chat 只在开关打开时替换原生 minimal：`persona` 用空前缀 + `complete: true` + `includeRuntimeContext: false` 得到零系统提示词；`no-global-tools` 用 `tools.restrict({ allow: [] })` 摘掉继承工具；`zero-injection` 在组装末端清空 `tools` 与 `contexts`，挡住 Agent 作用域注入。

代价仍是 override/insert 会冻结组合：升级 dsh 后要重新核对 shipped 预设，特别是 `minimal` 与三个汉化预设的插件行。

### 引玉

`preset-yinyu` 是新增条目，不属于原生替代，默认开启。主插件读它的 volatile 开关并直接更新该 Loader 条目的 `disabled` 状态；配置本身由 dsh 设置文档持久化，启动时再次落到条目上。

### 开关的默认值三处一致

服务端 `plugins/preset-pack.mjs`、进程内镜像 `plugins/preset-state.mjs`、浏览器配置卡 `plugins/client.js` 各保存一份默认值，必须同时改：

```js
yayan: false
cangjie: false
maliang: false
chat: false
yinyu: true
```

### 提示词约束

- identity 段是常量，不写工作目录、时间、时区或提示词变量；
- 不修改运行时上下文的落地文本，否则会触发快照反复重发；
- 三份汉化层与引玉各自保存执行政策正文，不抽成单一共享常量；
- 工具名、参数名、代码、命令、路径保持原文；
- plan mode 的英文原文保留在 YAML 里，由开关打开时的翻译层负责汉化。

## 包结构

```
dsh-preset-pack/
├── package.json              插件清单、dsh.bundle.patch、dsh.client
├── cordis.patch.yml          一个主插件行 + 三个 override + Chat/引玉 insert
├── plugins/
│   ├── preset-pack.mjs       开关服务端：发布镜像、交换 Chat、启停引玉
│   ├── preset-state.mjs      五个开关的进程内镜像
│   ├── client.js             插件管理页配置卡（手写浏览器 bundle）
│   ├── yayan-zh.mjs          标准模式汉化层
│   ├── cangjie-zh.mjs        PTC 模式汉化层
│   ├── maliang-zh.mjs        创造模式汉化层
│   ├── no-global-tools.mjs   Chat：摘掉继承工具
│   ├── zero-injection.mjs    Chat：清空 tools/contexts 兜底
│   ├── yinyu-stage.mjs       引玉的提示词/SDK 重排
│   ├── self-test.mjs         离线契约测试
│   └── audit-coverage.mjs    翻译覆盖率审计
├── locale/{zh,en}.json       插件卡片标题与描述
├── README.md
└── CHANGELOG.md
```

## 自测

```sh
node plugins/self-test.mjs
```

自测覆盖：包清单与导出文件、五个预设组合、四个原生替代默认关闭与引玉默认开启、汉化层关闭直通/开启替换、Chat 的交换顺序与零注入模块、identity 常量、客户端 bundle 注册协议。
