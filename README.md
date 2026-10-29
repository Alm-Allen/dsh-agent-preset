# 智能体预设（dsh-agent-preset）

把三个 **DeepSeek Harness（DSH）** Agent 预设的汉化层装进一个插件，并在插件管理页逐个开关。插件在 DSH 中显示为 **智能体预设**。

| 预设 | 作用 | 默认 | 关闭时 |
|---|---|---|---|
| 雅言 | 把原生标准模式（standard）汉化 | 关 | DSH 出货的英文标准模式 |
| 仓颉 | 把原生 PTC 模式（ptc）汉化 | 关 | DSH 出货的英文 PTC 模式 |
| 马良 | 把原生创造模式（cordis）汉化 | 关 | DSH 出货的英文创造模式 |

安装一次即可管理全部三项，不必为每个预设各装一个插件。

本插件只覆盖这三个原生预设，不新增预设，也不替换极简模式。

## 安装

### 插件管理页

打开 **插件 → 添加插件**，输入：

```text
github:Alm-Allen/dsh-agent-preset
```

### 命令行

把 `web` 换成实际使用的 profile 名：

```sh
dsh plugin --profile web add github:Alm-Allen/dsh-agent-preset
```

安装后重启 DSH，并刷新网页。插件详情页会出现三个开关；开关保存后立即生效，不需要重装插件或重启 DSH。

### 从旧插件迁移

如果装过合并前的五个独立包，先移除它们：

```sh
dsh plugin --profile web remove @alm-allen/dsh-yayan-preset
dsh plugin --profile web remove @alm-allen/dsh-cangjie-preset
dsh plugin --profile web remove @alm-allen/dsh-maliang-preset
dsh plugin --profile web remove @alm-allen/dsh-chat-preset
dsh plugin --profile web remove @alm-allen/dsh-yinyu-preset
```

再安装本插件。新旧包同时存在会重复覆盖预设或注册同名预设。

如果曾用插件管理页的条目开关手动启用过 Chat 或引玉，profile 里会留下 `preset-chat`、`preset-yinyu` 两条；本版本已删除这两个预设，升级后需自行移除这两条。

## 使用

打开 **插件 → 智能体预设**，按需切换：

- **雅言、仓颉、马良** 是原生预设替代，默认关闭。关闭时对应预设与当前 DSH 出货版本逐项一致。
- 开关即时保存。新会话使用当前预设列表；已有会话继续使用创建时选中的预设版本。

## 兼容性

当前基准是 **dsh 0.2.1-rc.4**（web）与 **0.2.2-alpha.2**（desktop）。插件通过 `cordis.patch.yml` 完整覆盖三个原生预设，因此升级 DSH 后需要重新核对出货预设，尤其是 `standard`、`ptc`、`cordis` 的插件行。

包内没有构建步骤：`plugins/` 与 `cordis.patch.yml` 就是发布产物。

## 开发

要求 Node.js `^22.19.0 || >=24.0.0`。

```sh
npm install
node plugins/self-test.mjs
```

自测覆盖包清单、三个预设组合、开关默认值、汉化层关闭直通与开启替换，以及浏览器客户端注册协议。

机制说明与踩坑记录在 `文档/`（本目录不进 git 追踪）；代码注释只留结论并指回对应那篇。

单独检查语法：

```sh
node --check plugins/agent-preset.mjs
node --check plugins/client.js
```

### 包结构

```text
dsh-agent-preset/
├── package.json              插件清单、bundle patch、web 客户端入口
├── cordis.patch.yml          主插件 + 三个原生预设覆盖
├── plugins/
│   ├── agent-preset.mjs      开关服务端：把三个开关发布到进程内镜像
│   ├── preset-state.mjs      三个开关的进程内镜像
│   ├── client.js             插件管理页配置卡
│   ├── zh-common.mjs         三份汉化层共用的替换机制
│   ├── yayan-zh.mjs          雅言汉化层
│   ├── cangjie-zh.mjs        仓颉汉化层
│   ├── maliang-zh.mjs        马良汉化层
│   ├── list-agents-shim.mjs  rc 与 α 的 list_agents 行垫片
│   ├── self-test.mjs         离线契约测试
│   └── audit-coverage.mjs    翻译覆盖率审计
├── locale/{zh,en}.json       插件管理页显示名与描述
├── README.md
└── CHANGELOG.md
```

发布标签使用 `v<package.json version>`；推送标签后，`.github/workflows/release.yml` 会运行自测并创建 GitHub Release。

## 许可证

MIT
