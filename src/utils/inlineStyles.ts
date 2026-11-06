/**
 * 微信公众号导出处理：「复制到剪贴板」与「发布到草稿箱」共用的最终 HTML 加工管线。
 *
 * 参考 doocs/md 的微信导出经验（apps/web/src/services/export/clipboard.ts），
 * 用浏览器自带 CSSOM 引擎实现，零新增依赖：
 * 1. 主题 CSS 内联：公众号会剥掉 <style> 标签，class 样式全部失效，
 *    只有 style 内联属性能保留；按文档顺序合并规则，保证"后者覆盖前者"
 * 2. 伪元素实体化：微信不支持 ::before/::after，把装饰性伪元素转成真实 <span>
 * 3. CSS 变量就地解析为字面值（自定义属性随 style 属性一起进入微信后行为不可控）
 * 4. 微信特有修复：
 *    - top 定位 → transform: translateY()（微信丢弃 top 定位）
 *    - img 的 width/height 属性 → 内联样式（微信丢弃尺寸属性）
 *    - 嵌套列表展平（li > ul/ol 移到 li 之后，微信不支持列表嵌套）
 *    - 首尾插入零高节点（防止微信吞并/污染第一个和最后一个块级元素）
 * @media 规则不随导出走（目标恒为浅色），状态类伪选择器（:hover 等）无法静态内联，跳过。
 */

interface PseudoSpec {
  base: string;
  position: 'before' | 'after';
  body: string;
  content: string | null;
}

const VAR_DEF_RE = /--([\w-]+)\s*:\s*([^;}]+)/g;
const VAR_REF_RE = /var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/g;

export function wechatifyArticle(html: string): string {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // 只授予同源（供 contentDocument 读取 CSSOM），不授予 allow-scripts：
  // 这份 html 来自用户 Markdown 与主题 CSS，其中若含脚本不应在导出流程中执行。
  // 注意必须用 allow-same-origin 而非空 sandbox——后者会让 contentDocument
  // 变成 null，直接破坏下面的 CSSOM 内联。
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`);
    doc.close();

    // ── 1. 收集规则（保持文档顺序）────────────────────
    // 注意：iframe 内 document 的 CSSRule 属于另一个 realm，
    // instanceof CSSStyleRule 恒为 false，必须用 realm 无关的 rule.type 判断
    const styleRules: string[] = [];
    for (const sheet of Array.from(doc.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule.type === CSSRule.STYLE_RULE) styleRules.push((rule as CSSStyleRule).cssText);
        }
      } catch { /* 防御：无法读取的样式表直接跳过 */ }
    }

    // ── 2. 普通规则内联 + 伪元素规则收集 ──────────────
    const pseudoSpecs: PseudoSpec[] = [];
    for (const cssText of styleRules) {
      const brace = cssText.indexOf('{');
      if (brace === -1) continue;
      const selectorText = cssText.slice(0, brace).trim();
      const body = cssText.slice(brace + 1, cssText.lastIndexOf('}')).trim();
      if (!body) continue;
      for (const selector of selectorText.split(',')) {
        const sel = selector.trim();
        if (!sel) continue;
        const pseudo = sel.match(/^(.*?)::?(before|after)$/i);
        if (pseudo) {
          const base = pseudo[1].trim();
          // 带状态/位置伪类的基选择器无法静态匹配，跳过
          if (base.includes(':')) continue;
          const contentMatch = body.match(/(?:^|;)content\s*:\s*"((?:[^"\\]|\\.)*)"/);
          pseudoSpecs.push({
            base,
            position: pseudo[2].toLowerCase() as 'before' | 'after',
            body: body.replace(/(?:^|;)content\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^;]+)/, ''),
            content: contentMatch ? contentMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'") : null,
          });
          continue;
        }
        if (sel.includes('::')) continue;
        try {
          doc.querySelectorAll(sel).forEach((el) => {
            const st = el as HTMLElement;
            st.style.cssText = st.style.cssText ? `${st.style.cssText};${body}` : body;
          });
        } catch { /* 无效选择器跳过 */ }
      }
    }

    // ── 3. 伪元素实体化为真实 <span> ──────────────────
    for (const spec of pseudoSpecs) {
      try {
        doc.querySelectorAll(spec.base).forEach((el) => {
          const span = doc.createElement('span');
          span.setAttribute('aria-hidden', 'true');
          span.style.cssText = spec.body;
          if (spec.content) span.textContent = spec.content;
          if (spec.position === 'before' && el.firstChild) el.insertBefore(span, el.firstChild);
          else el.appendChild(span);
        });
      } catch { /* 无效选择器跳过 */ }
    }

    // ── 4. CSS 变量就地解析 ───────────────────────────
    const vars = new Map<string, string>();
    doc.querySelectorAll('[style]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      for (const m of style.matchAll(VAR_DEF_RE)) vars.set(`--${m[1]}`, m[2].trim());
    });
    doc.querySelectorAll('[style]').forEach((el) => {
      let style = el.getAttribute('style') || '';
      for (let i = 0; i < 8; i += 1) {
        const next = style.replace(VAR_REF_RE, (_all, name: string, fallback?: string) => {
          const val = vars.get(name);
          if (val !== undefined) return val;
          return fallback ? fallback.trim() : '';
        });
        if (next === style) break;
        style = next;
      }
      // 自定义属性定义本身从 style 中剔除
      style = style.replace(VAR_DEF_RE, '').replace(/;\s*;/g, ';').trim();
      if (style.replace(/;+$/, '').trim()) el.setAttribute('style', style);
      else el.removeAttribute('style');
    });

    // ── 5. 微信特有修复 ───────────────────────────────
    doc.querySelectorAll('[style]').forEach((el) => {
      const style = (el.getAttribute('style') || '')
        // 微信丢弃 top 定位 → 位移变换
        .replace(/top\s*:\s*(-?[\d.]+em)/g, 'transform:translateY($1)')
        // 清理 juice 类工具常见的 undefined 声明
        .replace(/[\w-]+\s*:\s*undefined;?/g, '');
      const cleaned = style.replace(/;\s*;/g, ';').trim();
      if (cleaned.replace(/;+$/, '').trim()) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    });

    // img 的 width/height 属性 → 内联样式
    doc.querySelectorAll('img').forEach((img) => {
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      if (width) {
        img.removeAttribute('width');
        img.style.width = /^\d+$/.test(width) ? `${width}px` : width;
      }
      if (height) {
        img.removeAttribute('height');
        img.style.height = /^\d+$/.test(height) ? `${height}px` : height;
      }
    });

    // 嵌套列表展平：微信不支持 li 内嵌列表，移到 li 之后保持视觉近似
    doc.querySelectorAll('li > ul, li > ol').forEach((nested) => {
      nested.parentElement?.insertAdjacentElement('afterend', nested);
    });

    const article = doc.querySelector('article') ?? doc.body;
    // 首尾零高边界节点，防止微信吞并/污染首尾块级元素
    const boundary = () => {
      const p = doc.createElement('p');
      p.setAttribute('style', 'font-size:0;line-height:0;margin:0;');
      p.innerHTML = '&nbsp;';
      return p;
    };
    article.insertBefore(boundary(), article.firstChild);
    article.appendChild(boundary());

    const out = article.outerHTML;
    if ((out.match(/style="/g) ?? []).length === 0) {
      console.warn('[wechatify] 输出不包含任何内联样式，样式内联可能未生效（检查跨 realm 判断）');
    }
    return out;
  } finally {
    iframe.remove();
  }
}
