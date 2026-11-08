// 补拍：自定义主题面板 + 手机预览
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:3000/';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'raw');
const article = await fs.readFile(path.join(import.meta.dirname, 'sample-article.md'), 'utf8');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument((md) => {
  const now = Date.now();
  localStorage.setItem('wx-md-docs-v1', JSON.stringify([{ id: 'doc-1', content: md, updatedAt: now }]));
  localStorage.setItem('wx-md-current-doc', 'doc-1');
  localStorage.setItem('wx-md-active-theme-v1', 'wemd-modern-editorial');
  localStorage.setItem('wx-md-dark', '0');
}, article);
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1400));

// 自定义主题面板：选「＋ 自定义主题…」
await page.select('.theme-select', '__customize__');
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, '05-theme-panel.png') });
console.log('theme panel');

// 关掉面板，切到手机预览
await page.select('.theme-select', 'wemd-modern-editorial');
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button,label,span')].find((x) => x.textContent.trim() === '手机');
  b?.click();
});
await new Promise((r) => setTimeout(r, 1200));
const pv = await page.evaluate(() => {
  const b = document.querySelector('.preview-pane .pane-body')?.getBoundingClientRect();
  return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
});
await page.screenshot({ path: path.join(OUT, '09-preview-phone.png'), ...(pv ? { clip: pv } : {}) });
console.log('phone preview', JSON.stringify(pv));

await browser.close();
