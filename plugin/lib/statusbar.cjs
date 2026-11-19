#!/usr/bin/env node
'use strict';

/*
 * statusbar — 仿 omp statusLine（preset: nerd）的单行状态栏
 *
 * 两种输入：
 *   1. statusLine 模式：stdin 收 codebuddy 的 Status payload（含 transcript_path）
 *   2. 调试模式：node statusbar.js <transcript.jsonl>
 *
 * 输出（段序对齐 omp statusLine：model · path · git · context · spend）：
 *   ◆ GLM-5.3-Flash · sbtest · ⎇ main *2 · ▰▰▰▱▱▱▱▱▱▱ 32% · ↑85.9k ↓549 · ⚡ 99.3% · ⚙ 17 Bash · ⏱ 5m45s
 *
 * 环境变量（全部可选）：
 *   CODEBUDDY_BEAUTIFY_CTX    上下文窗口大小（默认取 payload，其次 272000）
 *   CODEBUDDY_BEAUTIFY_STYLE  nerd | unicode | ascii（默认 unicode）
 *   CODEBUDDY_BEAUTIFY_COLOR  1 开启 ANSI 真彩（默认 0）
 *   CODEBUDDY_BEAUTIFY_THEME  覆盖主题（dark | light，默认读 settings.json）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const TAIL_BYTES = 96 * 1024;
const GIT_TTL_MS = 1500;

const SYMBOLS = {
  nerd: {
    model: '\uF085', dir: '\uF07B', git: '\uE0A0', bar: ['\u2588', '\u2591'],
    in: '\uF062', out: '\uF063', cache: '\uF0E7', tools: '\uF0AD', time: '\uF017',
    sep: '  ',
  },
  unicode: {
    model: '\u25C6', dir: '\u2302', git: '\u2387', bar: ['\u25B0', '\u25B1'],
    in: '\u2191', out: '\u2193', cache: '\u26A1', tools: '\u2699', time: '\u23F1',
    sep: ' \u00B7 ',
  },
  ascii: {
    model: '>', dir: '~', git: 'git:', bar: ['#', '-'],
    in: '^', out: 'v', cache: '%', tools: 'x', time: 't',
    sep: ' | ',
  },
};

// 状态栏配色分深浅两套，亮色主题下用深色文字和高对比深紫，避免白底看不清。
const STATUS_HEX = {
  dark: {
    accent: '#c45a3a', text: '#cac5bd', muted: '#5a524b', dim: '#4a433d',
    success: '#6a9a6a', warn: '#d97651', info: '#6f8fae',
  },
  light: {
    accent: '#6a3fb0', text: '#1f2328', muted: '#57606a', dim: '#8b949e',
    success: '#1a7f37', warn: '#9a6700', info: '#0b62b3',
  },
};

const POWERLINE_HEX = {
  dark: {
    bg: { accent: '#9d7aff', a: '#343a52', b: '#2a2f45' },
    fg: {
      onAccent: '#1a1b26', text: '#c0caf5', muted: '#565f89',
      success: '#9ece6a', warn: '#e0af68', info: '#7aa2f7', accent: '#9d7aff',
    },
  },
  light: {
    bg: { accent: '#6a3fb0', a: '#eceff6', b: '#e3e7f0' },
    fg: {
      onAccent: '#ffffff', text: '#1f2328', muted: '#57606a',
      success: '#1a7f37', warn: '#9a6700', info: '#0b62b3', accent: '#6a3fb0',
    },
  },
};

const RESET = '\x1b[0m';

function channels(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function fg(hex) {
  const [r, g, b] = channels(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(hex) {
  const [r, g, b] = channels(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

function buildEsc(hexMap) {
  const out = { reset: RESET };
  for (const k of Object.keys(hexMap)) out[k] = fg(hexMap[k]);
  return out;
}

function buildPowerline(hexMap) {
  const out = { bg: {}, fg: {} };
  for (const k of Object.keys(hexMap.bg)) out.bg[k] = bg(hexMap.bg[k]);
  for (const k of Object.keys(hexMap.fg)) out.fg[k] = fg(hexMap.fg[k]);
  return out;
}

const ESC = {
  dark: buildEsc(STATUS_HEX.dark),
  light: buildEsc(STATUS_HEX.light),
};
const POWERLINE = {
  dark: buildPowerline(POWERLINE_HEX.dark),
  light: buildPowerline(POWERLINE_HEX.light),
};

// statusLine 每几百毫秒调用一次，settings 按 mtime 缓存，主题切换后立即跟上。
let themeCache = { mtime: -1, mode: 'dark' };
function activeThemeMode() {
  const override = String(process.env.CODEBUDDY_BEAUTIFY_THEME || '').toLowerCase();
  if (override === 'light' || override.startsWith('light')) return 'light';
  if (override === 'dark' || override.startsWith('dark')) return 'dark';
  try {
    const p = path.join(os.homedir(), '.codebuddy', 'settings.json');
    const st = fs.statSync(p);
    if (st.mtimeMs !== themeCache.mtime) {
      let theme = 'dark';
      try { theme = JSON.parse(fs.readFileSync(p, 'utf8')).theme || 'dark'; } catch { /* 用默认 */ }
      themeCache = { mtime: st.mtimeMs, mode: String(theme).startsWith('light') ? 'light' : 'dark' };
    }
    return themeCache.mode;
  } catch {
    return themeCache.mode;
  }
}

