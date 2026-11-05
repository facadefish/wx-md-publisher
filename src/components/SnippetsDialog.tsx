import { useState } from 'react';
import type { Snippet } from '../lib/snippets';
import { listSnippets, createSnippet, updateSnippet, deleteSnippet } from '../lib/snippets';
import { useEscape } from '../lib/useEscape';

interface SnippetsDialogProps {
  onClose: () => void;
  onInsert: (content: string) => void;
}

export function SnippetsDialog({ onClose, onInsert }: SnippetsDialogProps) {
  const [snippets, setSnippets] = useState<Snippet[]>(() => listSnippets());
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEscape(onClose);

  const refresh = () => setSnippets(listSnippets());

  const startEdit = (s: Snippet) => {
    setEditing(s.id);
    setName(s.name);
    setContent(s.content);
  };

  const startNew = () => {
    setEditing('new');
    setName('');
    setContent('');
  };

  const handleSave = () => {
    if (!content.trim()) return;
    if (editing === 'new') createSnippet(name, content);
    else if (editing) updateSnippet(editing, name, content);
    setEditing(null);
    refresh();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">常用片段</h2>
        <div className="form-hint" style={{ marginBottom: 14 }}>
          保存开头、结尾、分隔线等常用文案，点击「插入」写入光标处。
        </div>

        {snippets.length === 0 && !editing && <div className="cred-empty">还没有保存任何片段</div>}

        <div className="cred-list">
          {snippets.map((s) => (
            <div key={s.id} className="cred-item">
              {editing === s.id ? (
                <SnippetForm
                  name={name} content={content}
                  onName={setName} onContent={setContent}
                  onSave={handleSave} onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="cred-info">
                    <span className="cred-name">{s.name}</span>
                    <span className="cred-meta snippet-preview">
                      {s.content.replace(/\n/g, ' ↵ ').slice(0, 60)}
                    </span>
                  </div>
                  <div className="cred-actions">
                    {confirmDelete === s.id ? (
                      <>
                        <button className="link danger" onClick={() => { deleteSnippet(s.id); setConfirmDelete(null); refresh(); }}>确认删除</button>
                        <button className="link" onClick={() => setConfirmDelete(null)}>取消</button>
                      </>
                    ) : (
                      <>
                        <button className="link" onClick={() => { onInsert(s.content); onClose(); }}>插入</button>
                        <button className="link" onClick={() => startEdit(s)}>编辑</button>
                        <button className="link danger" onClick={() => setConfirmDelete(s.id)}>删除</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {editing === 'new' && (
          <div style={{ marginTop: 12 }}>
            <SnippetForm
              name={name} content={content}
              onName={setName} onContent={setContent}
              onSave={handleSave} onCancel={() => setEditing(null)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          {!editing && <button className="btn btn-primary" onClick={startNew}>＋ 新建片段</button>}
        </div>
      </div>
    </div>
  );
}

function SnippetForm({ name, content, onName, onContent, onSave, onCancel }: {
  name: string; content: string;
  onName: (v: string) => void; onContent: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="cred-form">
      <div className="te-row">
        <label>名称</label>
        <input type="text" value={name} onChange={(e) => onName(e.target.value)} placeholder="如：开头自我介绍" />
      </div>
      <div className="te-row" style={{ alignItems: 'flex-start' }}>
        <label>内容</label>
        <textarea
          className="snippet-textarea"
          value={content}
          onChange={(e) => onContent(e.target.value)}
          rows={4}
          placeholder="支持 Markdown 语法"
        />
      </div>
      <div className="cred-actions">
        <button className="btn btn-secondary" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!content.trim()}>保存</button>
      </div>
    </div>
  );
}
