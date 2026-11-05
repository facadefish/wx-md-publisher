import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import { Editor } from './components/Editor';
import { Toolbar } from './components/Toolbar';
import { Preview } from './components/Preview';
import { Sidebar } from './components/Sidebar';
import { PublishDialog } from './components/PublishDialog';
import { ThemeEditor } from './components/ThemeEditor';
import { ThemeGallery } from './components/ThemeGallery';
import { CredentialsDialog } from './components/CredentialsDialog';
import { SnippetsDialog } from './components/SnippetsDialog';
import { renderMarkdown, extractImages, isDataUrl } from './utils/markdown';
import { copyHtmlToClipboard, downloadHtmlFile } from './utils/clipboard';
import { wechatifyArticle } from './utils/inlineStyles';
import {
  ThemeConfig, getTheme, cssThemes, isCssTheme, loadCustomThemes, saveCustomThemes,
  getActiveThemeId, setActiveThemeId, builtinThemes, generateThemeCss,
} from './lib/themes';
import { resolveThemeCss } from './lib/themeCss';
import { Doc, listDocs, getDoc, createDoc, updateDoc, deleteDoc, setDocPublished, getCurrentDocId, setCurrentDocId, reloadDocs, onDocsExternalChange } from './lib/docs';
import { CredentialsState, fetchCredentials } from './lib/credentials';

const DARK_KEY = 'wx-md-dark';

