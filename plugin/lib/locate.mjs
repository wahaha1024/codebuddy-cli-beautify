// 定位 codebuddy 的安装目录（含 dist/codebuddy.js 的包根）。
// 解析顺序：显式覆盖 → npm 全局 root → which/where 反查 → 平台已知路径。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const PKG_NAME = '@tencent-ai/codebuddy-code';

function tryExec(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)[0]
      .trim();
  } catch {
    return '';
  }
}

function isPkgRoot(dir) {
  try {
    const pj = path.join(dir, 'package.json');
    if (!fs.existsSync(pj)) return false;
    const meta = JSON.parse(fs.readFileSync(pj, 'utf8'));
    return meta.name === PKG_NAME;
  } catch {
    return false;
  }
}

function candidates() {
  const out = [];
  if (process.env.CODEBUDDY_HOME) out.push(path.join(process.env.CODEBUDDY_HOME, 'node_modules', PKG_NAME));

  const npmRoot = tryExec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g']);
  if (npmRoot) out.push(path.join(npmRoot, PKG_NAME));

  const which = tryExec(process.platform === 'win32' ? 'where' : 'which', ['codebuddy']);
  if (which) {
    let dir = path.dirname(which);
    for (let i = 0; i < 6; i++) {
      out.push(dir);
      out.push(path.join(dir, PKG_NAME));
      out.push(path.join(dir, 'node_modules', PKG_NAME));
      dir = path.dirname(dir);
    }
    try {
      const real = fs.realpathSync(which);
      let d = path.dirname(real);
      for (let i = 0; i < 6; i++) {
        out.push(d);
        d = path.dirname(d);
      }
    } catch { /* 忽略 */ }
  }

  const home = os.homedir();
  if (process.platform === 'win32') {
    out.push(path.join(home, 'AppData', 'Roaming', 'npm', 'node_modules', PKG_NAME));
    out.push(path.join(home, 'AppData', 'Local', 'npm', 'node_modules', PKG_NAME));
  } else {
    out.push(path.join(home, '.npm-global', 'lib', 'node_modules', PKG_NAME));
    out.push(path.join(home, '.local', 'lib', 'node_modules', PKG_NAME));
    out.push('/usr/local/lib/node_modules/' + PKG_NAME);
    out.push('/usr/lib/node_modules/' + PKG_NAME);
    for (const base of ['/www/server/nodejs', '/www/server/node']) {
      let entries = [];
      try { entries = fs.readdirSync(base); } catch { continue; }
      for (const v of entries) out.push(path.join(base, v, 'lib', 'node_modules', PKG_NAME));
    }
  }
  return [...new Set(out)];
}

export function locatePackage() {
  for (const dir of candidates()) {
    if (isPkgRoot(dir)) return dir;
  }
  throw new Error(`找不到 ${PKG_NAME}。设置 CODEBUDDY_HOME 指向其 node_modules 的上级目录后重试。`);
}

export function distPath(pkgRoot) {
  return path.join(pkgRoot, 'dist', 'codebuddy.js');
}

export function settingsPath() {
  return path.join(os.homedir(), '.codebuddy', 'settings.json');
}

export function readSettings() {
  const p = settingsPath();
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

export function writeSettings(obj) {
  const p = settingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return p;
}
