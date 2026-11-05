import { useEffect, useState } from 'react';
import { getAllThemes, cssThemes, generateThemeCss } from '../lib/themes';
import { resolveThemeCss } from '../lib/themeCss';
import { renderMarkdown } from '../utils/markdown';
import { useEscape } from '../lib/useEscape';

interface ThemeGalleryProps {
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const SAMPLE = `# 示例文章标题

## 小节标题

正文段落示例文字，**加粗**与 *斜体* 混排效果展示。

> 引用块样式示例文字内容

- 无序列表项示例
- 无序列表项示例

\`\`\`
const hello = 'world';
\`\`\`
`;

const ZOOM = 0.3;

interface GalleryItem {
  id: string;
  name: string;
  tag?: string;
  css?: string; // undefined = 仍在加载
}

export function ThemeGallery({ currentId, onSelect, onClose }: ThemeGalleryProps) {
  const [cssMap, setCssMap] = useState<Record<string, string> | null>(null);
  useEscape(onClose);

  // 开源 CSS 主题按需加载（参数主题同步生成，无需等待）
  useEffect(() => {
    let live = true;
    Promise.all(
      cssThemes.map((t) => resolveThemeCss(t.id).then((css) => [t.id, css] as const)),
    )
      .then((entries) => { if (live) setCssMap(Object.fromEntries(entries)); })
      .catch(() => { if (live) setCssMap({}); });
    return () => { live = false; };
  }, []);

  const items: GalleryItem[] = [
    ...getAllThemes().map((t) => ({
      id: t.id,
      name: t.name,
      tag: t.isCustom ? '自定义' : undefined,
      css: generateThemeCss(t),
    })),
    ...cssThemes.map((t) => ({ id: t.id, name: t.name, tag: t.source, css: cssMap?.[t.id] })),
  ];

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">主题预览</h2>
        <div className="form-hint" style={{ marginBottom: 14 }}>点击缩略图应用对应主题</div>

        <div className="gallery-grid">
          {items.map((t) => (
            <div
              key={t.id}
              className={`gallery-card ${t.id === currentId ? 'active' : ''} ${t.css ? '' : 'loading'}`}
              onClick={() => { if (!t.css) return; onSelect(t.id); onClose(); }}
              title={t.css ? `应用主题「${t.name}」` : '加载中...'}
            >
              {t.css ? (
                <Thumb css={t.css} name={t.name} />
              ) : (
                <div className="gallery-loading">加载中…</div>
              )}
              <div className="gallery-name">
                {t.name}
                {t.tag && <span className="cred-badge" style={{ marginLeft: 6 }}>{t.tag}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function Thumb({ css, name }: { css: string; name: string }) {
  const html = renderMarkdown(SAMPLE, css).html;
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;zoom:${ZOOM};background:#fff;">${html}</body></html>`;
  return (
    <iframe
      className="gallery-thumb"
      srcDoc={srcdoc}
      width={Math.round(240 / ZOOM)}
      height={Math.round(300 / ZOOM)}
      style={{ width: '100%', height: 180, border: 'none', pointerEvents: 'none' }}
      sandbox=""
      title={name}
    />
  );
}