export default function App() {
  // 文档状态
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentDocId, setCurrentDocIdState] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState('');

  // 主题状态
  const [themeId, setThemeId] = useState(getActiveThemeId());
  const [customThemes, setCustomThemes] = useState<ThemeConfig[]>([]);
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [themeCss, setThemeCss] = useState('');
  const [showThemeGallery, setShowThemeGallery] = useState(false);

  // 界面状态
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [articleTitle, setArticleTitle] = useState('未命名文档');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === '1');

  // 凭据状态
  const [credentials, setCredentials] = useState<CredentialsState>({ accounts: [], activeId: null });

  const viewRef = useRef<EditorView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownRef = useRef(markdown);
  const dirtyRef = useRef(false);

  // 初始化
  useEffect(() => {
    setCustomThemes(loadCustomThemes());
    let all = listDocs();
    if (all.length === 0) {
      const doc = createDoc('# 欢迎使用\n\n左侧编写 **Markdown**，右侧实时预览公众号排版效果。\n\n截图后直接 **Ctrl+V** 粘贴图片。\n');
      all = [doc];
    }
    setDocs(all);
    const currentId = getCurrentDocId() ?? all[0].id;
    setCurrentDocIdState(currentId);
    const doc = getDoc(currentId);
    setMarkdown(doc?.content ?? '');

    // 多开同步：其他窗口写入时刷新列表；本页未在编辑时采纳远端当前文档内容
    const unsubscribe = onDocsExternalChange(() => {
      reloadDocs();
      setDocs(listDocs());
      const id = getCurrentDocId();
      const stored = id ? getDoc(id) : undefined;
      if (stored && stored.content !== markdownRef.current && !dirtyRef.current) {
        setMarkdown(stored.content);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return unsubscribe;
  }, []);

  // 深色写作模式（预览保持白色，模拟公众号阅读场景）
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    localStorage.setItem(DARK_KEY, dark ? '1' : '0');
  }, [dark]);

  // 凭据状态（决定发布按钮是否可用）
  const refreshCredentials = useCallback(() => {
    fetchCredentials()
      .then(setCredentials)
      .catch(() => setCredentials({ accounts: [], activeId: null }));
  }, []);

  useEffect(() => { refreshCredentials(); }, [refreshCredentials]);

  const activeAccount = useMemo(
    () => credentials.accounts.find((a) => a.id === credentials.activeId) ?? null,
    [credentials],
  );
  const wxConfigured = credentials.accounts.length > 0;

  // 解析主题 CSS：编辑中的主题实时生成；开源 CSS 主题按需异步加载（带缓存）
  useEffect(() => {
    if (showThemeEditor && editingTheme) {
      setThemeCss(generateThemeCss(editingTheme));
      return;
    }
    let stale = false;
    resolveThemeCss(themeId)
      .then((css) => { if (!stale) setThemeCss(css); })
      .catch(() => {});
    return () => { stale = true; };
  }, [themeId, customThemes, showThemeEditor, editingTheme]);

  // 主题变化：立即重新渲染，实现主题微调实时对照
  useEffect(() => {
    const result = renderMarkdown(markdownRef.current, themeCss);
    setRenderedHtml(result.html);
    setArticleTitle(result.title);
  }, [themeCss]);

  // Markdown 输入：防抖渲染
  useEffect(() => {
    markdownRef.current = markdown;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = renderMarkdown(markdown, themeCss);
      setRenderedHtml(result.html);
      setArticleTitle(result.title);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [markdown, themeCss]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── 文档操作 ──────────────────────────────────────────

  const refreshDocs = () => setDocs(listDocs());

  const handleCreateDoc = () => {
    const doc = createDoc();
    dirtyRef.current = false;
    setCurrentDocIdState(doc.id);
    setCurrentDocId(doc.id);
    setMarkdown(doc.content);
    refreshDocs();
    showToast('已创建新文章');
  };

  const handleSelectDoc = (id: string) => {
    const doc = getDoc(id);
    if (!doc) return;
    dirtyRef.current = false;
    setCurrentDocIdState(id);
    setCurrentDocId(id);
    setMarkdown(doc.content);
  };

  const handleDeleteDoc = (id: string) => {
    deleteDoc(id);
    refreshDocs();
    if (id === currentDocId) {
      const remaining = listDocs();
      if (remaining.length > 0) {
        handleSelectDoc(remaining[0].id);
      } else {
        handleCreateDoc();
      }
    }
    showToast('文章已删除');
  };

  const handleMarkdownChange = useCallback((value: string) => {
    dirtyRef.current = true;
    setMarkdown(value);
    if (currentDocId) {
      updateDoc(currentDocId, value);
      // 就地更新当前文档条目（标题/时间），避免每次击键都全量重读文档列表
      setDocs((prev) => prev.map((d) => (d.id === currentDocId ? { ...d, content: value, updatedAt: Date.now() } : d)));
    }
  }, [currentDocId]);

  // ── 编辑器插入（图片粘贴 / 片段）────────────────────────

  const insertAtCursor = (text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: text },
      selection: { anchor: sel.from + text.length },
      userEvent: 'input',
    });
    view.focus();
  };

  const handlePasteImage = useCallback((dataUrl: string) => {
    insertAtCursor(`\n![图片](${dataUrl})\n`);
    showToast('图片已粘贴（发布时自动上传微信图床）');
  }, []);

  const handleInsertSnippet = (content: string) => {
    insertAtCursor(content.endsWith('\n') ? content : `${content}\n`);
  };

  // ── 文件导入 ──────────────────────────────────────────

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isText = /\.(md|markdown|txt)$/i.test(file.name) || file.type.startsWith('text/');
    if (!isText) {
      showToast('仅支持 .md / .markdown / .txt 文件');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const doc = createDoc(content);
      dirtyRef.current = false;
      setCurrentDocIdState(doc.id);
      setCurrentDocId(doc.id);
      setMarkdown(content);
      refreshDocs();
      showToast(`已导入 ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── 主题操作 ──────────────────────────────────────────

  const handleThemeSelect = (id: string) => {
    if (id === '__customize__') {
      setEditingTheme({ ...getTheme(themeId) });
      setShowThemeEditor(true);
      return;
    }
    setThemeId(id);
    setActiveThemeId(id);
  };

  const handleGallerySelect = (id: string) => {
    setThemeId(id);
    setActiveThemeId(id);
    showToast(`已应用主题「${getTheme(id).name}」`);
  };

  const handleSaveTheme = (config: ThemeConfig) => {
    const themes = loadCustomThemes();
    const idx = themes.findIndex((t) => t.id === config.id);
    const finalConfig = { ...config, id: config.isCustom && idx >= 0 ? config.id : `custom_${Date.now()}` };
    if (idx >= 0 && themes[idx].isCustom) {
      themes[idx] = finalConfig;
    } else {
      themes.push(finalConfig);
    }
    saveCustomThemes(themes);
    setCustomThemes(themes);
    setThemeId(finalConfig.id);
    setActiveThemeId(finalConfig.id);
    setShowThemeEditor(false);
    setEditingTheme(null);
    showToast(`主题「${finalConfig.name}」已保存`);
  };

  const handleDeleteTheme = () => {
    if (!editingTheme) return;
    const themes = loadCustomThemes().filter((t) => t.id !== editingTheme.id);
    saveCustomThemes(themes);
    setCustomThemes(themes);
    setThemeId('default');
    setActiveThemeId('default');
    setShowThemeEditor(false);
    setEditingTheme(null);
    showToast('主题已删除');
  };

  // ── 导出与发布 ────────────────────────────────────────

  const handleCopy = async () => {
    try {
      // 公众号后台会剥掉 <style>，复制前走微信导出管线（内联样式 + 微信特有修复）
      const inlined = wechatifyArticle(renderedHtml);
      await copyHtmlToClipboard(inlined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('已复制，可直接粘贴到公众号后台');
    } catch {
      showToast('复制失败，请重试');
    }
  };

  const handleDownload = () => {
    const filename = `${articleTitle || 'article'}.html`.replace(/[\\/:*?"<>|]/g, '_');
    downloadHtmlFile(renderedHtml, filename);
    showToast('已下载 HTML 文件');
  };

  const handleTestConnection = async () => {
    const res = await fetch('/api/wechat/test', { method: 'POST' });
    return res.json();
  };

  const handlePublish = async ({ author, digest, coverFile }: { author: string; digest: string; coverFile: File | null }) => {
    if (!coverFile) return;
    setPublishing(true);
    try {
      const thumbForm = new FormData();
      thumbForm.append('media', coverFile);
      const thumbRes = await fetch('/api/wechat/upload-thumb', { method: 'POST', body: thumbForm });
      const thumbData = await thumbRes.json();
      if (!thumbData.success) throw new Error(thumbData.error || '封面上传失败');

      // 正文图片（含粘贴的 dataURL）统一传微信图床，替换为微信地址
      let finalHtml = renderedHtml;
      const imageSrcs = [...new Set(extractImages(renderedHtml))];
      for (const src of imageSrcs) {
        if (src.includes('qpic.cn')) continue; // 已是微信图床地址，无需重传
        try {
          const payload = isDataUrl(src) ? { dataUrl: src } : { url: src };
          const upRes = await fetch('/api/wechat/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const upData = await upRes.json();
          if (upData.success) {
            finalHtml = finalHtml.split(src).join(upData.url);
          }
        } catch { /* 单张图片失败不阻塞 */ }
      }

      const titleInput = document.getElementById('publish-title') as HTMLInputElement;
      const draftRes = await fetch('/api/wechat/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput?.value || articleTitle,
          author,
          digest,
          // 与复制同一条微信导出管线：微信草稿接口同样会剥掉 <style>
          content: wechatifyArticle(finalHtml),
          thumbMediaId: thumbData.mediaId,
        }),
      });
      const draftData = await draftRes.json();
      if (!draftData.success) throw new Error(draftData.error || '草稿保存失败');

      if (currentDocId) setDocPublished(currentDocId, draftData.mediaId);
      refreshDocs();
      const leftover = (finalHtml.match(/data:image/g) ?? []).length;
      showToast(
        `草稿创建成功${leftover ? `（警告：${leftover} 张图片未传上微信图床）` : ''}，请到公众号后台查看`,
      );
      setShowPublish(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  // ── 状态栏数据 ────────────────────────────────────────

  const currentDoc = currentDocId ? getDoc(currentDocId) : undefined;
  const charCount = markdown.replace(/\s/g, '').length;
  const readMinutes = Math.max(1, Math.round(charCount / 400));

  // ── 渲染 ──────────────────────────────────────────────

  return (
    <div className="app">
      <div className="topbar">
        <span className="topbar-title">公众号 Markdown 排版工作台</span>
        <div className="topbar-spacer" />

        <label className="btn btn-secondary btn-import" title="导入 .md / .txt 文件">
          导入
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={handleImport} hidden />
        </label>

        <select className="theme-select" value={themeId} onChange={(e) => handleThemeSelect(e.target.value)}>
          <optgroup label="内置主题">
            {builtinThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          {customThemes.length > 0 && (
            <optgroup label="我的主题">
              {customThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          )}
          <optgroup label="开源主题 · WeMD">
            {cssThemes.filter((t) => t.source === 'WeMD').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          <optgroup label="开源主题 · doocs/md">
            {cssThemes.filter((t) => t.source === 'doocs/md').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          <option value="__customize__">＋ 自定义主题…</option>
        </select>
        <button
          className="btn btn-secondary"
          onClick={() => { setEditingTheme({ ...getTheme(themeId) }); setShowThemeEditor(true); }}
          disabled={isCssTheme(themeId)}
          title={isCssTheme(themeId) ? '开源 CSS 主题不支持参数编辑，可在「＋ 自定义主题」中派生参数主题' : '编辑当前主题：自定义主题直接修改；内置主题将派生为新的自定义主题'}
        >
          ✎ 编辑主题
        </button>
        <button className="btn btn-secondary" onClick={() => setShowThemeGallery(true)} title="主题缩略图预览">
          🎨 主题
        </button>

        <button className={`btn ${copied ? 'btn-success' : 'btn-secondary'}`} onClick={handleCopy}>
          {copied ? '已复制' : '复制 HTML'}
        </button>
        <button className="btn btn-secondary" onClick={handleDownload}>下载</button>

        <span className="topbar-divider" />
        <button className="btn btn-secondary" onClick={() => setShowSnippets(true)} title="常用片段库">🧩 片段</button>
        <button className="btn btn-secondary" onClick={() => setShowCredentials(true)} title="管理公众号 AppID / AppSecret">
          🔑 凭据{wxConfigured ? '' : '（未配置）'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setDark(!dark)}
          title={dark ? '切换为亮色写作模式' : '切换为深色写作模式'}
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setShowPublish(true)}
          disabled={!wxConfigured}
          title={wxConfigured ? '发布到公众号草稿箱' : '请先在「凭据」中配置公众号 AppID 与 AppSecret'}
        >
          发布
        </button>
      </div>

      <div className="workspace">
        <Sidebar
          docs={docs}
          currentId={currentDocId}
          onSelect={handleSelectDoc}
          onCreate={handleCreateDoc}
          onDelete={handleDeleteDoc}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <div className="editor-pane">
          <Toolbar viewRef={viewRef} />
          <div className="pane-body">
            <Editor
              value={markdown}
              onChange={handleMarkdownChange}
              onCreateView={(v) => { viewRef.current = v; }}
              onPasteImage={handlePasteImage}
              dark={dark}
            />
          </div>
          <div className="statusbar">
            <span>字数 {charCount}</span>
            <span>约 {readMinutes} 分钟读完</span>
            <span className="statusbar-spacer" />
            {currentDoc?.published && (
              <span className="statusbar-published" title={`media_id: ${currentDoc.published.mediaId}`}>
                已发布草稿 · {new Date(currentDoc.published.publishedAt).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
        </div>

        <div className="preview-pane">
          <div className="preview-header">
            <div className="preview-tabs">
              <button
                className={previewMode === 'desktop' ? 'active' : ''}
                onClick={() => setPreviewMode('desktop')}
                title="网页模式预览"
              >
                🖥 网页
              </button>
              <button
                className={previewMode === 'mobile' ? 'active' : ''}
                onClick={() => setPreviewMode('mobile')}
                title="竖屏移动端预览"
              >
                📱 手机
              </button>
            </div>
          </div>
          <div className="pane-body preview-scroll">
            <Preview html={renderedHtml} mode={previewMode} />
          </div>
        </div>
      </div>

      {showPublish && (
        <PublishDialog
          onClose={() => setShowPublish(false)}
          onPublish={handlePublish}
          onTest={handleTestConnection}
          publishing={publishing}
          articleTitle={articleTitle}
          activeAccount={activeAccount}
        />
      )}

      {showCredentials && (
        <CredentialsDialog onClose={() => setShowCredentials(false)} onChanged={refreshCredentials} />
      )}

      {showSnippets && (
        <SnippetsDialog onClose={() => setShowSnippets(false)} onInsert={handleInsertSnippet} />
      )}

      {showThemeGallery && (
        <ThemeGallery currentId={themeId} onSelect={handleGallerySelect} onClose={() => setShowThemeGallery(false)} />
      )}

      {showThemeEditor && editingTheme && (
        <ThemeEditor
          theme={editingTheme}
          onChange={setEditingTheme}
          onSave={handleSaveTheme}
          onDelete={editingTheme.isCustom ? handleDeleteTheme : undefined}
          onClose={() => setShowThemeEditor(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
