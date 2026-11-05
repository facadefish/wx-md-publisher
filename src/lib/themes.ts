/**
 * 参数化主题系统：ThemeConfig → CSS
 * 内置主题即预设参数，自定义主题 = 预设副本 + 用户微调
 */

export type CodeStyle = 'light' | 'dark' | 'solarized';

export interface ThemeConfig {
  id: string;
  name: string;
  isCustom?: boolean;
  // 文字
  fontFamily: string;
  fontSize: number;        // 正文字号 px
  lineHeight: number;      // 行距
  paraSpacing: number;     // 段间距 px
  textColor: string;
  letterSpacing: number;   // 字间距 px
  textIndent: number;      // 首行缩进 px
  // 标题
  titleSize: number;       // 文章标题字号
  titleColor: string;
  titleWeight: number;
  headingSize: number;     // 小节标题基准字号
  headingColor: string;
  // 主题色
  accentColor: string;
  // 引用块
  quoteStyle: 'bar' | 'bg';
  quoteBg: string;
  // 代码块
  codeStyle: CodeStyle;
  codeRadius: number;
  codeBorder: boolean;
  codeFontSize: number;
  // 图片
  imageRadius: number;
  imageShadow: boolean;
  // 页面
  padding: number;
}

export const FONT_OPTIONS = [
  { label: '系统默认', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
  { label: '宋体系', value: '"Songti SC", "SimSun", serif' },
  { label: '黑体系', value: '"PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif' },
  { label: '楷体系', value: '"Kaiti SC", "KaiTi", "STKaiti", serif' },
  { label: '等宽', value: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace' },
];

const DEFAULT_FONT = FONT_OPTIONS[0].value;

const CODE_STYLES: Record<CodeStyle, {
  bg: string; text: string; border: string;
  keyword: string; string: string; comment: string; number: string;
}> = {
  light:     { bg: '#f7f7f7', text: '#333333', border: '#e0e0e0', keyword: '#d73a49', string: '#032f62', comment: '#6a737d', number: '#005cc5' },
  dark:      { bg: '#24292e', text: '#e6edf3', border: '#444c56', keyword: '#ff7b72', string: '#a5d6ff', comment: '#8b949e', number: '#79c0ff' },
  solarized: { bg: '#fdf6e3', text: '#586e75', border: '#e0d9c2', keyword: '#859900', string: '#2aa198', comment: '#93a1a1', number: '#d33682' },
};

export const CODE_STYLE_OPTIONS: { label: string; value: CodeStyle }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: 'Solarized', value: 'solarized' },
];

export const builtinThemes: ThemeConfig[] = [
  {
    id: 'default',
    name: '默认',
    fontFamily: DEFAULT_FONT,
    fontSize: 16,
    lineHeight: 1.8,
    paraSpacing: 16,
    textColor: '#333333',
    letterSpacing: 0.5,
    textIndent: 0,
    titleSize: 24,
    titleColor: '#1a1a1a',
    titleWeight: 700,
    headingSize: 20,
    headingColor: '#1a1a1a',
    accentColor: '#576b95',
    quoteStyle: 'bar',
    quoteBg: '#f7f7f7',
    codeStyle: 'light',
    codeRadius: 4,
    codeBorder: false,
    codeFontSize: 14,
    imageRadius: 4,
    imageShadow: false,
    padding: 20,
  },
  {
    id: 'canghe',
    name: '苍河',
    fontFamily: DEFAULT_FONT,
    fontSize: 16,
    lineHeight: 1.85,
    paraSpacing: 18,
    textColor: '#2c3e50',
    letterSpacing: 0.5,
    textIndent: 0,
    titleSize: 26,
    titleColor: '#1f2937',
    titleWeight: 800,
    headingSize: 21,
    headingColor: '#1f2937',
    accentColor: '#0ea5e9',
    quoteStyle: 'bg',
    quoteBg: '#f0f9ff',
    codeStyle: 'light',
    codeRadius: 8,
    codeBorder: true,
    codeFontSize: 14,
    imageRadius: 8,
    imageShadow: true,
    padding: 24,
  },
];

