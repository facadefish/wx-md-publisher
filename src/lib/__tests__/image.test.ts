import { describe, it, expect } from 'vitest';
import { renderMarkdown, extractImages } from '../../utils/markdown';

describe('renderMarkdown 图片渲染', () => {
  it('独立图片行渲染为 <img>（而非「感叹号 + 链接」）', () => {
    const { html } = renderMarkdown('![配图](https://example.com/a.png)\n', '');
    expect(html).toContain('<img class="wx-image"');
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('alt="配图"');
    expect(html).not.toContain('!<a ');
  });

  it('图片夹在文字中也能渲染', () => {
    const { html } = renderMarkdown('看这张 ![配图](https://example.com/a.png) 很好\n', '');
    expect(html).toContain('<img class="wx-image"');
    expect(html).toContain('看这张 ');
    expect(html).toContain(' 很好');
  });

  it('粘贴的 dataURL 图片可以渲染（不被 safeHref 拦掉）', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const { html } = renderMarkdown(`![图片](${dataUrl})\n`, '');
    expect(html).toContain('<img class="wx-image"');
    expect(html).toContain(`src="${dataUrl}"`);
  });

  it('带 title 的图片渲染出 title 属性，且 URL 不含 title 文本', () => {
    const { html } = renderMarkdown('![配图](https://example.com/a.png "图注")\n', '');
    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('title="图注"');
    expect(html).not.toContain('a.png &quot;图注&quot;');
  });

  it('普通链接不受影响', () => {
    const { html } = renderMarkdown('[文档](https://example.com/d)\n', '');
    expect(html).toContain('<a href="https://example.com/d">文档</a>');
    expect(html).not.toContain('<img');
  });

  it('同一段内的图片与链接各自正确渲染', () => {
    const { html } = renderMarkdown('![图](https://example.com/a.png) 和 [链接](https://example.com/d)\n', '');
    expect(html).toContain('<img class="wx-image"');
    expect(html).toContain('<a href="https://example.com/d">链接</a>');
  });

  it('拦截 javascript: 伪协议图片', () => {
    const { html } = renderMarkdown('![x](javascript:alert(1))\n', '');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
  });

  it('拦截非图片的 data URL（如 data:text/html）', () => {
    const { html } = renderMarkdown('![x](data:text/html;base64,PHNjcmlwdD4=)\n', '');
    expect(html).not.toContain('<img');
  });

  it('控制字符混淆的伪协议同样被拦截', () => {
    const { html } = renderMarkdown('![x](java\tscript:alert(1))\n', '');
    expect(html).not.toContain('<img src="java');
  });

  it('extractImages 能提取到渲染后的图片（发布上传图床依赖它）', () => {
    const { html } = renderMarkdown('![配图](https://example.com/a.png)\n', '');
    const imgs = extractImages(html);
    expect(imgs).toEqual(['https://example.com/a.png']);
  });

  it('extractImages 能提取粘贴的 dataURL 图片', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const { html } = renderMarkdown(`![图片](${dataUrl})\n`, '');
    expect(extractImages(html)).toEqual([dataUrl]);
  });
});
