// 小红书图文素材 v2：一次跑完，输出 2x 原图 + 可直接发的小红书尺寸。
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:3000/';
const ROOT = path.resolve(import.meta.dirname, '..', '..'); // 仓库根
const OUT = path.join(ROOT, 'docs', 'screenshots');
const article = await fs.readFile(path.join(import.meta.dirname, 'sample-article.md'), 'utf8');

await fs.mkdir(path.join(OUT, 'raw'), { recursive: true });

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
  localStorage.setItem('wx-md-active-theme-v1', 'default');
  localStorage.setItem('wx-md-dark', '0');
}, article);

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 1500));

const shot = async (name, clip) => {
  await page.screenshot({ path: path.join(OUT, 'raw', `${name}.png`), ...(clip ? { clip } : {}) });
  console.log('  ', name);
};

const boxes = async () => {
  return await page.evaluate(() => {
    const g = (sel) => {
      const b = document.querySelector(sel)?.getBoundingClientRect();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    return { editor: g('.editor-pane'), preview: g('.preview-pane .pane-body'), app: null };
  });
};

await shot('01-workspace-default');
const b1 = await boxes();
if (b1.editor) await shot('02-editor', b1.editor);

// 三个有辨识度的主题，只拍预览区（4:5 左右，小红书可直接发）
const THEMES = [
  ['wemd-modern-editorial', 'editorial'],
  ['wemd-eastern-notes', 'eastern'],
  ['wemd-luxury-gold', 'gold'],
  ['wemd-bauhaus', 'bauhaus'],
];
for (const [id, tag] of THEMES) {
  await page.select('.theme-select', id);
  await new Promise((r) => setTimeout(r, 1400));
  const b = await boxes();
  if (b.preview) await shot(`03-preview-${tag}`, b.preview);
}

// 自定义主题面板
await page.select('.theme-select', 'wemd-modern-editorial');
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('编辑主题'))?.click();
});
await new Promise((r) => setTimeout(r, 1000));
await shot('05-theme-panel');
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('编辑主题'))?.click();
});
await new Promise((r) => setTimeout(r, 600));

// 发布面板
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '发布')?.click();
});
await new Promise((r) => setTimeout(r, 1200));
await shot('07-publish');

// 片段面板
await page.keyboard.press('Escape');
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('片段'))?.click();
});
await new Promise((r) => setTimeout(r, 900));
await shot('08-snippets');

await browser.close();
console.log('done ->', OUT);
