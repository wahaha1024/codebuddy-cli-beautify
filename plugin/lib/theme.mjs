// omp obsidian 调色板 → codebuddy 内置主题，以及 dist/codebuddy.js 的补丁/还原。
// 6 个可选主题逐个适配：深色系用深紫 obsidian，亮色系用高对比深紫，色盲变体保留原有色相语义。
import fs from 'node:fs';

// 补丁指纹：logo 色写进 colors.logo.edge，用来判断是否已打补丁。
export const MARK = '"logo":{"edge":"#9d7aff"';
export const MARKS = {
  dark: MARK,
  light: '"logo":{"edge":"#6a3fb0"',
};

// 取自 omp 内置主题 obsidian（theme.dark），深色主题基线。
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
  logo: '#9d7aff',
  logoGlow: '#c3a8ff',
  ansi: [
    '#3a3530', '#c45a3a', '#6a9a6a', '#c9a24a',
    '#6f8fae', '#a87a9a', '#6a9e9e', '#cac5bd',
    '#776e65', '#d97651', '#8bb88b', '#e0c070',
    '#93b0cc', '#c69ab8', '#8cbcbc', '#e4e0d8',
  ],
};

// 深色色盲变体：沿用上游 dark-colorblind 的蓝/橙/黄色相，避免红绿冲突。
export const OBSIDIAN_DARK_COLORBLIND = {
  ...OBSIDIAN,
  success: '#8ab4f8', error: '#f8b878', warning: '#fdd663', info: '#c4a8f8',
  mdLink: '#8ab4f8', mdLinkUrl: '#78b8d8', mdCode: '#f8b878',
  syntaxKeyword: '#c4a8f8', syntaxFunction: '#8ab4f8', syntaxString: '#78b8d8',
  syntaxNumber: '#f8b878', syntaxVariable: '#e4e0d8',
  ansi: [
    '#3a3530', '#f8b878', '#8ab4f8', '#fdd663',
    '#c4a8f8', '#d8a8d8', '#78d9ec', '#cac5bd',
    '#776e65', '#f8b878', '#8ab4f8', '#fdd663',
    '#c4a8f8', '#d8a8d8', '#78d9ec', '#e4e0d8',
  ],
};

// 亮色基线：深紫主色配深色正文，在白底上有足够对比度。
export const OBSIDIAN_LIGHT = {
  accent: '#6a3fb0',
  border: '#b9b2cc',
  borderAccent: '#9d7aff',
  borderMuted: '#e6e1f0',
  success: '#1a7f37',
  error: '#c62828',
  warning: '#9a6700',
  info: '#0b62b3',
  muted: '#6b7280',
  dim: '#8b949e',
  text: '#1f2328',
  selectedBg: '#e6ddff',
  userMessageBg: '#f0ebfa',
  toolSuccessBg: '#e8f5e9',
  toolErrorBg: '#fdecea',
  mdHeading: '#6a3fb0',
  mdLink: '#0b62b3',
  mdLinkUrl: '#1a7f37',
  mdCode: '#9a6700',
  syntaxKeyword: '#6a3fb0',
  syntaxFunction: '#0b62b3',
  syntaxString: '#1a7f37',
  syntaxNumber: '#9a6700',
  syntaxVariable: '#1f2328',
  syntaxComment: '#6b7280',
  pythonMode: '#8a5a00',
  logo: '#6a3fb0',
  logoGlow: '#9d7aff',
  ansi: [
    '#4b5563', '#c62828', '#1a7f37', '#9a6700',
    '#0b62b3', '#8e3b8e', '#0b7285', '#1f2328',
    '#8b949e', '#d32f2f', '#2e7d32', '#b7791f',
    '#1565c0', '#7b3fa0', '#0f7b8a', '#374151',
  ],
};

