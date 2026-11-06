# codebuddy-cli-beautify

给 CodeBuddy CLI 换上 **omp obsidian 配色** + **omp 风格单行状态栏**。一次安装，两处生效，不再需要零散的 `apply-obsidian-theme.mjs` / `statusline.cmd`。

```
◆ GLM-5.3-Flash · projects · ⎇ main *2 · ▰▰▰▱▱▱▱▱▱▱ 32% · ↑85.9k ↓549 · ⚡ 99.3% · ⚙ 17 Bash · ⏱ 5m45s
```

## 安装

```bash
node <本目录>/plugin/scripts/install.mjs
```

做的事情：

1. 找到 codebuddy 包（`npm root -g` / `which codebuddy` / 平台常见路径），备份 `dist/codebuddy.js` 为 `.orig-beautify`，把内置 `dark` 主题替换成 obsidian 调色板；
2. 往 `~/.codebuddy/settings.json` 写入 `theme: dark`、`statusLine` 命令、`showTokensCounter` / `showContextUsage` / `showTurnDuration`（首次会备份为 `settings.json.bak-beautify`）。

生效方式：**新开一个 codebuddy 会话**。

常用参数：

| 参数 | 作用 |
|---|---|
| `--dry-run` | 只报告将要做什么 |
| `--no-theme` | 只装状态栏 |
| `--no-statusline` | 只装配色 |
| `--style nerd\|unicode\|ascii` | 状态栏符号风格（写进提示，实际由环境变量决定） |
| `--force` | 已打过补丁也重打（换配色后使用） |

## 换配色

调色板在 `lib/theme.mjs` 的 `OBSIDIAN` 里。当前策略：对齐 Orca 里 omp 的实际观感——正文 `text`/`primary` 为空串（继承终端前景，即终端主题的冷白），`brand`/`prompt`/`spinner`/`progressBar`/`thinking` 用紫 `#9d7aff`，表格与卡片边框 `#656b83`（实测渲染为 `#6d728e`，终端色空间差异），用户消息底 `#1a1816`，次要文字 `#9da6ca`，选中 `#2a263f`，`info` 用蓝 `#6f8fae`。主页 logo 用 `#9d7aff` / `#c3a8ff`。改完执行：

```bash
node scripts/install.mjs --force --no-statusline
```

`--force` 会先用 `.orig-beautify` 备份还原、再按新调色板重打。

## 状态栏

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `CODEBUDDY_BEAUTIFY_STYLE` | `unicode` | `nerd` 用 PUA 图标（需 Nerd Font）、`unicode` 用几何符号、`ascii` 纯 ASCII |
| `CODEBUDDY_BEAUTIFY_POWERLINE` | 开 | 每段独立 ANSI 真彩背景色块（omp 风格）；设 `0` 退回单色 `·` 分隔 |
| `CODEBUDDY_BEAUTIFY_COLOR` | 开 | powerline 关闭时按 obsidian 调色板上色；设 `0` 关闭全部 ANSI |
| `CODEBUDDY_BEAUTIFY_CTX` | 取 payload | 上下文窗口大小，用于算百分比 |

段落顺序与 omp `statusLine` 一致：模型 · 目录 · git 分支与脏文件数 · 上下文进度 · 输入/输出 token · 缓存命中率 · 本轮工具调用 · 本轮耗时。

数据来自 codebuddy 传给 statusLine 的 payload；缺失时回落到 transcript 尾部 96KB 扫描。`git status` 结果按目录缓存 1.5s，避免高频重绘时反复起进程。

## 体检与卸载

```bash
node <本目录>/plugin/scripts/status.mjs      # 版本 / 补丁状态 / settings / 渲染预览
node <本目录>/plugin/scripts/uninstall.mjs   # 还原 bundle 与 settings
```

## 原理与注意事项

- CodeBuddy 的 `theme` 只接受 6 个枚举值，不支持自定义主题对象，所以配色必须**改写 bundle 里的 `dark` 主题字面量**。升级 codebuddy 会覆盖 `dist/codebuddy.js`，重跑 `install.mjs` 即可（脚本幂等）。
- 锚点：`{name:"dark",colors:{` … `}},eh={name:"light-colorblind"`。上游改动会让 `inspect()` 报 `anchor-missing`，此时脚本只提示、不写入。
- 终端必须支持真彩；环境里不能有 `NO_COLOR`——它会让 codebuddy 走全空主题，看起来"补丁没生效"。
- 状态栏命令用安装时的 `process.execPath`，换 Node 版本后重跑安装即可。
- **平台差异**：Windows 的 Windows Terminal 里 codebuddy 2.180.0 不渲染状态栏；Orca 内置终端（Electron/PTY）里同一份配置正常渲染并支持 ANSI 真彩分段。配色在两种终端都生效。

## 目录

```
.codebuddy-plugin/marketplace.json   # 本地市场定义（local-beautify）
plugin/
  .codebuddy-plugin/plugin.json
  lib/locate.mjs                     # 定位 codebuddy 包与 settings
  lib/theme.mjs                      # obsidian 调色板 + 49 键主题映射 + 补丁/还原
  lib/statusbar.cjs                  # 状态栏渲染（statusLine 入口）
  scripts/{install,uninstall,status}.mjs
```
