/**
 * 解析 vite 可执行入口。
 *
 * 不能直接用 createRequire().resolve('vite/bin/vite.js')：
 * 新版 vite 的 package.json 含 `exports` 字段且未导出 `./bin/*`，
 * 该写法会抛 ERR_PACKAGE_PATH_NOT_EXPORTED，导致「缺构建产物则自动构建」
 * 这条路径必然失败。
 *
 * 正确做法是解析 `vite/package.json`（它在 exports 中显式导出），
 * 再依据其 `bin.vite` 字段拼出真实入口路径。
 */
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * @param {string} root 项目根目录（含 package.json）
 * @returns {{ binPath: string } | { error: Error }}
 */
export function resolveViteBin(root) {
  const req = createRequire(path.join(root, 'package.json'));
  try {
    const pkgPath = req.resolve('vite/package.json');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = req('vite/package.json');
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.vite;
    if (!binRel) {
      return { error: new Error('vite 的 package.json 中未声明 bin.vite 入口') };
    }
    return { binPath: path.join(path.dirname(pkgPath), binRel) };
  } catch (err) {
    return { error: err };
  }
}
