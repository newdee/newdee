/** Palettes and shared constants for the terminal profile card. */

export const THEMES = {
  dark: {
    id: 'dark',
    pageBg: 'transparent',
    windowBg: '#0b0e14',
    chrome: '#111621',
    chromeText: '#8b95a5',
    border: '#1e2530',
    rule: '#1a212c',
    text: '#c3ccd9',
    dim: '#67707e',
    faint: '#3b4350',
    prompt: '#7fd88f',
    path: '#6fb6d3',
    flag: '#8f7fd8',
    star: '#e3b341',
    bar: '#2b3444',
    barLead: '#7fd88f',
    dot: ['#ff5f57', '#febc2e', '#28c840'],
    heat: ['#151b24', '#0e4429', '#006d32', '#26a641', '#39d353'],
    heatEmptyStroke: '#1c232e',
  },
  light: {
    id: 'light',
    pageBg: 'transparent',
    windowBg: '#fdfdfc',
    chrome: '#eeeeec',
    chromeText: '#6a7280',
    border: '#dcdcd7',
    rule: '#e8e8e4',
    text: '#24292f',
    dim: '#6e7781',
    faint: '#adb3ba',
    prompt: '#1a7f37',
    path: '#0f6f8f',
    flag: '#5a3fbf',
    star: '#9a6700',
    bar: '#e2e4e6',
    barLead: '#1a7f37',
    dot: ['#ff5f57', '#febc2e', '#28c840'],
    heat: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    heatEmptyStroke: '#e0e2e5',
  },
}

/** GitHub's canonical language colours, with a deterministic fallback. */
const LANG_COLORS = {
  Rust: '#dea584',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  'C++': '#f34b7d',
  C: '#555555',
  Go: '#00add8',
  Lua: '#000080',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Dart: '#00b4ab',
  Zig: '#ec915c',
  Nix: '#7e7eff',
  Makefile: '#427819',
  Dockerfile: '#384d54',
  CMake: '#da3434',
  Svelte: '#ff3e00',
  SCSS: '#c6538c',
  Jupyter: '#da5b0b',
  'Jupyter Notebook': '#da5b0b',
  'Objective-C': '#438eff',
  Assembly: '#6e4c13',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Scala: '#c22d40',
  Perl: '#0298c3',
  R: '#198ce7',
  Julia: '#a270ba',
  'Emacs Lisp': '#c065db',
  'Vim Script': '#199f4b',
  TeX: '#3d6117',
  Markdown: '#083fa1',
  Solidity: '#aa6746',
}

const FALLBACK = ['#8b949e', '#79868f', '#9aa4ad', '#6d7681']

export function langColor(name) {
  if (LANG_COLORS[name]) return LANG_COLORS[name]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return FALLBACK[Math.abs(h) % FALLBACK.length]
}

export const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace"