// 亮色色盲变体：保留上游 light-colorblind 的蓝/橙/黄色相。
export const OBSIDIAN_LIGHT_COLORBLIND = {
  ...OBSIDIAN_LIGHT,
  success: '#0055aa', error: '#b35b00', warning: '#8a5a00', info: '#5b2ea8',
  mdLink: '#0055aa', mdLinkUrl: '#0055aa', mdCode: '#b35b00',
  syntaxKeyword: '#5b2ea8', syntaxFunction: '#0055aa', syntaxString: '#0b6b8a',
  syntaxNumber: '#b35b00', syntaxVariable: '#1f2328',
  ansi: [
    '#4b5563', '#b35b00', '#0055aa', '#8a5a00',
    '#5b2ea8', '#8e3b8e', '#0b7285', '#1f2328',
    '#8b949e', '#b35b00', '#0055aa', '#8a5a00',
    '#5b2ea8', '#8e3b8e', '#0b7285', '#374151',
  ],
};

// 结构性颜色（非色相）按明暗分组，避免亮色下沿用深底数值。
const BASE = {
  dark: {
    secondary: '#9da6ca', rowBackground: '#1a1816', border: '#656b83',
    disabled: 'gray', diffAddedDimmed: '#23291f', diffRemovedDimmed: '#241c1a',
    selection: '#2a263f', hint: 'gray', lineNumber: 'gray',
    text: '', primary: '', background: '',
  },
  light: {
    secondary: '#4b5563', rowBackground: '#eef0f6', border: '#a9b1c3',
    disabled: '#8b949e', diffAddedDimmed: '#d8efdb', diffRemovedDimmed: '#f7dcd8',
    selection: '#e6ddff', hint: '#6b7280', lineNumber: '#6b7280',
    text: '#1f2328', primary: '#1f2328', background: '#ffffff',
  },
};

export function buildTheme(p, mode = 'dark') {
  const b = BASE[mode];
  const info = mode === 'light' ? p.info : p.ansi[4];
  return {
    brand: p.accent,
    primary: b.primary,
    text: b.text,
    secondary: b.secondary,
    textSecondary: b.secondary,
    success: p.success,
    error: p.error,
    warning: p.warning,
    info,
    background: b.background,
    rowBackground: b.rowBackground,
    border: b.border,
    disabled: b.disabled,
    diff: {
      added: p.toolSuccessBg,
      removed: p.toolErrorBg,
      addedDimmed: b.diffAddedDimmed,
      removedDimmed: b.diffRemovedDimmed,
      addedWord: p.success,
      removedWord: p.error,
    },
    gradient: {
      logo: [p.logo, p.logoGlow],
      highlight: [p.accent, p.warning, p.mdLink, p.text, p.syntaxVariable],
    },
    logo: { edge: p.logo, highlight: p.logoGlow, outline: p.logo, eye: p.logo, body: p.logo },
    thinking: p.accent,
    debug: info,
    planMode: p.ansi[6],
    bashMode: p.ansi[5],
    bashLocalMode: p.ansi[14],
    delegateMode: p.warning,
    toolName: info,
    toolResult: mode === 'light' ? p.text : '',
    toolArg: p.ansi[6],
    codeKeyword: p.syntaxKeyword,
    codeString: p.syntaxString,
    codeComment: p.syntaxComment,
    codeNumber: p.syntaxNumber,
    prompt: p.accent,
    cursor: '',
    selection: b.selection,
    link: p.mdLink,
    hint: b.hint,
    spinner: p.accent,
    progressBar: p.accent,
    badge: info,
    counter: mode === 'light' ? p.text : '',
    notificationInfo: info,
    notificationWarning: p.warning,
    notificationError: p.error,
    notificationSuccess: p.success,
    agentName: info,
    agentBorder: b.border,
    permissionAllow: p.success,
    permissionDeny: p.error,
    permissionAsk: p.warning,
    filePath: p.mdLink,
    lineNumber: b.lineNumber,
  };
}

// 向后兼容旧调用方。
export const buildDarkTheme = (p = OBSIDIAN) => buildTheme(p, 'dark');

