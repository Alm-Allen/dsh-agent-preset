# dsh-preset-pack

把四个 **DeepSeek Harness（dsh）** Agent 预设合并成一个插件：

- **雅言**：把原生 **标准模式（standard）** 切换为中文；
- **仓颉**：把原生 **PTC 模式（ptc）** 切换为中文；
- **马良**：把原生 **创造模式（cordis）** 切换为中文；
- **引玉**：新增一个独立预设——一句极简系统提示词 + PTC 的 `run_code` 工具环境。

安装一次，到 **侧栏 → 插件 → 四预设合集** 的插件页里分别开关。不再需要为每个预设各装一个插件。

| 开关 | 默认 | 关闭时 | 打开时 |
|---|---|---|---|
| 雅言 · 标准模式 | **关** | 原生英文标准模式，逐字节保持出厂组合 | 标准模式改为中文提示词与工具说明 |
| 仓颉 · PTC 模式 | **关** | 原生英文 PTC 模式 | PTC 模式改为中文提示词与 `run_code` 说明 |
| 马良 · 创造模式 | **关** | 原生英文创造模式 | 创造模式改为中文提示词、工具与技能目录说明 |
| 引玉 · 独立预设 | **开** | 从 Agent 预设列表移除 | 保留在 Agent 预设列表 |

“关闭”不是卸载整个插件：三个原生预设的 override 仍在，但汉化层每次组装时先看开关，关闭就直接原样返回；因此关掉之后看到的就是当前 dsh 自带的英文预设。引玉没有原生版本可回退，关闭时由主插件把 `preset-yinyu` 这个 Loader 条目停用。

## 安装

**插件页**：**插件** → **添加插件** → 输入

```
github:Alm-Allen/dsh-preset-pack
```

**命令行**（`--profile` 换成 profile 名，网页端通常是 `web`）：

```sh
dsh plugin --profile web add github:Alm-Allen/dsh-preset-pack
```

装完重启 dsh、刷新页面。插件详情页会出现四个即时保存的开关；改完不需要重装或重启。

从旧的四个独立包迁移时，先移除：

```sh
dsh plugin --profile web remove @alm-allen/dsh-yayan-preset
dsh plugin --profile web remove @alm-allen/dsh-cangjie-preset
dsh plugin --profile web remove @alm-allen/dsh-maliang-preset
dsh plugin --profile web remove @alm-allen/dsh-yinyu-preset
```

再安装本包。两个版本同时安装会重复 override/注册同名预设，不要并存。

## 行为细节

### 三个原生预设

`cordis.patch.yml` 按 Loader 行 id 覆盖随 dsh 出货的 `preset-standard`、`preset-ptc`、`preset-cordis`。每份 `config` 都完整重述出厂的插件列表，再追加各自的汉化层：

- `yayan-zh`：标准模式；
- `cangjie-zh`：PTC 模式；
- `maliang-zh`：创造模式。

汉化层只在开关打开时修改 `system-prompt/assemble` 的渲染结果与 `agent/pre-step` 注入的技能目录说明；开关关闭时两个监听器都直接调用 `next()`，不碰内容。原生预设的 persona、顺序与工具集不变，所以关闭状态等价于当前 dsh 的原生预设（代价仍是 override 冻结整份 `config`，升级 dsh 后要核对 shipped 行）。

### 引玉

`preset-yinyu` 是新增条目，不属于“原生预设替代汉化”，默认开启。主插件 `plugins/preset-pack.mjs` 读它的 volatile 开关并直接更新该 Loader 条目的 `disabled` 状态；配置本身由 dsh 设置文档持久化，启动时会再次落到条目上。

### 开关的三处默认值

服务端 `plugins/preset-pack.mjs`、进程内镜像 `plugins/preset-state.mjs`、浏览器配置卡 `plugins/client.js` 各保存一份默认值，必须同时改：

```js
yayan: false
cangjie: false
maliang: false
yinyu: true
```

### 提示词约束

- identity 段是常量，不写工作目录、时间、时区或提示词变量；
- 不修改运行时上下文的落地文本，否则会触发快照反复重发；
- 三个汉化层各自保存执行政策正文，不从别的文件共享；
- 工具名、参数名、代码、命令、路径保持原文。

## 包结构

```
dsh-preset-pack/
├── package.json              插件清单、dsh.bundle.patch、dsh.client
├── cordis.patch.yml          一个主插件行 + 四个预设组合
├── plugins/
│   ├── preset-pack.mjs       开关服务端：发布镜像、启停引玉条目
│   ├── preset-state.mjs      四个开关的进程内镜像
│   ├── client.js             插件管理页配置卡（手写浏览器 bundle）
│   ├── yayan-zh.mjs          标准模式汉化层
│   ├── cangjie-zh.mjs        PTC 模式汉化层
│   ├── maliang-zh.mjs        创造模式汉化层
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

自测覆盖：包清单与导出文件、四个预设组合、三份默认关闭与引玉默认开启、汉化层关闭直通/开启替换、identity 常量、客户端 bundle 的注册协议。
