/**
 * 片段库：常用文案模板（开头/结尾/分隔线等），localStorage 持久化
 */

export interface Snippet {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

const KEY = 'wx-md-snippets-v1';

function load(): Snippet[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(snippets: Snippet[]): void {
  localStorage.setItem(KEY, JSON.stringify(snippets));
}

export function listSnippets(): Snippet[] {
  return load().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSnippet(name: string, content: string): Snippet {
  const snippet: Snippet = {
    id: `snip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || '未命名片段',
    content,
    updatedAt: Date.now(),
  };
  save([snippet, ...load()]);
  return snippet;
}

export function updateSnippet(id: string, name: string, content: string): void {
  const snippets = load();
  const s = snippets.find((x) => x.id === id);
  if (s) {
    s.name = name.trim() || s.name;
    s.content = content;
    s.updatedAt = Date.now();
    save(snippets);
  }
}

export function deleteSnippet(id: string): void {
  save(load().filter((s) => s.id !== id));
}
