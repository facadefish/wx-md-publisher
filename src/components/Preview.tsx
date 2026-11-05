import { useEffect, useRef } from 'react';

interface PreviewProps {
  html: string;
  mode: 'desktop' | 'mobile';
}

export function Preview({ html, mode }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${html}</body></html>`);
    doc.close();
  }, [html]);

  return (
    <div className={`preview-container ${mode}`}>
      <div className={mode === 'mobile' ? 'phone-frame' : 'desktop-frame'}>
        <iframe ref={iframeRef} title="公众号预览" sandbox="allow-same-origin" />
      </div>
    </div>
  );
}
