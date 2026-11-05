/**
 * 本地服务：静态文件 + 微信 API 代理
 * 零外部依赖，Node.js 原生 http 模块
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CONFIG_PATH = process.env.WXMD_CONFIG_PATH || path.join(__dirname, 'config.json');
const BASE_PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ── 密钥管理 ──────────────────────────────────────────────
// 密钥只保存在本机 config.json（仅存服务端），浏览器端永不返回完整 AppSecret，
// 列表接口只返回掩码信息（仅后 4 位）。

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      // 迁移旧版单账号结构 { appId, appSecret }
      if (!Array.isArray(cfg.accounts)) {
        const accounts = cfg.appId
          ? [{ id: `acct_${Date.now()}`, name: '默认账号', appId: cfg.appId, appSecret: cfg.appSecret || '' }]
          : [];
        const migrated = { accounts, activeId: accounts[0]?.id ?? null };
        saveConfig(migrated);
        return migrated;
      }
      return { accounts: cfg.accounts ?? [], activeId: cfg.activeId ?? null };
    }
  } catch {}
  return { accounts: [], activeId: null };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new Error(`凭据保存失败：软件目录不可写（${path.dirname(CONFIG_PATH)}）。请将软件移动到桌面等普通目录再启动，不要放在 C:\\Program Files 等需要管理员权限的位置`);
    }
    throw err;
  }
}

function activeAccount() {
  const cfg = loadConfig();
  return cfg.accounts.find((a) => a.id === cfg.activeId) ?? null;
}

function maskAccount(a) {
  return {
    id: a.id,
    name: a.name,
    appId: a.appId,
    secretTail: a.appSecret ? a.appSecret.slice(-4) : '',
  };
}

// ── 微信 API 代理 ─────────────────────────────────────────

async function wxRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    const err = new Error(data.errmsg || `微信 API 错误 ${data.errcode}`);
    err.code = data.errcode;
    throw err;
  }
  return data;
}

async function getAccessToken() {
  const account = activeAccount();
  if (!account || !account.appId || !account.appSecret) {
    throw new Error('请先在「凭据管理」中添加并选择公众号账号');
  }
  return wxRequest(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(account.appId)}&secret=${encodeURIComponent(account.appSecret)}`
  );
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${HOST}`);
  const pathname = url.pathname;
  const method = req.method;

  // CSRF 防护：浏览器跨站发起的写请求（表单/ fetch 带 Origin）一律拒绝。
  // 本服务只应被本应用页面调用；curl 等非浏览器客户端不带 Origin，放行。
  if (method !== 'GET' && method !== 'HEAD') {
    const source = req.headers.origin ?? req.headers.referer;
    if (source) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(source).host === req.headers.host;
      } catch { sameOrigin = false; }
      if (!sameOrigin) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
      }
    }
  }

  const json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  try {
    // 测试连接：获取 access_token
    if (pathname === '/api/wechat/test' && method === 'POST') {
      const data = await getAccessToken();
      return json({ success: true, message: '连接成功，access_token 获取正常' });
    }

    // ── 凭据管理 ─────────────────────────────────────

    // 密钥列表（只返回掩码信息，不含完整 AppSecret）
    if (pathname === '/api/credentials' && method === 'GET') {
      const cfg = loadConfig();
      return json({ accounts: cfg.accounts.map(maskAccount), activeId: cfg.activeId });
    }

    // 新增密钥
    if (pathname === '/api/credentials' && method === 'POST') {
      const { name, appId, appSecret } = JSON.parse(await readBody(req));
      if (!appId?.trim() || !appSecret?.trim()) {
        return json({ success: false, error: 'AppID 和 AppSecret 均不能为空' }, 400);
      }
      const cfg = loadConfig();
      const account = {
        id: `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name?.trim() || `账号 ${cfg.accounts.length + 1}`,
        appId: appId.trim(),
        appSecret: appSecret.trim(),
      };
      cfg.accounts.push(account);
      if (!cfg.activeId) cfg.activeId = account.id;
      saveConfig(cfg);
      return json({ success: true, account: maskAccount(account), activeId: cfg.activeId });
    }

    // 更新密钥（appSecret 留空 = 保留原值，界面不回显完整密钥）
    if (pathname === '/api/credentials' && method === 'PUT') {
      const { id, name, appId, appSecret } = JSON.parse(await readBody(req));
      const cfg = loadConfig();
      const account = cfg.accounts.find((a) => a.id === id);
      if (!account) return json({ success: false, error: '账号不存在' }, 404);
      if (name !== undefined && name.trim()) account.name = name.trim();
      if (appId?.trim()) account.appId = appId.trim();
      if (appSecret?.trim()) account.appSecret = appSecret.trim();
      saveConfig(cfg);
      return json({ success: true, account: maskAccount(account) });
    }

    // 删除密钥
    const credDelete = pathname.match(/^\/api\/credentials\/(.+)$/);
    if (credDelete && method === 'DELETE') {
      const cfg = loadConfig();
      cfg.accounts = cfg.accounts.filter((a) => a.id !== credDelete[1]);
      if (cfg.activeId === credDelete[1]) cfg.activeId = cfg.accounts[0]?.id ?? null;
      saveConfig(cfg);
      return json({ success: true, activeId: cfg.activeId });
    }

    // 设为当前账号
    if (pathname === '/api/credentials/activate' && method === 'POST') {
      const { id } = JSON.parse(await readBody(req));
      const cfg = loadConfig();
      if (!cfg.accounts.some((a) => a.id === id)) {
        return json({ success: false, error: '账号不存在' }, 404);
      }
      cfg.activeId = id;
      saveConfig(cfg);
      return json({ success: true, activeId: id });
    }

    // ── 微信素材与草稿 ───────────────────────────────

    // 上传图片到微信素材库，返回微信 URL
    // 支持 { url: 远程地址 } 或 { dataUrl: base64 }（编辑器粘贴的图片）
    if (pathname === '/api/wechat/upload-image' && method === 'POST') {
      const { url: imageUrl, dataUrl } = JSON.parse(await readBody(req));
      const tokenData = await getAccessToken();

      let imgBuffer;
      let filename;
      let contentType;
      if (dataUrl) {
        const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
        if (!m) throw new Error('无效的图片数据');
        contentType = m[1];
        filename = `pasted.${contentType.split('/')[1] || 'png'}`;
        imgBuffer = Buffer.from(m[3], 'base64');
      } else if (imageUrl) {
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (!imgRes.ok) throw new Error(`图片下载失败: ${imgRes.status}`);
        imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        contentType = imgRes.headers.get('content-type') || 'application/octet-stream';
        filename = path.basename(new URL(imageUrl).pathname) || 'image.png';
      } else {
        throw new Error('缺少图片地址或数据');
      }
      if (imgBuffer.length > 10 * 1024 * 1024) {
        throw new Error('图片超过 10MB 限制');
      }

      // 构造 multipart/form-data
      const boundary = '----wxmdboundary' + Date.now();
      const head = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
      );
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([head, imgBuffer, tail]);

      const uploadRes = await fetch(
        `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${tokenData.access_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body,
          signal: AbortSignal.timeout(15000),
        }
      );
      const uploadData = await uploadRes.json();
      if (uploadData.errcode) {
        throw new Error(uploadData.errmsg || '图片上传失败');
      }
      return json({ success: true, url: uploadData.url });
    }

    // 创建草稿（产品决策：永远新增，不更新已有草稿）
    if (pathname === '/api/wechat/draft' && method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const { title, content, thumbMediaId, author, digest } = body;
      const tokenData = await getAccessToken();

      const draftData = await wxRequest(
        `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${tokenData.access_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: [{
              title,
              content,
              author: author || '',
              digest: digest || '',
              thumb_media_id: thumbMediaId,
              need_open_comment: 0,
              only_fans_can_comment: 0,
            }],
          }),
        }
      );
      return json({ success: true, mediaId: draftData.media_id });
    }

    // 上传封面图（本地文件 → 永久素材）
    if (pathname === '/api/wechat/upload-thumb' && method === 'POST') {
      const tokenData = await getAccessToken();
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      // 从 Content-Type 解析 boundary 和 filename
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) throw new Error('无效的 multipart 请求');
      const boundary = boundaryMatch[1];
      const filePart = parseMultipart(fileBuffer, boundary);

      const wxBoundary = '----wxthumbboundary' + Date.now();
      const head = Buffer.from(
        `--${wxBoundary}\r\nContent-Disposition: form-data; name="media"; filename="${filePart.filename}"; filelength=${filePart.data.length}\r\nContent-Type: ${filePart.contentType}\r\n\r\n`
      );
      const tail = Buffer.from(`\r\n--${wxBoundary}--\r\n`);
      const wxBody = Buffer.concat([head, filePart.data, tail]);

      const uploadRes = await fetch(
        `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${tokenData.access_token}&type=thumb`,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${wxBoundary}` },
          body: wxBody,
          signal: AbortSignal.timeout(15000),
        }
      );
      const uploadData = await uploadRes.json();
      if (uploadData.errcode) {
        throw new Error(uploadData.errmsg || '封面上传失败');
      }
      return json({ success: true, mediaId: uploadData.media_id });
    }

    // 查询本机公网 IP（供公众号 IP 白名单配置提示用）
    if (pathname === '/api/network/public-ip' && method === 'GET') {
      const services = [
        'https://api.ipify.org',
        'https://ifconfig.me/ip',
        'https://ipinfo.io/ip',
      ];
      for (const svc of services) {
        try {
          const r = await fetch(svc, { signal: AbortSignal.timeout(3500) });
          if (r.ok) {
            const ip = (await r.text()).trim();
            if (/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}$/i.test(ip)) {
              return json({ success: true, ip });
            }
          }
        } catch { /* 该服务不可达，尝试下一个 */ }
      }
      return json({ success: false, error: '获取公网 IP 失败，请访问 ip.sb 等网站手动查询' });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (err) {
    const message = err.code === 40164
      ? '调用 IP 未加入白名单，请到公众号后台「设置-安全中心-IP 白名单」添加本机公网 IP'
      : err.message;
    // errcode 供前端识别 40164 并展示本机公网 IP
    return json({ success: false, error: message, errcode: err.code ?? null }, 500);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const str = buffer.toString('binary');
  const parts = str.split(`--${boundary}`);
  for (const part of parts) {
    if (part.includes('Content-Disposition') && part.includes('filename=')) {
      const headerEnd = part.indexOf('\r\n\r\n');
      const header = part.slice(0, headerEnd);
      const dataStart = headerEnd + 4;
      const data = part.slice(dataStart, part.length - 2); // remove trailing \r\n
      const filenameMatch = header.match(/filename="([^"]*)"/);
      const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/);
      return {
        filename: filenameMatch ? filenameMatch[1] : 'upload.jpg',
        contentType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
        data: Buffer.from(data, 'binary'),
      };
    }
  }
  throw new Error('未找到文件数据');
}

