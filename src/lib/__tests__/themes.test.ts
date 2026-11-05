import { describe, it, expect } from 'vitest';
import { generateThemeCss, builtinThemes } from '../themes';
import { renderMarkdown } from '../../utils/markdown';

describe('generateThemeCss', () => {
  it('generates css containing all key selectors', () => {
    const css = generateThemeCss(builtinThemes[0]);
    expect(css).toContain('.wx-article');
    expect(css).toContain('.wx-title');
    expect(css).toContain('.wx-code');
    expect(css).toContain('.wx-quote');
  });

  it('respects paragraph spacing and code dark mode', () => {
    const t = { ...builtinThemes[0], paraSpacing: 30, codeStyle: 'dark' as const };
    const css = generateThemeCss(t);
    expect(css).toContain('margin: 30px 0');
    expect(css).toContain('#24292e');
  });

  it('applies letter spacing and text indent', () => {
    const t = { ...builtinThemes[0], letterSpacing: 2, textIndent: 32 };
    const css = generateThemeCss(t);
    expect(css).toContain('letter-spacing: 2px');
    expect(css).toContain('text-indent: 32px');
  });
});

describe('renderMarkdown', () => {
  it('renders full article with inline styles', () => {
    const { html, title } = renderMarkdown('# 你好\n\n**加粗** 和 *斜体*\n\n```\ncode\n```\n', '');
    expect(title).toBe('你好');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('wx-code');
  });
});
