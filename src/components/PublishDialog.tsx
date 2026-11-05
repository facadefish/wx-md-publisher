import { useState } from 'react';
import type { CredentialAccount } from '../lib/credentials';
import { useEscape } from '../lib/useEscape';

interface PublishDialogProps {
  onClose: () => void;
  onPublish: (opts: { author: string; digest: string; coverFile: File | null }) => void;
  onTest: () => Promise<{ success: boolean; message: string; errcode?: number | null }>;
  publishing: boolean;
  articleTitle: string;
  /** 当前生效的公众号账号（凭据管理中选择），未配置则为 null */
  activeAccount: CredentialAccount | null;
}

export function PublishDialog({
  onClose, onPublish, onTest, publishing, articleTitle, activeAccount,
}: PublishDialogProps) {
  const [author, setAuthor] = useState('');
  const [digest, setDigest] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [publicIp, setPublicIp] = useState('');
  const [ipCopied, setIpCopied] = useState(false);
  useEscape(onClose);

  const fetchPublicIp = () => {
    setPublicIp('');
    fetch('/api/network/public-ip')
      .then((r) => r.json())
      .then((d) => { if (d.success) setPublicIp(d.ip); })
      .catch(() => {});
  };

  const handleCopyIp = async () => {
    try {
      await navigator.clipboard.writeText(publicIp);
      setIpCopied(true);
      setTimeout(() => setIpCopied(false), 2000);
    } catch { /* 剪贴板不可用时用户可手动选择复制 */ }
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMsg('');
    try {
      const result = await onTest();
      if (result.success) {
        setTestStatus('success');
        setTestMsg(result.message);
        setPublicIp('');
      } else {
        setTestStatus('error');
        setTestMsg(result.message);
        // IP 白名单错误：自动查询本机公网 IP 供用户直接复制
        if (result.errcode === 40164) fetchPublicIp();
      }
    } catch (err) {
      setTestStatus('error');
      setTestMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">发布到公众号草稿箱</h2>

        <div className="form-group">
          <label className="form-label">文章标题（自动从 Markdown 提取，可修改）</label>
          <input className="form-input" defaultValue={articleTitle} id="publish-title" />
        </div>

        <div className="form-group">
          <label className="form-label">作者（选填）</label>
          <input className="form-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="作者名" />
        </div>

        <div className="form-group">
          <label className="form-label">摘要（选填，不填则自动截取正文）</label>
          <input className="form-input" value={digest} onChange={(e) => setDigest(e.target.value)} placeholder="文章摘要" />
        </div>

        <div className="form-group">
          <label className="form-label">封面图（必选，JPG/PNG，小于 5MB）</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="form-input"
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          />
          <div className="form-hint">用于公众号文章封面，建议选择 2.35:1 比例图片</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />

        <div className="form-group">
          <label className="form-label">发布账号</label>
          {activeAccount ? (
            <div className="publish-account">
              {activeAccount.name}（{activeAccount.appId}）
            </div>
          ) : (
            <div className="status-msg error">尚未配置公众号凭据，请关闭窗口后点击顶栏「凭据」添加</div>
          )}
          <div className="form-hint">账号与密钥在顶栏「凭据」中管理，密钥只保存在本机，不会明文显示</div>
        </div>

        {testStatus !== 'idle' && (
          <div className={`status-msg ${testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : ''}`}>
            {testStatus === 'testing' ? '正在测试连接...' : testMsg}
          </div>
        )}

        {publicIp && (
          <div className="ip-box">
            <span className="ip-label">当前公网 IP</span>
            <code className="ip-value">{publicIp}</code>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyIp}>
              {ipCopied ? '已复制' : '复制'}
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={publishing}>
            取消
          </button>
          <button className="btn btn-secondary" onClick={handleTest} disabled={publishing || !activeAccount}>
            测试连接
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onPublish({ author, digest, coverFile })}
            disabled={publishing || !coverFile || !activeAccount}
          >
            {publishing ? '发布中...' : '发布草稿'}
          </button>
        </div>
      </div>
    </div>
  );
}
