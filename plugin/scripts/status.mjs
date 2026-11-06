#!/usr/bin/env node
// 体检：报告主题补丁、settings 配置，并渲染一次状态栏预览。
// 用法: node scripts/status.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { locatePackage, distPath, settingsPath, readSettings } from '../lib/locate.mjs';
import { inspect } from '../lib/theme.mjs';

const require = createRequire(import.meta.url);

function main() {
  const pkg = locatePackage();
  const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;
  const dist = distPath(pkg);
  const info = inspect(dist);
  const settings = readSettings();
  const sl = settings.statusLine || {};

  const rows = [
    ['codebuddy', version],
    ['package', pkg],
    ['dist', `${info.ok ? (info.patched ? '已打补丁' : '未打补丁') : '结构不匹配（' + info.reason + '）'} · ${fs.existsSync(dist) ? fs.statSync(dist).size : 0} B`],
    ['备份', info.ok && info.hasBackup ? path.basename(info.backup) : '无'],
    ['theme', settings.theme || '(默认)'],
    ['statusLine', sl.command ? `${sl.command}${sl.padding !== undefined ? '  padding=' + sl.padding : ''}` : '(未配置)'],
    ['settings', settingsPath()],
    ['NO_COLOR', process.env.NO_COLOR === undefined ? '未设置' : process.env.NO_COLOR],
  ];
  for (const [k, v] of rows) process.stdout.write(`${k.padEnd(11)}${v}\n`);

  // 预览：用一条合成 payload 走一遍渲染，确认状态栏可产出
  const { buildParts } = require('../lib/statusbar.cjs');
  process.stdout.write('\n预览\n  ' + buildParts({
    model: 'GLM-5.3-Flash',
    cwd: process.cwd(),
    prompt: 85900,
    completion: 549,
    cacheRead: 85000,
    usedPercentage: 32,
    ctxSize: 272000,
    turnCalls: 17,
    lastTool: 'Bash',
    durationMs: 345000,
  }) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`检查失败：${err.message}\n`);
  process.exit(1);
}