export function generateThemeCss(c: ThemeConfig): string {
  const code = CODE_STYLES[c.codeStyle] ?? CODE_STYLES.light;
  const quoteCss =
    c.quoteStyle === 'bar'
      ? `border-left: 4px solid ${c.accentColor}; background: ${c.quoteBg};`
      : `background: ${c.quoteBg}; border-radius: 8px;`;
  const imageShadow = c.imageShadow ? 'box-shadow: 0 2px 8px rgba(0,0,0,0.08);' : '';
  const codeBorder = c.codeBorder ? `border: 1px solid ${code.border};` : '';
  const textIndent = c.textIndent > 0 ? `text-indent: ${c.textIndent}px;` : '';

  return `
.wx-article {
  font-family: ${c.fontFamily};
  color: ${c.textColor};
  font-size: ${c.fontSize}px;
  line-height: ${c.lineHeight};
  letter-spacing: ${c.letterSpacing}px;
  max-width: 677px;
  margin: 0 auto;
  padding: ${c.padding}px;
  background: #ffffff;
  word-break: break-word;
}
.wx-title {
  font-size: ${c.titleSize}px;
  font-weight: ${c.titleWeight};
  color: ${c.titleColor};
  line-height: 1.4;
  margin-bottom: ${Math.round(c.paraSpacing * 1.25)}px;
  font-family: ${c.fontFamily};
}
.wx-heading {
  font-weight: ${c.titleWeight};
  color: ${c.headingColor};
  margin: ${Math.round(c.paraSpacing * 1.5)}px 0 ${Math.round(c.paraSpacing * 0.75)}px;
  line-height: 1.4;
}
.wx-heading-1 { font-size: ${c.headingSize + 2}px; }
.wx-heading-2 { font-size: ${c.headingSize}px; }
.wx-heading-3 { font-size: ${c.headingSize - 1}px; }
.wx-heading-4, .wx-heading-5, .wx-heading-6 { font-size: ${c.fontSize + 1}px; }
.wx-paragraph { margin: ${c.paraSpacing}px 0; text-align: justify; ${textIndent} }
.wx-list { margin: ${c.paraSpacing}px 0; padding-left: ${Math.round(c.fontSize * 1.5)}px; }
.wx-list-item { margin: ${Math.round(c.paraSpacing * 0.5)}px 0; }
.wx-image {
  display: block;
  max-width: 100%;
  height: auto;
  margin: ${c.paraSpacing}px auto;
  border-radius: ${c.imageRadius}px;
  ${imageShadow}
}
.wx-code {
  background: ${code.bg};
  color: ${code.text};
  padding: ${Math.round(c.paraSpacing * 0.75)}px ${c.paraSpacing}px;
  border-radius: ${c.codeRadius}px;
  ${codeBorder}
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: ${c.codeFontSize}px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.wx-code .hljs-keyword,
.wx-code .hljs-selector-tag,
.wx-code .hljs-literal,
.wx-code .hljs-name { color: ${code.keyword}; }
.wx-code .hljs-string,
.wx-code .hljs-regexp,
.wx-code .hljs-addition { color: ${code.string}; }
.wx-code .hljs-comment,
.wx-code .hljs-quote { color: ${code.comment}; font-style: italic; }
.wx-code .hljs-number,
.wx-code .hljs-symbol,
.wx-code .hljs-bullet,
.wx-code .hljs-attr,
.wx-code .hljs-attribute,
.wx-code .hljs-variable,
.wx-code .hljs-template-variable,
.wx-code .hljs-built_in,
.wx-code .hljs-type { color: ${code.number}; }
.wx-quote p { margin: 0 0 6px; }
.wx-quote p:last-child { margin-bottom: 0; }
.wx-quote p[class^="alert-title-"] {
  font-weight: 600;
  color: ${c.accentColor};
  letter-spacing: normal;
}
.wx-quote {
  ${quoteCss}
  padding: ${Math.round(c.paraSpacing * 0.75)}px ${c.paraSpacing}px;
  margin: ${c.paraSpacing}px 0;
  color: ${c.textColor};
}
.wx-table {
  width: 100%;
  border-collapse: collapse;
  margin: ${c.paraSpacing}px 0;
  font-size: ${c.fontSize - 2}px;
}
.wx-table th, .wx-table td {
  border: 1px solid #e0e0e0;
  padding: ${Math.round(c.paraSpacing * 0.5)}px ${Math.round(c.paraSpacing * 0.75)}px;
  text-align: left;
}
.wx-table th { background: ${c.quoteBg}; font-weight: ${c.titleWeight}; }
.wx-divider { border: none; border-top: 1px solid #e0e0e0; margin: ${Math.round(c.paraSpacing * 1.5)}px 0; }
`.trim();
}

