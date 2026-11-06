---
name: beautify
description: 给 CodeBuddy CLI 打上 omp obsidian 紫配色与多色 powerline 状态栏；也用于换配色、关闭状态栏、体检和卸载。当用户说“美化 codebuddy”“换配色”“状态栏不显示”“还原主题”时使用。
---

# CodeBuddy CLI 美化

插件自带 `SessionStart` 钩子：**已安装即自动生效**。用户首次启用插件后的下一次会话启动，`scripts/ensure.mjs` 会检测 `dist/codebuddy.js` 里有没有主题补丁，没有就跑一次完整安装并提示重启。

手动操作都用插件自带的脚本（`${CODEBUDDY_PLUGIN_ROOT}` 是插件安装目录）：

```bash
# 完整安装（主题 + 状态栏），--force 可重打
node "${CODEBUDDY_PLUGIN_ROOT}/scripts/install.mjs"

# 只打主题，不碰 settings.json 里的 statusLine
node "${CODEBUDDY_PLUGIN_ROOT}/scripts/install.mjs" --no-statusline

# 只挂状态栏，不动 bundle
node "${CODEBUDDY_PLUGIN_ROOT}/scripts/install.mjs" --no-theme

# 体检：版本 / 补丁状态 / settings / 渲染预览
node "${CODEBUDDY_PLUGIN_ROOT}/scripts/status.mjs"

# 还原 bundle 与 settings
node "${CODEBUDDY_PLUGIN_ROOT}/scripts/uninstall.mjs"
```

## 关键前提

- 终端必须支持真彩，且环境里不能有 `NO_COLOR`——它会让 codebuddy 走全空主题，看起来“补丁没生效”。
- 改的是 `@tencent-ai/codebuddy-code` 包里的 `dist/codebuddy.js`；**升级 codebuddy 会覆盖它**，重跑 `install.mjs` 即可（脚本幂等，备份在 `dist/codebuddy.js.orig-beautify`）。
- 状态栏在 Windows Terminal 里不渲染（上游 TUI 不挂载该组件），Orca 等 Electron/PTY 终端正常。

## 换配色

调色板在 `lib/theme.mjs` 的 `OBSIDIAN` 对象里，改完跑 `install.mjs --force`。`MARK` 常量是补丁指纹（用 logo 色判断是否已打），换 logo 色时同步改它，否则自检会报 `补丁自检失败`。

## 状态栏开关

| 变量 | 默认 | 作用 |
|---|---|---|
| `CODEBUDDY_BEAUTIFY_STYLE` | `unicode` | `nerd` / `unicode` / `ascii` |
| `CODEBUDDY_BEAUTIFY_POWERLINE` | 开 | 设 `0` 退回单色 `·` 分隔 |
| `CODEBUDDY_BEAUTIFY_COLOR` | 开 | powerline 关闭时是否上色 |
| `CODEBUDDY_BEAUTIFY_CTX` | 取 payload | 上下文窗口大小 |

## 排查顺序

1. `status.mjs` 看 `patched` 是否为 true；false 说明 bundle 被升级覆盖了。
2. 看环境里有没有 `NO_COLOR`。
3. 状态栏不显示：确认终端是 Orca 之类的 PTY，不是 Windows Terminal。
4. 颜色不对：`git diff` 插件里的 `lib/theme.mjs`，确认 `MARK` 与实际 brand/logo 一致。
