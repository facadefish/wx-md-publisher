import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../utils/markdown';

describe('renderMarkdown GFM 删除线', () => {
  it('~~文字~~ 渲染为 <del>', () => {
    const { html } = renderMarkdown('这里有 ~~删除线~~ 文字\n', '');
    expect(html).toContain('<del>删除线</del>');
    expect(html).not.toContain('~~');
  });

  it('与工具栏「删除线」按钮插入的内容一致（该按钮此前点了没有效果）', () => {
    // Toolbar.tsx:84 插入的是 ~~...~~
    const { html } = renderMarkdown('~~删除线文字~~\n', '');
    expect(html).toContain('<del>删除线文字</del>');
  });

  it('与加粗/斜体可混排', () => {
    const { html } = renderMarkdown('**粗** 与 ~~删~~ 与 *斜*\n', '');
    expect(html).toContain('<strong>粗</strong>');
    expect(html).toContain('<del>删</del>');
    expect(html).toContain('<em>斜</em>');
  });

  it('单个波浪线不误伤（如 ~5 分钟）', () => {
    const { html } = renderMarkdown('约 ~5 分钟，范围 1~2\n', '');
    expect(html).not.toContain('<del>');
    expect(html).toContain('~5 分钟');
  });

  it('代码块内的 ~~ 不受影响', () => {
    const { html } = renderMarkdown('```\na ~~ b\n```\n', '');
    expect(html).not.toContain('<del>');
    expect(html).toContain('a ~~ b');
  });

  it('行内代码里的 ~~ 目前仍会被转换（既有问题，见 #17）', () => {
    // 行内代码应输出字面量，但 inlineMarkdown 的链式 replace 会在已生成的
    // <code> 内部继续匹配。这是所有行内规则的共性问题（加粗/斜体/链接同样），
    // 已在 #17 单独跟踪；此处锁定现状，避免修复 #17 时无声改变行为。
    const { html } = renderMarkdown('用 `~~x~~` 表示\n', '');
    expect(html).toContain('<code><del>x</del></code>');
  });
});
