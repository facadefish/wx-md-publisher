import { useEffect, useState } from 'react';
import type { CredentialAccount } from '../lib/credentials';
import { useEscape } from '../lib/useEscape';
import {
  fetchCredentials, createCredential, updateCredential, deleteCredential, activateCredential,
} from '../lib/credentials';

interface CredentialsDialogProps {
  onClose: () => void;
  /** 凭据变化后回调（App 据此刷新发布按钮可用状态） */
  onChanged: () => void;
}

export function CredentialsDialog({ onClose, onChanged }: CredentialsDialogProps) {
  const [accounts, setAccounts] = useState<CredentialAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEscape(onClose);

  const refresh = async () => {
    try {
      const data = await fetchCredentials();
      setAccounts(data.accounts);
      setActiveId(data.activeId);
    } catch {
      setError('读取凭据失败，请确认本地服务已启动');
    }
  };

  useEffect(() => { refresh(); }, []);

  const startEdit = (a: CredentialAccount) => {
    setEditing(a.id);
    setName(a.name);
    setAppId(a.appId);
    setAppSecret('');
    setError('');
  };

  const startNew = () => {
    setEditing('new');
    setName('');
    setAppId('');
    setAppSecret('');
    setError('');
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') {
        const data = await createCredential({ name, appId, appSecret });
        setAccounts(data.accounts);
        setActiveId(data.activeId);
      } else if (editing) {
        await updateCredential({ id: editing, name, appId, appSecret });
        await refresh();
      }
      setEditing(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (id: string) => {
    const data = await activateCredential(id);
    setAccounts(data.accounts);
    setActiveId(data.activeId);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    const data = await deleteCredential(id);
    setAccounts(data.accounts);
    setActiveId(data.activeId);
    setConfirmDelete(null);
    onChanged();
  };

  const isNew = editing === 'new';
  const canSave = appId.trim() && (isNew ? appSecret.trim() : true);

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">公众号凭据管理</h2>
        <div className="form-hint" style={{ marginBottom: 14 }}>
          密钥仅保存在本机服务端的 config.json，不会上传到任何第三方；列表不回显完整 AppSecret。
        </div>

        {accounts.length === 0 && !editing && (
          <div className="cred-empty">还没有配置任何公众号账号</div>
        )}

        <div className="cred-list">
          {accounts.map((a) => (
            <div key={a.id} className={`cred-item ${a.id === activeId ? 'active' : ''}`}>
              {editing === a.id ? (
                <div className="cred-form">
                  <div className="te-row">
                    <label>名称</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：个人号 / 公司号" />
                  </div>
                  <div className="te-row">
                    <label>AppID</label>
                    <input type="text" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="wx..." />
                  </div>
                  <div className="te-row">
                    <label>AppSecret</label>
                    <input
                      type="password"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder="留空则保留原密钥"
                    />
                  </div>
                  <div className="cred-actions">
                    <button className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>取消</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={busy || !canSave}>保存</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="cred-info">
                    <span className="cred-name">
                      {a.name}
                      {a.id === activeId && <span className="cred-badge">当前</span>}
                    </span>
                    <span className="cred-meta">{a.appId} · ****{a.secretTail || '****'}</span>
                  </div>
                  <div className="cred-actions">
                    {confirmDelete === a.id ? (
                      <>
                        <button className="link danger" onClick={() => handleDelete(a.id)}>确认删除</button>
                        <button className="link" onClick={() => setConfirmDelete(null)}>取消</button>
                      </>
                    ) : (
                      <>
                        {a.id !== activeId && (
                          <button className="link" onClick={() => handleActivate(a.id)}>设为当前</button>
                        )}
                        <button className="link" onClick={() => startEdit(a)}>编辑</button>
                        <button className="link danger" onClick={() => setConfirmDelete(a.id)}>删除</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {isNew && (
          <div className="cred-form" style={{ marginTop: 12 }}>
            <div className="te-row">
              <label>名称</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：个人号 / 公司号" />
            </div>
            <div className="te-row">
              <label>AppID</label>
              <input type="text" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="wx..." />
            </div>
            <div className="te-row">
              <label>AppSecret</label>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="AppSecret"
              />
            </div>
            <div className="cred-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy || !canSave}>保存</button>
            </div>
          </div>
        )}

        {error && <div className="status-msg error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          {!editing && <button className="btn btn-primary" onClick={startNew}>＋ 新增账号</button>}
        </div>
      </div>
    </div>
  );
}