// ── 静态文件服务 ──────────────────────────────────────────

// gzip 缓存：key = 文件路径，value = { mtimeMs, data }
const gzipCache = new Map();
const GZIP_MAX_CACHE = 64;

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        return fs.createReadStream(fallback).pipe(res);
      }
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // 带内容哈希的构建产物可长缓存，其余不缓存
      'Cache-Control': pathname.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache',
    };

    // 文本资源按需 gzip（本地 CPU 开销可忽略，传输体积约为原文 1/3）
    const accept = req.headers['accept-encoding'] || '';
    if ((ext === '.js' || ext === '.css' || ext === '.html') && accept.includes('gzip')) {
      let entry = gzipCache.get(filePath);
      if (!entry || entry.mtimeMs !== stats.mtimeMs) {
        if (gzipCache.size >= GZIP_MAX_CACHE) gzipCache.clear();
        entry = { mtimeMs: stats.mtimeMs, data: zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }) };
        gzipCache.set(filePath, entry);
      }
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      return res.end(entry.data);
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

// ── 服务器启动与优雅关闭 ─────────────────────────────────

function createServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) {
        handleApi(req, res);
      } else {
        serveStatic(req, res);
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ port: null, server: null });
      } else {
        reject(err);
      }
    });

    server.listen(port, HOST, () => {
      resolve({ port, server });
    });
  });
}

async function start() {
  let port = BASE_PORT;
  let result = null;

  for (let i = 0; i < 20; i++) {
    result = await createServer(port);
    if (result.server) break;
    port++;
  }

  if (!result.server) {
    console.error(`错误: 端口 ${BASE_PORT}-${BASE_PORT + 19} 均被占用`);
    process.exit(1);
  }

  const url = `http://localhost:${result.port}`;
  console.log('');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │   公众号 Markdown 排版工作台         │');
  console.log('  └─────────────────────────────────────┘');
  console.log('');
  console.log(`  ➜ 本地地址: ${url}`);
  console.log(`  ➜ 配置文件: ${CONFIG_PATH}`);
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');

  // 自动打开浏览器（测试/打包环境设 WXMD_NO_OPEN=1 跳过）
  if (!process.env.WXMD_NO_OPEN) {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore', detached: true }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
    }
  }

  // 优雅关闭
  const shutdown = () => {
    console.log('\n正在停止服务...');
    result.server.close(() => {
      console.log('服务已停止');
      process.exit(0);
    });
    // 强制退出兜底
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