function paint(text, colorName, pal) {
  if (!process.env.CODEBUDDY_BEAUTIFY_COLOR) return text;
  const c = pal[colorName];
  return c ? c + text + pal.reset : text;
}

function readTailLines(filePath, bytes) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    let text = buf.toString('utf8');
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    const out = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch { /* 跳过坏行 */ }
    }
    return out;
  } catch {
    return [];
  } finally {
    try { if (fd !== undefined) fs.closeSync(fd); } catch { /* noop */ }
  }
}

function usageOf(entry) {
  const raw = entry && entry.providerData && entry.providerData.rawUsage;
  if (raw && typeof raw.prompt_tokens === 'number') {
    const cached = raw.prompt_cache_hit_tokens
      || raw.cache_read_input_tokens
      || (raw.prompt_tokens_details && raw.prompt_tokens_details.cached_tokens)
      || raw.cached_tokens
      || 0;
    return {
      prompt: raw.prompt_tokens || 0,
      completion: raw.completion_tokens || 0,
      cacheRead: cached,
    };
  }
  const u = entry && entry.message && entry.message.usage;
  if (u && typeof u.input_tokens === 'number') {
    return { prompt: u.input_tokens || 0, completion: u.output_tokens || 0, cacheRead: 0 };
  }
  return null;
}

// 从 transcript 尾部提取本轮活动（工具调用、耗时、最新模型、用量）
function scanTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  const lines = readTailLines(transcriptPath, TAIL_BYTES);
  if (!lines.length) return null;

  let model = null, cwd = null, usage = null, turnMetrics = null;
  let lastUserIdx = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const e = lines[i];
    if (model === null && e.providerData) {
      model = e.providerData.requestModelName || e.providerData.model || null;
    }
    if (cwd === null && typeof e.cwd === 'string' && e.cwd) cwd = e.cwd;
    if (turnMetrics === null && e.type === 'turn-metrics') turnMetrics = e;
    if (usage === null) usage = usageOf(e);
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const e = lines[i];
    if (e.type === 'message' && e.role === 'user') { lastUserIdx = i; break; }
  }

  let turnOut = 0, turnCalls = 0, turnStart = 0, turnEnd = 0, lastTool = null;
  for (let i = lastUserIdx + 1; i < lines.length; i++) {
    const e = lines[i];
    if (typeof e.timestamp === 'number') {
      if (!turnStart) turnStart = e.timestamp;
      turnEnd = Math.max(turnEnd, e.timestamp);
    }
    if (e.type === 'function_call') {
      turnCalls++;
      const n = (e.name || (e.providerData && e.providerData.name) || '').trim();
      if (n) lastTool = n;
    }
    const u = usageOf(e);
    if (u) turnOut += u.completion;
  }
  if (lastUserIdx >= 0 && lines[lastUserIdx] && typeof lines[lastUserIdx].timestamp === 'number') {
    turnStart = lines[lastUserIdx].timestamp;
  }

  return {
    model,
    cwd,
    usage,
    turnCalls,
    lastTool,
    turnOutput: turnOut,
    durationMs: turnMetrics && turnMetrics.durationMs
      ? turnMetrics.durationMs
      : Math.max(0, turnEnd - turnStart),
  };
}

