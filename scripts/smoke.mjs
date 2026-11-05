/**
 * 服务端到端冒烟测试：拉起真实服务进程，走 HTTP 断言关键行为。
 * 使用临时配置文件与独立端口，不触碰本机数据。
 *
 *   npm run smoke           离线项目（跳过公网 IP 探测）
 *   npm run smoke --online  包含公网 IP 探测（需要外网）
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4390;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = path.join(os.tmpdir(), `wxmd-smoke-config-${Date.now()}.json`);
const ONLINE = process.argv.includes('--online');

let server;
let assetName = '';

function api(method, pathname, { body, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  return fetch(BASE + pathname, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

/** 不经过客户端 URL 规范化的原始请求（测目录穿越/畸形转义用） */
function rawRequest(method, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: rawPath, method }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), WXMD_NO_OPEN: '1', WXMD_CONFIG_PATH: CONFIG },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  // 等待服务就绪
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('服务启动超时');
});

after(() => {
  server?.kill();
  fs.rmSync(CONFIG, { force: true });
});

test('首页与静态资源', async () => {
  const res = await fetch(BASE + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  const m = html.match(/assets\/index-[^"]+\.js/);
  assert.ok(m, 'index.html 应引用构建后的 JS');
  assetName = m[0];

  const gz = await api('GET', '/' + assetName);
  assert.equal(gz.status, 200);

  const theme = await api('GET', '/themes/wemd-default.css');
  assert.equal(theme.status, 200);
  const css = await theme.text();
  assert.ok(css.includes('.wx-article'), '主题 CSS 应包含作用域选择器');
});

test('gzip 与缓存头', async () => {
  const res = await fetch(BASE + '/' + assetName, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.match(res.headers.get('cache-control'), /immutable/);

  const idx = await fetch(BASE + '/');
  assert.equal(idx.headers.get('cache-control'), 'no-cache');
});

test('路径安全：目录穿越与畸形 URL', async () => {
  // %2e%2e 即 ..：无论返回什么状态码，响应体都不得包含 public 外的文件内容
  const trav = await rawRequest('GET', '/%2e%2e/%2e%2e/server/config.json');
  assert.ok(!trav.body.includes('appSecret'), '目录穿越不得读到 server/config.json 内容');
  assert.ok(!trav.body.includes('wx-article'), '目录穿越不得读到项目源文件内容');

  // 非法 UTF-8 转义：服务端不得崩溃（返回 400 且后续请求正常）
  const bad = await rawRequest('GET', '/%ff');
  assert.equal(bad.status, 400);
  const alive = await fetch(BASE + '/');
  assert.equal(alive.status, 200);
});

test('CSRF：跨源写请求被拒绝，同源/CLI 放行', async () => {
  const evil = await api('POST', '/api/credentials', {
    body: { name: 'x', appId: 'a', appSecret: 'b' },
    origin: 'https://evil.example.com',
  });
  assert.equal(evil.status, 403);

  const same = await api('POST', '/api/credentials', {
    body: { name: 'x', appId: '', appSecret: '' },
    origin: BASE,
  });
  assert.equal(same.status, 400); // 过了来源校验，被参数校验拦下

  const cli = await api('POST', '/api/credentials', { body: { name: 'x', appId: '', appSecret: '' } });
  assert.equal(cli.status, 400);
});

test('凭据全生命周期（掩码返回，无明文泄漏）', async () => {
  const create = await api('POST', '/api/credentials', {
    body: { name: '冒烟', appId: 'wx-smoke', appSecret: 'smoke-secret' },
    origin: BASE,
  });
  assert.equal(create.status, 200);
  const created = await create.json();
  assert.equal(created.account.secretTail, 'cret');
  assert.ok(!JSON.stringify(created).includes('smoke-secret'), '响应不得包含完整密钥');

  const list = await (await api('GET', '/api/credentials')).json();
  assert.equal(list.accounts.length, 1);
  assert.ok(!JSON.stringify(list).includes('smoke-secret'));

  // 更新：密钥留空保留
  const updRes = await api('PUT', '/api/credentials', {
    body: { id: created.account.id, name: '冒烟2', appSecret: '' },
    origin: BASE,
  });
  assert.equal(updRes.status, 200);
  const updated = await updRes.json();
  assert.equal(updated.account.name, '冒烟2');
  assert.equal(updated.account.secretTail, created.account.secretTail);

  const del = await api('DELETE', `/api/credentials/${created.account.id}`, { origin: BASE });
  assert.equal(del.status, 200);
  const after1 = await (await api('GET', '/api/credentials')).json();
  assert.equal(after1.accounts.length, 0);
});

test('未配置凭据时微信代理给出明确错误', async () => {
  const res = await api('POST', '/api/wechat/test', { origin: BASE });
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.ok(data.error.includes('凭据'));
});

test('公网 IP 接口', { skip: !ONLINE && '需要外网，使用 --online 开启' }, async () => {
  const res = await api('GET', '/api/network/public-ip');
  assert.equal(res.status, 200);
  const data = await res.json();
  if (!data.success) assert.match(data.error, /获取公网 IP 失败/);
  else assert.match(data.ip, /^(\d{1,3}\.){3}\d{1,3}$/);
});

test('配置文件不落盘脏数据', () => {
  const raw = fs.readFileSync(CONFIG, 'utf-8');
  const cfg = JSON.parse(raw);
  assert.ok(Array.isArray(cfg.accounts), '临时配置应为多账号结构');
});
