import { useMemo, useState } from 'react';
import type { Doc } from '../lib/docs';
import { docTitle, searchDocs } from '../lib/docs';

interface SidebarProps {
  docs: Doc[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function Sidebar({ docs, currentId, onSelect, onCreate, onDelete, collapsed, onToggle }: SidebarProps) {
  const [keyword, setKeyword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => searchDocs(keyword), [keyword, docs]);

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sidebar-toggle" onClick={onToggle} title="展开侧栏">»</button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="btn btn-primary btn-new" onClick={onCreate}>＋ 新建文章</button>
        <button className="sidebar-toggle" onClick={onToggle} title="收起侧栏">«</button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="搜索文章..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <div className="sidebar-label">历史记录</div>

      <div className="sidebar-list">
        {filtered.length === 0 && <div className="sidebar-empty">{keyword ? '没有匹配的文章' : '还没有文章，点击上方新建'}</div>}
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className={`sidebar-item ${doc.id === currentId ? 'active' : ''}`}
            onClick={() => onSelect(doc.id)}
          >
            <div className="sidebar-item-title">{docTitle(doc)}</div>
            <div className="sidebar-item-meta">
              <span>{formatTime(doc.updatedAt)}</span>
              {doc.published && (
                <span
                  className="sidebar-badge"
                  title={`已发布到草稿箱 · ${new Date(doc.published.publishedAt).toLocaleString('zh-CN')}`}
                >
                  已发布
                </span>
              )}
              {confirmDelete === doc.id ? (
                <span className="sidebar-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="link danger" onClick={() => { onDelete(doc.id); setConfirmDelete(null); }}>确认</button>
                  <button className="link" onClick={() => setConfirmDelete(null)}>取消</button>
                </span>
              ) : (
                <button
                  className="sidebar-item-delete"
                  title="删除"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(doc.id); }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
