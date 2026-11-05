/**
 * 跨平台便携包打包：把零依赖 server + 预构建 public/ + 对应平台的 Node 运行时
 * 组装成一个压缩包，用户下载解压后双击即用，无需安装 Node。
 *
 *   node scripts/package.mjs [win-x64|darwin-x64|darwin-arm64|linux-x64]
 *
 * 隐私红线：打包内容绝不含 server/config.json（用户密钥），组装后显式校验。
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RELEASE = path.join(ROOT, 'release');
const DIST_CACHE = path.join(RELEASE, '.runtime-cache');
const NODE_VERSION = 'v22.14.0';

const PLATFORMS = {
  'win-x64':      { ext: 'zip',    bin: 'node.exe', entry: '启动工作台.bat' },
  'darwin-x64':   { ext: 'tar.gz', bin: 'node',     entry: 'start.command' },
  'darwin-arm64': { ext: 'tar.gz', bin: 'node',     entry: 'start.command' },
  'linux-x64':    { ext: 'tar.gz', bin: 'node',     entry: 'start.sh' },
};

const target = process.argv[2] || (
  process.platform === 'win32' ? 'win-x64'
    : process.platform === 'darwin' ? (process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64')
      : 'linux-x64'
);
const spec = PLATFORMS[target];
if (!spec) {
  console.error(`不支持的平台: ${target}，可选: ${Object.keys(PLATFORMS).join(' / ')}`);
  process.exit(1);
}

const require = createRequire(path.join(ROOT, 'package.json'));
const version = require('./package.json').version;
const appName = `wx-md-publisher-${version}-${target}`;
const stageDir = path.join(RELEASE, appName);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败`);
}

// 非 Windows 打包/校验用系统 tar；Windows 的 zip 不走外部工具（见 createZip）
const TAR = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  : 'tar';

// 自实现最简 zip 写入（仅 win 便携包用）。外部工具全有坑：Git Bash 里 `tar` 是 GNU tar
// 不认 zip；资源管理器同款 bsdtar 按系统 ACP（GBK）存文件名且不加 UTF-8(EFS) 标志，
// 非中文 Windows 上中文文件名必乱码。这里直接写 zip 格式：UTF-8 名 + EFS + deflate
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
function createZip(dir, outFile, prefix) {
  const entries = [];
  (function walk(d, rel) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const r = rel ? `${rel}/${f}` : f;
      if (fs.statSync(p).isDirectory()) walk(p, r);
      else entries.push({ p, r });
    }
  })(dir, prefix);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { p, r } of entries) {
    const data = fs.readFileSync(p);
    const name = Buffer.from(r, 'utf-8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const { date, time } = dosDateTime(fs.statSync(p).mtime);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);       // 解压所需最低版本
    head.writeUInt16LE(0x0800, 6);   // EFS：文件名按 UTF-8 解析
    head.writeUInt16LE(8, 8);        // deflate
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    parts.push(head, name, packed);
    central.push({ name, crc, packed: packed.length, size: data.length, offset, date, time });
    offset += head.length + name.length + packed.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0);
    h.writeUInt16LE(20, 4);          // 创建工具版本
    h.writeUInt16LE(20, 6);          // 解压所需最低版本
    h.writeUInt16LE(0x0800, 8);      // EFS
    h.writeUInt16LE(8, 10);
    h.writeUInt16LE(e.time, 12);
    h.writeUInt16LE(e.date, 14);
    h.writeUInt32LE(e.crc, 16);
    h.writeUInt32LE(e.packed, 20);
    h.writeUInt32LE(e.size, 24);
    h.writeUInt16LE(e.name.length, 28);
    h.writeUInt32LE(e.offset, 42);
    parts.push(h, e.name);
    offset += h.length + e.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - cdStart, 12);   // central directory 大小
  end.writeUInt32LE(cdStart, 16);            // central directory 起始偏移
  parts.push(end);
  fs.writeFileSync(outFile, Buffer.concat(parts));
}

// 自解析 zip 中央目录（自写自读）：windows-2022 等旧环境自带的 bsdtar 按本地代码页解码
// UTF-8 文件名，会误报 unreadable filename——产物校验必须自洽，不依赖外部工具的字符集行为
function listZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('产物自校验失败：找不到 zip 目录结尾记录（EOCD），不是合法 zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`产物自校验失败：中央目录第 ${n + 1} 条签名错误`);
    const flags = buf.readUInt16LE(p + 8);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    entries.push({ name: buf.slice(p + 46, p + 46 + nameLen).toString('utf-8'), flags });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ── 0. 确保构建产物存在 ───────────────────────────────────
if (!fs.existsSync(path.join(ROOT, 'public', 'index.html'))) {
  console.log('构建产物缺失，先执行构建...');
  run(process.execPath, [require.resolve('vite/bin/vite.js'), 'build']);
}

// ── 1. 下载运行时（带缓存）────────────────────────────────
fs.mkdirSync(DIST_CACHE, { recursive: true });
const base = `node-${NODE_VERSION}-${target}`;
const distFile = path.join(DIST_CACHE, `${base}.${spec.ext}`);
if (!fs.existsSync(distFile)) {
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${base}.${spec.ext}`;
  console.log(`下载 Node 运行时: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);
  fs.writeFileSync(distFile, Buffer.from(await res.arrayBuffer()));
} else {
  console.log(`复用缓存的运行时: ${distFile}`);
}

// ── 2. 解压运行时 ─────────────────────────────────────────
const extractDir = path.join(DIST_CACHE, base);
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
if (spec.ext === 'zip') {
  run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${distFile}' '${extractDir}'`]);
} else {
  run('tar', ['-xf', distFile, '-C', extractDir]);
}
const extractedRoot = path.join(extractDir, fs.readdirSync(extractDir)[0]);
const nodeBin = target === 'win-x64'
  ? path.join(extractedRoot, 'node.exe')
  : path.join(extractedRoot, 'bin', 'node');
if (!fs.existsSync(nodeBin)) throw new Error('运行时解压结果异常：找不到 node 二进制');

// ── 3. 组装 ───────────────────────────────────────────────
console.log(`组装 ${appName} ...`);
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(stageDir, 'runtime'), { recursive: true });
fs.mkdirSync(path.join(stageDir, 'server'), { recursive: true });
fs.cpSync(nodeBin, path.join(stageDir, 'runtime', spec.bin));
fs.cpSync(path.join(ROOT, 'server', 'index.js'), path.join(stageDir, 'server', 'index.js'));
fs.cpSync(path.join(ROOT, 'public'), path.join(stageDir, 'public'), { recursive: true });

// 启动入口
if (target === 'win-x64') {
  fs.writeFileSync(path.join(stageDir, '启动工作台.bat'), [
    '@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"',
    'start "" "runtime\\node.exe" server\\index.js', '',
  ].join('\r\n'));
} else {
  const script = target.startsWith('darwin')
    ? ['#!/bin/bash', 'cd "$(dirname "$0")"', 'exec "$(dirname "$0")/runtime/node" server/index.js', '']
    : ['#!/bin/sh', 'cd "$(dirname "$0")"', 'exec ./runtime/node server/index.js', ''];
  const entry = path.join(stageDir, spec.entry);
  fs.writeFileSync(entry, script.join('\n'));
  fs.chmodSync(entry, 0o755);
  fs.chmodSync(path.join(stageDir, 'runtime', spec.bin), 0o755);
}
const notes = ['1. 请解压到可写目录（如桌面、D 盘），不要放 C:\\Program Files —— 保存凭据需要写入软件目录。'];
if (target.startsWith('darwin')) {
  notes.push('2. macOS 首次运行如被系统拦截：右键 start.command →「打开」。');
}
fs.writeFileSync(path.join(stageDir, '使用说明.txt'), [
  'wx-md-publisher 便携版（已内置 Node.js 运行时，无需安装任何环境）', '',
  `启动：双击「${spec.entry}」，浏览器自动打开工作台；关闭命令行窗口即停止服务。`,
  '注意：', ...notes, '',
  '配置：顶栏「凭据」里添加公众号 AppID / AppSecret（仅保存在本机 server/config.json）。', '',
].join('\n'));

// ── 4. 隐私校验（绝不允许密钥进入产物）───────────────────
const assembled = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else assembled.push(path.relative(stageDir, p));
  }
})(stageDir);
if (assembled.some((f) => f === 'server' + path.sep + 'config.json' || f.includes('config.json'))) {
  throw new Error('隐私校验失败：产物中包含 config.json，中止打包');
}
console.log(`隐私校验通过（${assembled.length} 个文件，无 config.json）`);

// ── 5. 压缩 ───────────────────────────────────────────────
let archiveOut;
if (target === 'win-x64') {
  archiveOut = path.join(RELEASE, `${appName}.zip`);
  fs.rmSync(archiveOut, { force: true });
  createZip(stageDir, archiveOut, appName);
} else {
  archiveOut = path.join(RELEASE, `${appName}.tar.gz`);
  fs.rmSync(archiveOut, { force: true });
  run(TAR, ['-czf', `${appName}.tar.gz`, '-C', RELEASE, appName], { cwd: RELEASE });
}
console.log(`完成: ${archiveOut}（${(fs.statSync(archiveOut).size / 1024 / 1024).toFixed(1)} MB）`);

// ── 6. 产物自校验：归档结构可读、含启动入口、绝不含 config.json ──
let names;
let entriesByName = null;
if (target === 'win-x64') {
  const entries = listZipEntries(fs.readFileSync(archiveOut));
  names = entries.map((e) => e.name);
  entriesByName = entries;
} else {
  const list = spawnSync(TAR, ['-tf', archiveOut], { encoding: 'utf-8' });
  if (list.status !== 0) throw new Error(`产物自校验失败：归档无法列出（${list.stderr?.trim() || 'unknown'}）`);
  names = list.stdout.split('\n');
}
// Node 全程 UTF-8，中文启动入口可直接精确匹配，无需 ASCII 锚点
if (!names.some((n) => n.includes(spec.entry)) || !names.some((n) => n.includes('server/index.js'))) {
  throw new Error('产物自校验失败：归档中缺少启动入口或 server/index.js');
}
if (names.some((n) => n.includes('config.json'))) throw new Error('产物自校验失败：归档中包含 config.json，中止');
// zip 额外校验：非 ASCII 条目必须带 EFS 标志，否则旧系统按本地代码页解码中文名必乱码
const noEfs = entriesByName?.find((e) => /[^\x20-\x7e]/.test(e.name) && !(e.flags & 0x0800));
if (noEfs) throw new Error(`产物自校验失败：非 ASCII 条目未设置 UTF-8(EFS) 标志（${noEfs.name}）`);
console.log('归档自校验通过（结构可读、含启动入口、无 config.json、UTF-8 文件名）');
