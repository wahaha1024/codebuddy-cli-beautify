# codebuddy-cli-beautify

给 CodeBuddy CLI 换上 **omp obsidian 配色** + **omp 风格单行状态栏**。一次安装，两处生效，不再需要零散的 `apply-obsidian-theme.mjs` / `statusline.cmd`。6 个可选主题全部适配：深色系用深紫 obsidian，亮色系自动换成高对比深紫与深色正文，色盲变体保留原有色相语义；状态栏也随当前主题切换明暗配色。

```
◆ GLM-5.3-Flash · projects · ⎇ main *2 · ▰▰▰▱▱▱▱▱▱▱ 32% · ↑85.9k ↓549 · ⚡ 99.3% · ⚙ 17 Bash · ⏱ 5m45s
```

## 安装

```bash
node <本目录>/plugin/scripts/install.mjs
```

做的事情：

1. 找到 codebuddy 包（`npm root -g` / `which codebuddy` / 平台常见路径），备份 `dist/codebuddy.js` 为 `.orig-beautify`，把内置 6 个主题（`dark*` / `light*`）按明暗分别替换成 obsidian 调色板；`nocolor` 不改写；
2. 往 `~/.codebuddy/settings.json` 写入 `statusLine` 命令、`showTokensCounter` / `showContextUsage` / `showTurnDuration`（首次会备份为 `settings.json.bak-beautify`）。未设置 `theme` 时默认 `dark`，**已选主题保持不变**（含 `light-colorblind`）。

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

调色板在 `lib/theme.mjs` 里，按主题分组：

| 对象 | 适用主题 | 说明 |
|---|---|---|
| `OBSIDIAN` | `dark` / `dark-ansi` | 深紫 `#9d7aff`，正文继承终端前景 |
| `OBSIDIAN_DARK_COLORBLIND` | `dark-colorblind` | 保留蓝/橙/黄色相，避开红绿 |
| `OBSIDIAN_LIGHT` | `light` / `light-ansi` | 深紫 `#6a3fb0` + 深色正文 `#1f2328`，白底高对比 |
| `OBSIDIAN_LIGHT_COLORBLIND` | `light-colorblind` | 深紫主色 + 蓝/橙/黄色相 |
| `BASE.dark` / `BASE.light` | 结构色 | 行底、边框、选中、diff 底、hint 等按明暗分开 |

`buildTheme(palette, mode)` 负责把调色板映射成 codebuddy 的 49 键主题对象。改完执行：

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
| `CODEBUDDY_BEAUTIFY_THEME` | 取 settings | 强制 `light` / `dark` 配色（默认自动跟随当前主题） |

段落顺序与 omp `statusLine` 一致：模型 · 目录 · git 分支与脏文件数 · 上下文进度 · 输入/输出 token · 缓存命中率 · 本轮工具调用 · 本轮耗时。

数据来自 codebuddy 传给 statusLine 的 payload；缺失时回落到 transcript 尾部 96KB 扫描。`git status` 结果按目录缓存 1.5s，避免高频重绘时反复起进程。

## 体检与卸载

```bash
node <本目录>/plugin/scripts/status.mjs      # 版本 / 补丁状态 / settings / 渲染预览
node <本目录>/plugin/scripts/uninstall.mjs   # 还原 bundle 与 settings
```

## 原理与注意事项

- CodeBuddy 的 `theme` 只接受几个枚举值，不支持自定义主题对象，所以配色必须**改写 bundle 里的主题字面量**。6 个可选主题逐个改写；升级 codebuddy 会覆盖 `dist/codebuddy.js`，重跑 `install.mjs` 即可（脚本幂等，只补未打的主题）。
- 锚点：每个主题的 `{name:"X",colors:{` 对象，`colorsSpan()` 用括号配对定位。上游改动会让 `inspect()` 报 `anchor-missing`，此时脚本只提示、不写入。
- 补丁指纹：`logo.edge` 颜色。深主题 `#9d7aff`，亮主题 `#6a3fb0`；换 logo 色时要同步改 `lib/theme.mjs` 的 `MARKS`。
- 亮色主题下终端背景也应是亮的；若终端本身是深底却选了 `light` 主题，深色正文会看不清，这是上游 `light` 主题本身的行为。
- 状态栏配色跟随 `settings.json` 的 `theme`：以 `light` 开头用亮色版 powerline，其余用深色版。可用 `CODEBUDDY_BEAUTIFY_THEME=light|dark` 强制覆盖。
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
