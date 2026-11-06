// omp obsidian 调色板 → codebuddy 的 dark 主题对象，以及 dist/codebuddy.js 的补丁/还原。
import fs from 'node:fs';

export const MARK = '"logo":{"edge":"#9d7aff"';

// 取自 omp 内置主题 obsidian（theme.dark）。
export const OBSIDIAN = {
  accent: '#9d7aff',
  border: '#3a3352',
  borderAccent: '#4a4166',
  borderMuted: '#2a2540',
  success: '#6a9a6a',
  error: '#b84a2c',
  warning: '#d97651',
  muted: '#5a524b',
  dim: '#4a433d',
  text: '#cac5bd',
  selectedBg: '#2a2540',
  userMessageBg: '#3a3352',
  toolSuccessBg: '#1f2520',
  toolErrorBg: '#2a1f1d',
  mdHeading: '#9d7aff',
  mdLink: '#8bb88b',
  mdLinkUrl: '#6a9a6a',
  mdCode: '#d97651',
  syntaxKeyword: '#9d7aff',
  syntaxFunction: '#8bb88b',
  syntaxString: '#6a9a6a',
  syntaxNumber: '#d97651',
  syntaxVariable: '#e4e0d8',
  syntaxComment: '#5a524b',
  pythonMode: '#f0c040',
  // 主页 logo 用紫色，与赭红主色区分
  logo: '#9d7aff',
  logoGlow: '#c3a8ff',
  // terminal.ansi[0..15]，给「ANSI 主题」和终端透传用
  ansi: [
    '#3a3530', '#c45a3a', '#6a9a6a', '#c9a24a',
    '#6f8fae', '#a87a9a', '#6a9e9e', '#cac5bd',
    '#776e65', '#d97651', '#8bb88b', '#e0c070',
    '#93b0cc', '#c69ab8', '#8cbcbc', '#e4e0d8',
  ],
};

const SECONDARY = '#8a807a';
const ROW_BG = '#1f1c19';

export function buildDarkTheme(p = OBSIDIAN) {
  return {
    brand: p.accent,
    primary: '',
    text: '',
    secondary: '#9da6ca',
    textSecondary: '#9da6ca',
    success: p.success,
    error: p.error,
    warning: p.warning,
    info: p.ansi[4],
    background: '',
    rowBackground: '#1a1816',
    border: '#656b83',
    disabled: 'gray',
    diff: {
      added: p.toolSuccessBg,
      removed: p.toolErrorBg,
      addedDimmed: '#23291f',
      removedDimmed: '#241c1a',
      addedWord: p.success,
      removedWord: p.error,
    },
    gradient: {
      logo: [p.logo, p.logoGlow],
      highlight: [p.accent, p.warning, p.mdLink, p.text, p.syntaxVariable],
    },
    logo: { edge: p.logo, highlight: p.logoGlow, outline: p.logo, eye: p.logo, body: p.logo },
    thinking: '',
    debug: p.ansi[4],
    planMode: p.ansi[6],
    bashMode: p.ansi[5],
    bashLocalMode: p.ansi[14],
    delegateMode: p.ansi[3],
    toolName: p.ansi[4],
    toolResult: '',
    toolArg: p.ansi[6],
    codeKeyword: p.syntaxKeyword,
    codeString: p.syntaxString,
    codeComment: p.syntaxComment,
    codeNumber: p.syntaxNumber,
    prompt: p.accent,
    cursor: '',
    selection: '#2a263f',
    link: p.mdLink,
    hint: 'gray',
    spinner: p.accent,
    progressBar: p.accent,
    badge: p.ansi[4],
    counter: '',
    notificationInfo: p.ansi[4],
    notificationWarning: p.warning,
    notificationError: p.error,
    notificationSuccess: p.success,
    agentName: p.ansi[4],
    agentBorder: '#656b83',
    permissionAllow: p.success,
    permissionDeny: p.error,
    permissionAsk: p.warning,
    filePath: p.mdLink,
    lineNumber: 'gray',
  };
}

const START_MARKER = '{name:"dark",colors:{';
const END_MARKER = '}},eh={name:"light-colorblind"';

// 备份名：本插件用 .orig-beautify；旧脚本（apply-obsidian-theme.mjs）用 .orig-obsidian，兼容两者。
export function backupPath(distFile) {
  const own = distFile + '.orig-beautify';
  if (fs.existsSync(own)) return own;
  const legacy = distFile + '.orig-obsidian';
  return fs.existsSync(legacy) ? legacy : own;
}

export function inspect(distFile) {
  let src;
  try {
    src = fs.readFileSync(distFile, 'utf8');
  } catch {
    return { ok: false, reason: 'missing', distFile };
  }
  const start = src.indexOf(START_MARKER);
  const end = start < 0 ? -1 : src.indexOf(END_MARKER, start);
  if (start < 0 || end < 0) return { ok: false, reason: 'anchor-missing', distFile };
  const seg = src.slice(start, end + 2);
  const backup = backupPath(distFile);
  return { ok: true, patched: seg.includes(MARK), anchorStart: start, anchorEnd: end, distFile, backup, hasBackup: fs.existsSync(backup) };
}

export function applyTheme(distFile, palette = OBSIDIAN, { force = false } = {}) {
  const info = inspect(distFile);
  if (!info.ok) throw new Error(`dist 结构不匹配（${info.reason}）：${distFile}`);
  if (info.patched) {
    if (!force) return { changed: false, reason: 'already-applied' };
    if (!info.hasBackup) throw new Error('已打补丁但找不到备份，无法重打；请重装 codebuddy 后再试');
    fs.copyFileSync(info.backup, distFile);
    return applyTheme(distFile, palette, { force: false });
  }

  const backup = backupPath(distFile);
  if (!fs.existsSync(backup)) fs.copyFileSync(distFile, backup);

  const src = fs.readFileSync(distFile, 'utf8');
  const body = JSON.stringify(buildDarkTheme(palette));
  if (!body.includes(MARK)) throw new Error('补丁自检失败：主题主色缺失');
  JSON.parse(body);
  const replacement = '{name:"dark",colors:' + body + '}';
  const next = src.slice(0, info.anchorStart) + replacement + src.slice(info.anchorEnd + 2);

  fs.writeFileSync(distFile, next);
  return { changed: true, backup };
}

export function revertTheme(distFile) {
  const backup = backupPath(distFile);
  if (!fs.existsSync(backup)) return { changed: false, reason: 'no-backup' };
  fs.copyFileSync(backup, distFile);
  return { changed: true };
}
