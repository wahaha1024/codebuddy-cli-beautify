#!/usr/bin/env node
// SessionStart 钩子：确保 codebuddy 的 dark 主题补丁在位。
// 已打补丁时静默退出；未打补丁时跑一次完整安装（主题 + 状态栏）。
// 只输出一行结果，避免污染会话上下文。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { locatePackage, distPath } from '../lib/locate.mjs';
import { inspect } from '../lib/theme.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function main() {
  let pkg;
  try {
    pkg = locatePackage();
  } catch {
    return; // 没装 codebuddy，静默跳过
  }
  const dist = distPath(pkg);
  const state = inspect(dist);
  if (!state.ok) {
    process.stdout.write(`[beautify] 跳过：dist 结构不匹配（${state.reason}）\n`);
    return;
  }
  if (state.patched) return;
  try {
    execFileSync(process.execPath, [path.join(here, 'install.mjs')], {
      stdio: 'ignore',
      timeout: 25000,
    });
    process.stdout.write('[beautify] 已应用 obsidian 配色与状态栏，重启 codebuddy 后生效\n');
  } catch (err) {
    process.stdout.write(`[beautify] 安装失败：${err.message}\n`);
  }
}

main();
