/**
 * 凭据管理：多公众号账号的新增/更新/删除/激活
 * 密钥只存服务端 config.json，前端只能拿到掩码信息（后 4 位）
 */

export interface CredentialAccount {
  id: string;
  name: string;
  appId: string;
  secretTail: string;
}

export interface CredentialsState {
  accounts: CredentialAccount[];
  activeId: string | null;
}

export async function fetchCredentials(): Promise<CredentialsState> {
  const res = await fetch('/api/credentials');
  if (!res.ok) throw new Error('读取凭据失败');
  return res.json();
}

export async function createCredential(input: {
  name: string; appId: string; appSecret: string;
}): Promise<CredentialsState> {
  const res = await fetch('/api/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '新增失败');
  return fetchCredentials();
}

export async function updateCredential(input: {
  id: string; name?: string; appId?: string; appSecret?: string;
}): Promise<void> {
  const res = await fetch('/api/credentials', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '更新失败');
}

export async function deleteCredential(id: string): Promise<CredentialsState> {
  const res = await fetch(`/api/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '删除失败');
  return fetchCredentials();
}

export async function activateCredential(id: string): Promise<CredentialsState> {
  const res = await fetch('/api/credentials/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || '切换失败');
  return fetchCredentials();
}
