import { builtinThemes, generateThemeCss, loadCustomThemes } from './themes';

const cache = new Map<string, Promise<string>>();

/**
 * 解析主题 CSS：
 * - 参数主题（内置 + 自定义）本地同步生成
 * - 完整 CSS 主题（开源移植，见 cssThemes）首次使用时按需 fetch 并缓存
 */
export function resolveThemeCss(id: string): Promise<string> {
  const param = loadCustomThemes().find((t) => t.id === id)
    ?? builtinThemes.find((t) => t.id === id);
  if (param) return Promise.resolve(generateThemeCss(param));
  if (!cache.has(id)) {
    cache.set(id, fetch(`/themes/${encodeURIComponent(id)}.css`).then((r) => {
      if (!r.ok) throw new Error(`主题样式加载失败: ${id}`);
      return r.text();
    }));
  }
  return cache.get(id)!;
}
