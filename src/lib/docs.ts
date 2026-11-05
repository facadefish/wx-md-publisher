/**
 * 文档管理：localStorage 持久化，支持新建/列表/搜索/删除
 * 内存缓存 + 防抖落盘：避免每次击键都全量序列化所有文档
 * （粘贴大图后文档体积可达数 MB，全量写入会造成输入卡顿）
 */

export interface Doc {
  id: string;
  content: string;
  updatedAt: number;
  /** 发布记录（media_id 仅留档，产品决策：发布永远新增草稿，不更新） */
  published?: { mediaId: string; publishedAt: number };
}

const KEY = 'wx-md-docs-v1';
const CURRENT_KEY = 'wx-md-current-doc';
const FLUSH_DELAY = 400;

let cache: Doc[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Doc[] {
  if (cache === null) {
    let docs: Doc[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      docs = raw ? (JSON.parse(raw) as Doc[]) : [];
    } catch {
      docs = [];
    }
    cache = docs;
  }
  return cache;
}

/** 立即写入 localStorage（防抖计时器触发或页面卸载时调用） */
function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (cache === null) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (err) {
    // 超出 localStorage 配额（如粘贴过多大图）：静默失败会丢稿，至少留痕
    console.warn('[docs] 写入 localStorage 失败（可能超出配额），本次改动未持久化:', err);
  }
}

function save(docs: Doc[]): void {
  cache = docs;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_DELAY);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
}

/**
 * 订阅其他标签页/窗口的文档变更（storage 事件只触发在非写入的页面上）。
 * 用于多开场景下的数据同步；返回取消订阅函数。
 * 注意：同步是尽力而为的——两个页面同时编辑同一篇文档仍是最后写入者胜出。
 */
export function onDocsExternalChange(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) handler();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export function reloadDocs(): void {
  cache = null;
  load();
}

export function listDocs(): Doc[] {
  return [...load()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDoc(id: string): Doc | undefined {
  return load().find((d) => d.id === id);
}

export function createDoc(content = ''): Doc {
  const doc: Doc = { id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, content, updatedAt: Date.now() };
  save([doc, ...load()]);
  return doc;
}

export function updateDoc(id: string, content: string): void {
  const docs = load();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.content = content;
    doc.updatedAt = Date.now();
    save(docs);
  }
}

export function setDocPublished(id: string, mediaId: string): void {
  const docs = load();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.published = { mediaId, publishedAt: Date.now() };
    save(docs);
  }
}

export function deleteDoc(id: string): void {
  save(load().filter((d) => d.id !== id));
}

export function getCurrentDocId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentDocId(id: string): void {
  localStorage.setItem(CURRENT_KEY, id);
}

export function docTitle(doc: Doc): string {
  const firstLine = doc.content.split('\n').find((l) => l.trim())?.trim() ?? '';
  const title = firstLine.replace(/^#+\s*/, '').trim();
  return title || '未命名文档';
}

export function searchDocs(keyword: string): Doc[] {
  const kw = keyword.trim().toLowerCase();
  const all = listDocs();
  if (!kw) return all;
  return all.filter(
    (d) => docTitle(d).toLowerCase().includes(kw) || d.content.toLowerCase().includes(kw)
  );
}
