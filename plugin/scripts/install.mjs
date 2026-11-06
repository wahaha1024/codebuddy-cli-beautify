#!/usr/bin/env node
// 一键安装：给 codebuddy 打 obsidian 配色 + 挂上 nerd 状态栏。
// 用法: node scripts/install.mjs [--dry-run] [--no-theme] [--no-statusline] [--style nerd|unicode|ascii]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { locatePackage, distPath, settingsPath, readSettings, writeSettings } from '../lib/locate.mjs';
import { applyTheme, inspect } from '../lib/theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(here, '..');
const statusbar = path.join(pluginRoot, 'lib', 'statusbar.cjs');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes('--' + name);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const dryRun = flag('dry-run');
const force = flag('force');
const withTheme = !flag('no-theme');
const withStatus = !flag('no-statusline');
const style = opt('style', process.env.CODEBUDDY_BEAUTIFY_STYLE || 'unicode');

function main() {
  const pkg = locatePackage();
  const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;
  const dist = distPath(pkg);
  const lines = [];
  lines.push(`codebuddy ${version}`);
  lines.push(`  package  ${pkg}`);

  if (withTheme) {
    const before = inspect(dist);
    if (!before.ok) {
      lines.push(`  主题     跳过：dist 结构不匹配（${before.reason}）`);
    } else if (before.patched && !force) {
      lines.push('  主题     已应用（跳过，--force 可重打）');
    } else if (dryRun) {
      lines.push('  主题     将应用 obsidian 配色（dry-run）');
    } else {
      const r = applyTheme(dist, undefined, { force });
      lines.push(`  主题     已应用 obsidian 配色${r.backup ? `（备份 ${path.basename(r.backup)}）` : ''}`);
    }
  }

  if (withStatus) {
    if (!fs.existsSync(statusbar)) throw new Error(`缺少 ${statusbar}`);
    const cmd = `"${process.execPath}" "${statusbar}"`;
    const settingsFile = settingsPath();
    const settings = readSettings();
    const backup = settingsFile + '.bak-beautify';
    if (!dryRun) {
      if (fs.existsSync(settingsFile) && !fs.existsSync(backup)) fs.copyFileSync(settingsFile, backup);
      settings.theme = 'dark';
      settings.statusLine = { type: 'command', command: cmd, padding: 0 };
      if (settings.showTokensCounter === undefined) settings.showTokensCounter = true;
      if (settings.showContextUsage === undefined) settings.showContextUsage = true;
      if (settings.showTurnDuration === undefined) settings.showTurnDuration = true;
      writeSettings(settings);
    }
    lines.push(`  状态栏   ${dryRun ? '将写入' : '已写入'} ${settingsFile}`);
    lines.push(`           ${cmd}`);
  }

  lines.push('');
  lines.push('生效方式：新开一个 codebuddy 会话。终端需支持真彩且环境里没有 NO_COLOR。');
  lines.push(`状态栏样式：CODEBUDDY_BEAUTIFY_STYLE=${style}（可选 nerd / unicode / ascii）`);
  process.stdout.write(lines.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`安装失败：${err.message}\n`);
  process.exit(1);
}
