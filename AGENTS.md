# wx-md-publisher

本地公众号 Markdown 排版与发布工作台。双击 `scripts\start.bat` 启动（自动开浏览器，Ctrl+C 停止）。

## 常用命令

```bash
./node_modules/.bin/tsc --noEmit      # 类型检查
./node_modules/.bin/vitest run        # 测试
./node_modules/.bin/vite build        # 构建（输出到 public/，由 server 托管）
node server/index.js                  # 起本地服务（127.0.0.1:3000，被占自动 +1）
```

注意：`pnpm run build` 会触发 pnpm install 检查失败，直接用上面的一行命令。
`pnpm install` 需加 `--ignore-scripts`（esbuild 交互批准过不去）。

## 目录约定

- `server/index.js` — 静态托管 + 微信 API 代理，Node 原生 http，**零依赖**
- `server/config.json` — 公众号凭据（多账号），运行时生成，勿提交真实密钥
- `static/` — 原样拷贝到构建产物；`static/themes/` 为开源移植主题（WeMD/doocs，MIT）
- `themes-src/` — 开源主题源码（勿手改）；`node scripts/build-themes.mjs` 翻译生成 `static/themes/*.css`
- `public/` — vite 构建产物（outDir），会被 `emptyOutDir` 清空，勿手改
- `src/lib/` — 纯逻辑（themes 主题参数化 + cssThemes 注册表、themeCss 按需解析、docs 文档、snippets 片段、credentials 凭据 API）
- `src/components/` — UI 组件；`src/utils/markdown.ts` — marked 渲染与图片提取
- localStorage 键：`wx-md-docs-v1`、`wx-md-themes-v1`、`wx-md-snippets-v1`、`wx-md-dark`、`wx-md-active-theme-v1`

## 红线与约束

- 密钥只存 `server/config.json`（服务端），浏览器端 API 只返回掩码（后 4 位），禁止回显完整 AppSecret
- 所有写接口必须保留 Origin/Referer 校验（CSRF 防护），本地服务不代表没有跨站风险
- `server/config.json` 必须在 .gitignore 中，严禁入库
- 冒烟测试前必须 `netstat -ano | grep 300` 确认无残留旧代码进程：server 有端口自动 +1，新进程会静默落到 3001，测试打到旧进程会得出假结论；杀进程一律 netstat 取 PID + `taskkill //PID`，禁用 `taskkill //IM node.exe`
- 产品决策：发布永远新增草稿、不做 draft/update（微信接口报 data format error）；「已发布」徽标仅作记录
- 微信平台行为：先校验 IP 白名单（40164）再校验 appid，测试连接的 IP 提示依赖此顺序
- 预览 iframe 始终白色背景（模拟公众号阅读），深色模式只作用于写作区外壳
- 主题新增参数必须：进 `ThemeConfig` → `builtinThemes` 默认值 → `generateThemeCss` → `normalizeTheme` 兼容旧数据
- 微信 API 有 IP 白名单限制（errcode 40164 已做专门提示）
- 复制与发布草稿共用 `wechatifyArticle` 微信导出管线（`src/utils/inlineStyles.ts`）：CSS 内联 + 伪元素实体化 + CSS 变量解析 + 微信特有修复（top→translateY、img 尺寸属性、嵌套列表展平、首尾边界节点）。公众号会剥掉 `<style>` 标签，任何直接发送 class HTML 的路径都是 bug
- 代码块语法高亮走 highlight.js core + 12 种预注册语言（`src/utils/markdown.ts`），输出契约（hljs token class）与移植的 WeMD 代码主题对齐；>20k 字符的代码块自动跳过
- GFM 警示块（`> [!NOTE]`）在 blockquote 渲染层解析，输出 doocs/md 兼容的 `alert-title-*` 结构
- 便携包 win 的 zip 由 `scripts/package.mjs` 内置的 createZip 手写（UTF-8 名 + EFS 标志 + deflate）：Git Bash 的 `tar` 是 GNU tar 不认 zip；System32 bsdtar 按 ACP（GBK）存名且不加 EFS，非中文 Windows 必乱码；禁用 PowerShell Compress-Archive（同样 GBK）。包内必须自带 `runtime/node`，严禁含 `server/config.json`（目录级 + 归档级两道硬校验）
