import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../utils/markdown';

describe('renderMarkdown 语法高亮', () => {
  it('已注册语言输出 hljs token class', () => {
    const { html } = renderMarkdown('```js\nconst a = "hi";\n```\n', '');
    expect(html).toContain('hljs language-js');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('hljs-string');
  });

  it('语言别名可解析（ts → typescript）', () => {
    const { html } = renderMarkdown('```ts\nlet n: number = 1;\n```\n', '');
    expect(html).toContain('hljs language-ts');
  });

  it('未注册语言回退纯文本，不报错', () => {
    const { html } = renderMarkdown('```rust\nfn main() {}\n```\n', '');
    expect(html).toContain('wx-code');
    expect(html).toContain('fn main() {}');
    expect(html).not.toContain('hljs-keyword');
  });

  it('代码中的 HTML 被转义（XSS 安全）', () => {
    const { html } = renderMarkdown('```js\nconst s = "<script>alert(1)</script>";\n```\n', '');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderMarkdown GFM 警示块', () => {  it('解析 [!NOTE] 并输出 alert-title 结构', () => {
    const { html } = renderMarkdown('> [!NOTE]\n> 有用提示\n', '');
    expect(html).toContain('alert alert-note');
    expect(html).toContain('alert-title-note');
    expect(html).toContain('有用提示');
    expect(html).not.toContain('[!NOTE]');
  });

  it('支持全部 doocs 类型之一（如 warning）', () => {
    const { html } = renderMarkdown('> [!WARNING]\n> 小心操作\n', '');
    expect(html).toContain('alert-title-warning');
  });

  it('普通引用不受影响', () => {
    const { html } = renderMarkdown('> 普通引用文字\n', '');
    expect(html).toContain('wx-quote');
    expect(html).not.toContain('alert-title');
  });
});

describe('renderMarkdown 反斜杠转义', () => {
  it('\\- \\+ \\[ \\] 等按字面输出', () => {
    const { html } = renderMarkdown('编号 2026\\-01，字段 \\[内容ID\\]，格式 a\\+b\n', '');
    expect(html).toContain('2026-01');
    expect(html).toContain('[内容ID]');
    expect(html).toContain('a+b');
    expect(html).not.toContain('\\-');
    expect(html).not.toContain('\\+');
    expect(html).not.toContain('\\[');
  });

  it('代码块内的转义不受影响', () => {
    const { html } = renderMarkdown('```\na\\-b\n```\n', '');
    expect(html).toContain('a\\-b');
  });
});

describe('renderMarkdown 链接安全', () => {
  it('拦截 javascript: 伪协议链接', () => {
    const { html } = renderMarkdown('[点击](javascript:alert(1))\n', '');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('拦截控制字符混淆的伪协议', () => {
    const { html } = renderMarkdown('[点击](java\tscript:alert(1))\n', '');
    expect(html).not.toContain('script:');
    expect(html).toContain('href="#"');
  });

  it('正常 http/https 链接不受影响', () => {
    const { html } = renderMarkdown('[官网](https://example.com)\n', '');
    expect(html).toContain('href="https://example.com"');
  });
});