// 6 个可选主题；nocolor 是「无颜色」语义，不改写。
export const THEME_SPECS = [
  { name: 'dark', mode: 'dark', palette: OBSIDIAN },
  { name: 'dark-ansi', mode: 'dark', palette: OBSIDIAN },
  { name: 'dark-colorblind', mode: 'dark', palette: OBSIDIAN_DARK_COLORBLIND },
  { name: 'light', mode: 'light', palette: OBSIDIAN_LIGHT },
  { name: 'light-ansi', mode: 'light', palette: OBSIDIAN_LIGHT },
  { name: 'light-colorblind', mode: 'light', palette: OBSIDIAN_LIGHT_COLORBLIND },
];

// 备份名：本插件用 .orig-beautify；旧脚本（apply-obsidian-theme.mjs）用 .orig-obsidian，兼容两者。
export function backupPath(distFile) {
  const own = distFile + '.orig-beautify';
  if (fs.existsSync(own)) return own;
  const legacy = distFile + '.orig-obsidian';
  return fs.existsSync(legacy) ? legacy : own;
}

// 在源码里定位 {name:"X",colors:{...}} 中 colors 对象的起止下标（括号配对，忽略字符串）。
function colorsSpan(src, name) {
  const key = '{name:"' + name + '",colors:{';
  const i = src.indexOf(key);
  if (i < 0) return null;
  const start = i + key.length - 1; // colors 值的 '{'
  let depth = 0, inStr = false, quote = '', esc = false;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { start, end: j + 1 };
    }
  }
  return null;
}

export function inspect(distFile) {
  let src;
  try {
    src = fs.readFileSync(distFile, 'utf8');
  } catch {
    return { ok: false, reason: 'missing', distFile, patched: false, themes: {} };
  }
  const themes = {};
  let anchored = 0;
  for (const spec of THEME_SPECS) {
    const span = colorsSpan(src, spec.name);
    if (!span) { themes[spec.name] = false; continue; }
    anchored++;
    themes[spec.name] = src.slice(span.start, span.end).includes(MARKS[spec.mode]);
  }
  if (anchored === 0) return { ok: false, reason: 'anchor-missing', distFile, patched: false, themes };
  const patched = THEME_SPECS.every((s) => themes[s.name]);
  const backup = backupPath(distFile);
  return {
    ok: true, patched, themes, distFile, backup,
    hasBackup: fs.existsSync(backup),
    patchedCount: THEME_SPECS.filter((s) => themes[s.name]).length,
    total: THEME_SPECS.length,
  };
}

export function applyTheme(distFile, { force = false } = {}) {
  const info = inspect(distFile);
  if (!info.ok) throw new Error(`dist 结构不匹配（${info.reason}）：${distFile}`);

  const backup = backupPath(distFile);
  let src;
  if (force) {
    if (!info.hasBackup) throw new Error('找不到备份，无法重打；请重装 codebuddy 后再试');
    fs.copyFileSync(backup, distFile);
    src = fs.readFileSync(backup, 'utf8');
  } else {
    src = fs.readFileSync(distFile, 'utf8');
  }

  const missing = THEME_SPECS.filter((s) => force || !info.themes[s.name]);
  if (!missing.length) return { changed: false, reason: 'already-applied', backup };
  if (!info.hasBackup) fs.copyFileSync(distFile, backup);

  for (const spec of missing) {
    const span = colorsSpan(src, spec.name);
    if (!span) throw new Error(`主题锚点缺失：${spec.name}`);
    const body = JSON.stringify(buildTheme(spec.palette, spec.mode));
    if (!body.includes(MARKS[spec.mode])) throw new Error(`补丁自检失败：${spec.name} 主色缺失`);
    JSON.parse(body);
    src = src.slice(0, span.start) + body + src.slice(span.end);
  }

  fs.writeFileSync(distFile, src);
  return { changed: true, backup, patched: missing.map((s) => s.name) };
}

export function revertTheme(distFile) {
  const backup = backupPath(distFile);
  if (!fs.existsSync(backup)) return { changed: false, reason: 'no-backup' };
  fs.copyFileSync(backup, distFile);
  return { changed: true };
}
