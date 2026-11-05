/**
 * 双击启动入口：检测构建产物，按需构建，然后启动服务。
 * - 构建产物 public/ 存在 → 直接启动（Release 便携包走这条路，零依赖）
 * - 缺失但已安装依赖 → 用本地 vite 构建后再启动（源码用户）
 * - 缺失且无依赖 → 给出清晰指引
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SERVER = path.join(ROOT, 'server', 'index.js');

function startServer() {
  const server = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  server.on('close', (code) => {
    process.exit(code || 0);
  });
}

function buildThenStart() {
  console.log('');
  console.log('首次运行，正在构建前端页面...');
  console.log('');
  let viteBin;
  try {
    viteBin = createRequire(path.join(ROOT, 'package.json')).resolve('vite/bin/vite.js');
  } catch {
    console.error('未找到 vite。源码运行请先执行 npm install；');
    console.error('或下载 Release 中的便携包（已包含构建产物，无需安装）。');
    process.exit(1);
  }
  const build = spawn(process.execPath, [viteBin, 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  build.on('close', (code) => {
    if (code === 0) {
      startServer();
    } else {
      console.error('构建失败，请检查依赖是否已安装 (npm install)');
      process.exit(1);
    }
  });
}

if (!existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  buildThenStart();
} else {
  startServer();
}
