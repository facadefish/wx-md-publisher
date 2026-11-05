import { marked } from 'marked';
import type { Tokens } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import cssLang from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import diff from 'highlight.js/lib/languages/diff';
import markdownLang from 'highlight.js/lib/languages/markdown';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', cssLang);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('markdown', markdownLang);
hljs.registerLanguage('ini', ini);

export interface RenderedArticle {
  title: string;
  html: string;
}

/** 超过该长度的代码块跳过语法高亮，避免超长代码拖慢渲染 */
const HIGHLIGHT_MAX_CHARS = 20000;

/** GFM 警示块支持的类型（对齐 doocs/md 的 alert-title-* 样式契约） */
const ALERT_TYPES = new Set([
  'note', 'tip', 'important', 'warning', 'caution',
  'info', 'todo', 'success', 'done', 'question', 'help', 'faq',
  'failure', 'fail', 'missing', 'danger', 'error', 'bug', 'example',
  'quote', 'cite', 'theorem', 'lemma', 'corollary', 'proposition',
  'definition', 'axiom', 'postulate', 'assumption', 'proof', 'remark',
  'abstract', 'summary', 'tldr', 'custom',
]);

const ALERT_RE = /^\[!([A-Za-z]+)\][ \t]*\n?/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, label: string, url: string) => `<a href="${safeHref(url)}">${label}</a>`);
}

/** 仅允许安全协议的链接，拦截 javascript: / data: / vbscript: 伪协议（含控制字符混淆） */
function safeHref(url: string): string {
  const compact = url.trim().toLowerCase().replace(/[\s-]+/g, '');
  if (/^(javascript|vbscript|data):/.test(compact)) return '#';
  return url;
}

/** 渲染代码块：已注册语言走 highlight.js（输出已转义，可直接内嵌），否则纯文本兜底 */
function renderCode(token: Tokens.Code): string {
  const lang = (token.lang || '').trim().split(/\s+/)[0].toLowerCase();
  if (lang && token.text.length <= HIGHLIGHT_MAX_CHARS && hljs.getLanguage(lang)) {
    try {
      const { value } = hljs.highlight(token.text, { language: lang });
      return `<pre class="wx-code"><code class="hljs language-${escapeHtml(lang)}">${value}</code></pre>`;
    } catch {
      // 高亮失败回退纯文本
    }
  }
  return `<pre class="wx-code"><code>${escapeHtml(token.text)}</code></pre>`;
}

/** 解析 GFM 警示块（> [!NOTE] ...），输出 doocs/md 兼容的 alert-title-* 结构 */
function renderBlockquote(token: Tokens.Blockquote, renderInline: (text: string) => string): string {
  const text = token.text.replace(/\n$/, '');
  const m = text.match(ALERT_RE);
  if (m && ALERT_TYPES.has(m[1].toLowerCase())) {
    const type = m[1].toLowerCase();
    const label = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const body = text.slice(m[0].length).trim();
    const paras = body
      ? body.split(/\n{2,}/).map((p) => `<p>${renderInline(p.replace(/\n/g, ' '))}</p>`).join('')
      : '';
    return `<blockquote class="wx-quote alert alert-${type}"><p class="alert-title-${type}">${label}</p>${paras}</blockquote>`;
  }
  return `<blockquote class="wx-quote">${renderInline(text)}</blockquote>`;
}

export function renderMarkdown(markdown: string, themeCss: string): RenderedArticle {
  const tokens = marked.lexer(markdown);
  const bodyParts: string[] = [];
  let title = '未命名文档';

  function renderInline(text: string): string {
    // 先处理 Markdown 反斜杠转义（如 \- \[ \+），再转义 HTML、解析行内语法
    return inlineMarkdown(escapeHtml(text.replace(/\\([\\`*{}\[\]()#+\-.!_>~|])/g, '$1')));
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        if (token.depth === 1) {
          // 一级标题即文章标题（单独以 .wx-title 渲染），正文不再重复
          if (title === '未命名文档') title = token.text;
          break;
        }
        bodyParts.push(`<h${token.depth} class="wx-heading wx-heading-${token.depth}"><span class="content">${renderInline(token.text)}</span></h${token.depth}>`);
        break;
      }
      case 'paragraph': {
        bodyParts.push(`<p class="wx-paragraph">${renderInline(token.text)}</p>`);
        break;
      }
      case 'list': {
        const t = token as Tokens.List;
        const tag = t.ordered ? 'ol' : 'ul';
        const items = t.items
          .map((item: Tokens.ListItem) => `<li class="wx-list-item">${renderInline(item.text)}</li>`)
          .join('');
        bodyParts.push(`<${tag} class="wx-list">${items}</${tag}>`);
        break;
      }
      case 'code': {
        bodyParts.push(renderCode(token as Tokens.Code));
        break;
      }
      case 'blockquote': {
        bodyParts.push(renderBlockquote(token as Tokens.Blockquote, renderInline));
        break;
      }
      case 'hr': {
        bodyParts.push('<hr class="wx-divider" />');
        break;
      }
      case 'image': {
        bodyParts.push(`<img class="wx-image" src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}" />`);
        break;
      }
      case 'table': {
        const t = token as Tokens.Table;
        const header = t.header.map((cell: Tokens.TableCell) => `<th>${renderInline(cell.text)}</th>`).join('');
        const rows = t.rows
          .map((row: Tokens.TableCell[]) => `<tr>${row.map((cell) => `<td>${renderInline(cell.text)}</td>`).join('')}</tr>`)
          .join('');
        bodyParts.push(`<table class="wx-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`);
        break;
      }
      default:
        break;
    }
  }

  const html = `<article class="wx-article"><h1 class="wx-title">${escapeHtml(title)}</h1>${bodyParts.join('')}</article>`;

  return { title, html: `<style>${themeCss}</style>${html}` };
}

/** 提取文章中的图片地址（远程 http(s) 与本地 dataURL 粘贴图） */
export function extractImages(html: string): string[] {
  const matches = html.matchAll(/<img[^>]+src="([^"]+)"/g);
  return Array.from(matches, (m) => m[1]).filter(
    (src) => src.startsWith('http') || src.startsWith('data:image')
  );
}

export function isDataUrl(src: string): boolean {
  return src.startsWith('data:image');
}
