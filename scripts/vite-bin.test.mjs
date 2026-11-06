/**
 * 回归测试：vite 可执行入口解析。
 *
 * 背景：脚本曾用 createRequire().resolve('vite/bin/vite.js')，而新版 vite 的
 * package.json 含 exports 字段且未导出 ./bin/*，该写法必然抛
 * ERR_PACKAGE_PATH_NOT_EXPORTED，导致「缺构建产物则自动构建」这条路径失效
 * （本地因 public/ 已存在而察觉不到，新克隆才会爆发）。
 *
 * 放在 scripts/ 下（而非 src/lib/__tests__/）：该测试需要 node: 内置模块，
 * 而项目未安装 @types/node，tsconfig 的 include 只覆盖 src。
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveViteBin } from './vite-bin.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

describe('resolveViteBin', () => {
  it('能解析出真实存在的 vite 入口', () => {
    const { binPath, error } = resolveViteBin(ROOT);
    expect(error).toBeUndefined();
    expect(binPath).toBeTypeOf('string');
    expect(existsSync(binPath)).toBe(true);
    expect(path.basename(binPath)).toBe('vite.js');
  });

  it('解析结果来自 node_modules 内的真实安装位置', () => {
    const { binPath } = resolveViteBin(ROOT);
    const parts = binPath.split(path.sep);
    expect(parts).toContain('node_modules');
  });

  it('回归：被 exports 封禁的 vite/bin/vite.js 写法确实会失败（本修复的动因）', () => {
    const req = createRequire(path.join(ROOT, 'package.json'));
    expect(() => req.resolve('vite/bin/vite.js')).toThrow();
    // 而 package.json 路径是被允许解析的——新实现正是走这条路
    expect(() => req.resolve('vite/package.json')).not.toThrow();
  });
});