// ── 自定义主题持久化 ─────────────────────────────────────

const CUSTOM_KEY = 'wx-md-themes-v1';
const ACTIVE_KEY = 'wx-md-active-theme-v1';

/** 补齐缺失参数（旧版本存储的主题可能缺少新增字段；兼容已删除的 codeDark 布尔值） */
export function normalizeTheme(t: Partial<ThemeConfig> & { id: string; name: string }): ThemeConfig {
  const legacy = t as ThemeConfig & { codeDark?: boolean };
  const codeStyle = t.codeStyle ?? (legacy.codeDark ? 'dark' : 'light');
  return { ...builtinThemes[0], ...t, codeStyle };
}

export function loadCustomThemes(): ThemeConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const parsed: (Partial<ThemeConfig> & { id: string; name: string })[] = raw ? JSON.parse(raw) : [];
    return parsed.map(normalizeTheme);
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: ThemeConfig[]): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(themes));
}

export function getActiveThemeId(): string {
  return localStorage.getItem(ACTIVE_KEY) || 'default';
}

export function setActiveThemeId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getAllThemes(): ThemeConfig[] {
  return [...builtinThemes, ...loadCustomThemes()];
}

export function getTheme(id: string): ThemeConfig {
  return getAllThemes().find((t) => t.id === id) ?? builtinThemes[0];
}

// ── 开源移植的完整 CSS 主题 ──────────────────────────────
// 样式文件由 scripts/build-themes.mjs 从 WeMD / doocs/md 主题源翻译生成，
// 存放于 public/themes/<id>.css，运行时按需加载（带缓存），不打进 JS 包。

export interface CssThemeMeta {
  id: string;
  name: string;
  source: 'WeMD' | 'doocs/md';
}

export const cssThemes: CssThemeMeta[] = [
  { id: 'wemd-default', name: '默认主题', source: 'WeMD' },
  { id: 'wemd-data-blueprint', name: '数据蓝图', source: 'WeMD' },
  { id: 'wemd-eastern-notes', name: '东方笺谱', source: 'WeMD' },
  { id: 'wemd-clear-guide', name: '清晰指南', source: 'WeMD' },
  { id: 'wemd-whitespace-gallery', name: '留白画册', source: 'WeMD' },
  { id: 'wemd-academic-paper', name: '学术论文', source: 'WeMD' },
  { id: 'wemd-aurora-glass', name: '极光玻璃', source: 'WeMD' },
  { id: 'wemd-bauhaus', name: '包豪斯', source: 'WeMD' },
  { id: 'wemd-cyberpunk-neon', name: '赛博朋克', source: 'WeMD' },
  { id: 'wemd-knowledge-base', name: '知识库', source: 'WeMD' },
  { id: 'wemd-luxury-gold', name: '黑金奢华', source: 'WeMD' },
  { id: 'wemd-morandi-forest', name: '莫兰迪森林', source: 'WeMD' },
  { id: 'wemd-modern-editorial', name: '编辑部手记', source: 'WeMD' },
  { id: 'wemd-neo-brutalism', name: '新粗野主义', source: 'WeMD' },
  { id: 'wemd-receipt', name: '购物小票', source: 'WeMD' },
  { id: 'wemd-sunset-film', name: '落日胶片', source: 'WeMD' },
  { id: 'wemd-template', name: '主题模板', source: 'WeMD' },
  { id: 'doocs-default', name: '经典', source: 'doocs/md' },
  { id: 'doocs-grace', name: '优雅', source: 'doocs/md' },
  { id: 'doocs-simple', name: '简洁', source: 'doocs/md' },
];

export function isCssTheme(id: string): boolean {
  return cssThemes.some((t) => t.id === id);
}
