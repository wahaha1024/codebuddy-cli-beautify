#!/usr/bin/env node
// 卸载：还原 dist/codebuddy.js 并撤销 settings 里的状态栏配置。
// 用法: node scripts/uninstall.mjs [--dry-run] [--keep-statusline]
import fs from 'node:fs';
import { locatePackage, distPath, settingsPath, readSettings, writeSettings } from '../lib/locate.mjs';
import { revertTheme, inspect } from '../lib/theme.mjs';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const keepStatus = argv.includes('--keep-statusline');

function main() {
  const pkg = locatePackage();
  const dist = distPath(pkg);
  const out = [];

  const info = inspect(dist);
  if (info.ok && info.hasBackup) {
    if (dryRun) {
      out.push('主题     将还原 dist/codebuddy.js（dry-run）');
    } else {
      revertTheme(dist);
      out.push('主题     已还原 dist/codebuddy.js');
    }
  } else {
    out.push(info.ok && info.patched
      ? '主题     已打补丁但没有备份，无法还原'
      : '主题     无需还原');
  }

  if (!keepStatus) {
    const file = settingsPath();
    const backup = file + '.bak-beautify';
    const settings = readSettings();
    let original = null;
    try { original = JSON.parse(fs.readFileSync(backup, 'utf8')); } catch { original = null; }

    if (original && original.statusLine) settings.statusLine = original.statusLine;
    else delete settings.statusLine;
    if (original && original.theme) settings.theme = original.theme;
    if (original) {
      for (const k of ['showTokensCounter', 'showContextUsage', 'showTurnDuration']) {
        if (original[k] === undefined) delete settings[k];
        else settings[k] = original[k];
      }
    }
    if (!dryRun) writeSettings(settings);
    out.push(`状态栏   ${dryRun ? '将撤销' : '已撤销'} ${file}`);
  }

  process.stdout.write(out.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`卸载失败：${err.message}\n`);
  process.exit(1);
}