// statusLine 每几百毫秒调用一次，git 是唯一的外部进程开销：按 cwd 做 1.5s 文件缓存
function gitInfo(cwd) {
  if (!cwd) return null;
  const key = crypto.createHash('md5').update(cwd).digest('hex').slice(0, 10);
  const cacheFile = path.join(os.tmpdir(), `codebuddy-beautify-git-${key}.json`);
  try {
    const st = fs.statSync(cacheFile);
    if (Date.now() - st.mtimeMs < GIT_TTL_MS) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
  } catch { /* 无缓存或已损坏 */ }

  let result = null;
  const r = spawnSync('git', ['-C', cwd, 'status', '--porcelain=v1', '--branch'], {
    encoding: 'utf8', timeout: 800,
  });
  if (r.status === 0 && r.stdout) {
    const lines = String(r.stdout).split('\n');
    const m = /^## ([^.\s]+)/.exec(lines[0] || '');
    if (m) result = { branch: m[1], dirty: lines.slice(1).filter((l) => l.trim()).length };
  }
  try { fs.writeFileSync(cacheFile, JSON.stringify(result)); } catch { /* 忽略 */ }
  return result;
}

function fmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n || 0);
}

function fmtDuration(ms) {
  const s = (ms || 0) / 1000;
  if (s < 1) return '0s';
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${Math.round(s - m * 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h${m - h * 60}m`;
}

function progressBar(pct, glyphs, width) {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return glyphs.bar[0].repeat(filled) + glyphs.bar[1].repeat(width - filled);
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s) {
  return s.replace(ANSI_RE, '');
}

function buildParts(state) {
  const style = String(process.env.CODEBUDDY_BEAUTIFY_STYLE || 'unicode').toLowerCase();
  const g = SYMBOLS[style] || SYMBOLS.unicode;
  const ctxSize = state.ctxSize || parseInt(process.env.CODEBUDDY_BEAUTIFY_CTX, 10) || 272000;
  const mode = activeThemeMode();
  const pal = ESC[mode];
  const pl = POWERLINE[mode];

  const prompt = state.prompt || 0;
  const pct = state.usedPercentage != null
    ? Math.min(100, state.usedPercentage)
    : (ctxSize > 0 ? Math.min(100, (prompt / ctxSize) * 100) : 0);
  const hit = prompt > 0 ? ((state.cacheRead || 0) / prompt) * 100 : 0;
  const dir = state.cwd ? (path.basename(state.cwd) || state.cwd) : '';
  const git = gitInfo(state.cwd);

  // p 越大越先被裁掉；0 是必须保留的核心段
  const segs = [];
  const add = (t, c, p, bgKey) => segs.push({ t, c, p, bgKey });
  if (state.model) add(g.model + ' ' + state.model, 'accent', 0, 'accent');
  if (dir) add(g.dir + ' ' + dir, 'text', 2);
  if (git) add(g.git + ' ' + git.branch + (git.dirty ? ' *' + git.dirty : ''), git.dirty ? 'warn' : 'success', 3);
  add(progressBar(pct, g, 10) + ' ' + pct.toFixed(0) + '%', pct > 85 ? 'warn' : 'info', 0);
  add(g.in + fmtTokens(prompt) + ' ' + g.out + fmtTokens(state.completion || 0), 'text', 1);
  if (prompt > 0) add(g.cache + ' ' + hit.toFixed(1) + '%', hit >= 80 ? 'success' : 'muted', 4);
  if (state.turnCalls) add(g.tools + ' ' + state.turnCalls + (state.lastTool ? ' ' + state.lastTool : ''), 'muted', 5);
  if (state.durationMs) add(g.time + ' ' + fmtDuration(state.durationMs), 'muted', 6);

  const powerline = process.env.CODEBUDDY_BEAUTIFY_POWERLINE !== '0';
  const width = parseInt(process.env.CODEBUDDY_BEAUTIFY_WIDTH, 10)
    || (process.stdout.columns || 0)
    || 100;
  const measure = (arr) => arr.reduce((n, s) => n + s.t.length + 2, 0);
  let kept = segs;
  while (kept.length > 2 && measure(kept) > width) {
    const maxP = Math.max.apply(null, kept.map((s) => s.p));
    kept = kept.filter((s) => s.p !== maxP);
  }

  if (powerline) {
    return kept.map((s, i) => {
      const isAccent = s.bgKey === 'accent';
      const background = isAccent ? pl.bg.accent : (i % 2 ? pl.bg.a : pl.bg.b);
      const foreground = isAccent ? pl.fg.onAccent : (pl.fg[s.c] || pl.fg.text);
      return background + foreground + ' ' + s.t + ' ' + RESET;
    }).join('');
  }
  if (process.env.CODEBUDDY_BEAUTIFY_MD === '1') {
    return kept.map((s) => '`' + s.t + '`').join(' ');
  }
  return kept.map((s) => paint(s.t, s.c, pal)).join(paint(g.sep, 'dim', pal));
}

// statusLine 模式：codebuddy 的 Status payload
function stateFromPayload(payload) {
  const cw = payload.context_window || {};
  const cur = cw.current_usage || {};
  const scan = scanTranscript(payload.transcript_path) || {};
  const cwd = payload.cwd
    || (payload.workspace && payload.workspace.current_dir)
    || scan.cwd
    || process.cwd();

  const prompt = cw.total_input_tokens || cur.input_tokens || (scan.usage && scan.usage.prompt) || 0;
  const completion = cw.total_output_tokens || cur.output_tokens || (scan.usage && scan.usage.completion) || 0;
  const cacheRead = cur.cache_read_input_tokens || (scan.usage && scan.usage.cacheRead) || 0;

  return {
    model: (payload.model && (payload.model.display_name || payload.model.id)) || scan.model || null,
    cwd,
    prompt,
    completion,
    cacheRead,
    usedPercentage: typeof cw.used_percentage === 'number' ? cw.used_percentage : null,
    ctxSize: cw.context_window_size || 0,
    turnCalls: scan.turnCalls || 0,
    lastTool: scan.lastTool || null,
    durationMs: scan.durationMs
      || (payload.cost && payload.cost.total_duration_ms)
      || 0,
  };
}

// 调试模式：直接读 transcript
function stateFromTranscript(transcriptPath) {
  const scan = scanTranscript(transcriptPath);
  if (!scan || !scan.usage) return null;
  return {
    model: scan.model,
    cwd: scan.cwd || process.cwd(),
    prompt: scan.usage.prompt,
    completion: scan.usage.completion,
    cacheRead: scan.usage.cacheRead,
    usedPercentage: null,
    ctxSize: 0,
    turnCalls: scan.turnCalls,
    lastTool: scan.lastTool,
    durationMs: scan.durationMs,
  };
}

function renderStatusBar(transcriptPath) {
  const state = stateFromTranscript(transcriptPath);
  return state ? buildParts(state) : '';
}

function readStdin(timeoutMs) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    const chunks = [];
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(''), timeoutMs || 1200);
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => { clearTimeout(timer); finish(Buffer.concat(chunks).toString('utf8')); });
    process.stdin.on('error', () => { clearTimeout(timer); finish(''); });
  });
}

async function main() {
  const arg = process.argv[2];
  if (arg && arg !== '-') {
    const line = renderStatusBar(arg);
    process.stdout.write((line || '(no data)') + '\n');
    return;
  }
  const raw = await readStdin(1200);
  let payload = null;
  try { payload = JSON.parse(raw.trim()); } catch { payload = null; }
  if (!payload) return;
  const line = buildParts(stateFromPayload(payload));
  if (line) process.stdout.write(line + '\n');
}

if (require.main === module) {
  main().catch(() => { /* 状态栏永不阻塞会话 */ });
}

module.exports = {
  buildParts, stateFromPayload, stateFromTranscript, renderStatusBar,
  scanTranscript, gitInfo, fmtTokens, fmtDuration, activeThemeMode,
};
