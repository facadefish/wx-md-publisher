/**
 * 开源主题翻译脚本：themes-src/ → public/themes/
 *
 * - WeMD (github.com/tenngoxars/WeMD, MIT)：根选择器 #wemd → .wx-article
 * - doocs/md (github.com/doocs/md, MIT)：裸元素选择器加 .wx-article 前缀，
 *   #output / section 替换为 .wx-article，并注入其 CSS 变量的默认值
 *
 * 用法：node scripts/build-themes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(root, 'themes-src');
const OUT = path.join(root, 'static', 'themes');

// doocs/md 默认样式配置（packages/shared/src/configs/style.ts + cssVariables.ts）
const DOCS_VARS = `.wx-article{--md-primary-color:#0F4C81;--md-font-family:-apple-system-font,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei UI","Microsoft YaHei",Arial,sans-serif;--md-font-size:16px;--md-line-height:1.75;--md-block-spacing:1;--md-link-color:#576b95;--foreground:0 0% 3.9%;--blockquote-background:#f7f7f7;}`;

// WeMD 内置主题（对应 packages/core/src/themes/ + apps/web/src/store/themes/builtInThemes.ts）
const WEMD_THEMES = [
  ['wemd-default', '默认主题', 'custom-default', 'code-github'],
  ['wemd-data-blueprint', '数据蓝图', 'data-blueprint', 'code-github-dark'],
  ['wemd-eastern-notes', '东方笺谱', 'eastern-notes', 'code-github-dark'],
  ['wemd-clear-guide', '清晰指南', 'clear-guide', 'code-github-dark'],
  ['wemd-whitespace-gallery', '留白画册', 'whitespace-gallery', 'code-github-dark'],
  ['wemd-academic-paper', '学术论文', 'academic-paper', 'code-github'],
  ['wemd-aurora-glass', '极光玻璃', 'aurora-glass', 'code-github'],
  ['wemd-bauhaus', '包豪斯', 'bauhaus', 'code-github'],
  ['wemd-cyberpunk-neon', '赛博朋克', 'cyberpunk-neon', 'code-github'],
  ['wemd-knowledge-base', '知识库', 'knowledge-base', 'code-github'],
  ['wemd-luxury-gold', '黑金奢华', 'luxury-gold', 'code-github'],
  ['wemd-morandi-forest', '莫兰迪森林', 'morandi-forest', 'code-github'],
  ['wemd-modern-editorial', '编辑部手记', 'modern-editorial', 'code-github-dark'],
  ['wemd-neo-brutalism', '新粗野主义', 'neo-brutalism', 'code-github'],
  ['wemd-receipt', '购物小票', 'receipt', 'code-github'],
  ['wemd-sunset-film', '落日胶片', 'sunset-film', 'code-github'],
  ['wemd-template', '主题模板', 'template', 'code-github'],
];

const DOCS_THEMES = [
  ['doocs-default', '经典', 'default'],
  ['doocs-grace', '优雅', 'grace'],
  ['doocs-simple', '简洁', 'simple'],
];

function extractTemplate(file) {
  const raw = fs.readFileSync(file, 'utf-8');
  const start = raw.indexOf('`');
  const end = raw.lastIndexOf('`');
  if (start === -1 || end <= start) throw new Error(`无法提取模板字符串: ${file}`);
  return raw.slice(start + 1, end);
}

/** doocs CSS 作用域处理：裸选择器加前缀，#output/section 替换为 .wx-article */
function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel || sel.startsWith(':root')) return sel === ':root' ? '.wx-article' : sel;
  sel = sel.replace(/^#output\b/, '.wx-article').replace(/^section\b/, '.wx-article');
  if (sel.startsWith('.wx-article')) return sel;
  return `.wx-article ${sel}`;
}

function scopeCss(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let rest = noComments;
  while (rest.length) {
    const brace = rest.indexOf('{');
    if (brace === -1) { out += rest; break; }
    const selector = rest.slice(0, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < rest.length && depth > 0) {
      if (rest[j] === '{') depth++;
      else if (rest[j] === '}') depth--;
      j++;
    }
    const body = rest.slice(brace + 1, j - 1);
    rest = rest.slice(j);
    if (!selector) continue;
    if (selector.startsWith('@')) {
      const inner = selector.startsWith('@media') || selector.startsWith('@supports')
        ? scopeCss(body)
        : body;
      out += `${selector}{${inner}}`;
    } else {
      out += `${selector.split(',').map(scopeSelector).join(',')}{${body}}`;
    }
  }
  return out;
}

const header = (src) => `/* 来源: ${src} · MIT License · 由 scripts/build-themes.mjs 自动生成, 请勿手改 */\n`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const basic = extractTemplate(path.join(SRC, 'wemd', 'basic.ts'));
const themeCss = (file) => file === 'modern-editorial'
  ? ['modern-editorial-foundation', 'modern-editorial-content', 'modern-editorial-components']
      .map((f) => extractTemplate(path.join(SRC, 'wemd', `${f}.ts`))).join('\n')
  : extractTemplate(path.join(SRC, 'wemd', `${file}.ts`));
for (const [id, , themeFile, codeFile] of WEMD_THEMES) {
  const css = [basic, themeCss(themeFile), extractTemplate(path.join(SRC, 'wemd', `${codeFile}.ts`))]
    .join('\n')
    .replaceAll('#wemd', '.wx-article');
  fs.writeFileSync(path.join(OUT, `${id}.css`), header('WeMD (github.com/tenngoxars/WeMD)') + css, 'utf-8');
}

const base = fs.readFileSync(path.join(SRC, 'doocs', 'base.css'), 'utf-8');
for (const [id, , themeFile] of DOCS_THEMES) {
  const theme = fs.readFileSync(path.join(SRC, 'doocs', `${themeFile}.css`), 'utf-8');
  const css = DOCS_VARS + '\n' + scopeCss(base) + '\n' + scopeCss(theme);
  fs.writeFileSync(path.join(OUT, `${id}.css`), header('doocs/md (github.com/doocs/md)') + css, 'utf-8');
}

const files = fs.readdirSync(OUT);
console.log(`生成 ${files.length} 个主题:`);
for (const f of files) {
  const kb = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
  console.log(`  ${f}  ${kb}KB`);
}
