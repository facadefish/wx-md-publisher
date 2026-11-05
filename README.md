# wx-md-publisher · 公众号 Markdown 排版工作台

本地优先的 Markdown → 公众号排版与发布工具。左边写 Markdown，右边实时预览公众号排版，一键复制到公众号后台或发布到草稿箱。**所有数据只存在你的电脑上**，无需登录、没有云端。

[English README](README.en.md)

## 为什么选择它

- **粘贴即所得**：复制内容经过微信适配管线（CSS 内联 + 伪元素转换 + 微信兼容修复），粘贴到公众号后台与预览**逐像素一致**
- **22 套主题**：WeMD / doocs/md 开源主题全量移植 + 参数化自定义主题，代码块语法高亮、GFM 警示块
- **零部署门槛**：Windows 用户下载便携包解压双击即用，**不需要安装 Node**
- **密钥不出本机**：AppSecret 只存在本机文件，界面永不显示完整值

## 快速开始

### 方式一：下载便携包（推荐，无需安装环境）

| 平台 | 包 | 用法 |
|---|---|---|
| Windows | `wx-md-publisher-*-win-x64.zip` | 解压，双击 **启动工作台.bat** |
| macOS（Apple 芯片） | `*-darwin-arm64.tar.gz` | 解压，双击 **start.command** |
| Linux | `*-linux-x64.tar.gz` | 解压，运行 `./start.sh` |

> Intel Mac 不提供预构建包（GitHub 已淘汰 Intel macOS 运行器），可在任意机器上 `node scripts/package.mjs darwin-x64` 自行打包。

在 [Releases](../../releases) 下载对应平台的包。启动后浏览器自动打开工作台，关闭命令行窗口即停止服务。便携包**内置 Node.js 运行时**，除浏览器外无任何外部依赖。

> **注意**：请解压到可写目录（桌面、D 盘等）。不要放在 `C:\Program Files` 这类需要管理员权限的位置——保存凭据需要写入软件目录。

> **macOS 提示**：首次运行如被 Gatekeeper 拦截，右键 start.command →「打开」；或执行 `xattr -dr com.apple.quarantine 解压后的目录`。

### 方式二：源码运行（适合开发者）

需要 Node.js ≥ 18（推荐 22 LTS）：

```bash
git clone <repo-url> && cd wx-md-publisher
npm install        # 或 pnpm install --ignore-scripts
npm start          # 首次自动构建，之后直接启动
```

打开 http://localhost:3000 （端口被占用时自动 +1）。

## 使用指南

### 1. 配置公众号凭据（仅发布需要，复制排版不需要）

1. 顶栏「🔑 凭据」→「新增账号」，填公众号 **AppID** 和 **AppSecret**
2. 密钥保存在本机 `server/config.json`，可多账号切换，界面只显示后 4 位

> AppID / AppSecret 在 [公众号后台 → 设置与开发 → 基本配置 → 开发者密码] 获取。

### 2. 加 IP 白名单（仅发布需要）

公众号后台「基本配置 → IP 白名单」加入本机公网 IP。家用宽带 IP 会变，重连后：
在「发布 → 测试连接」里点一下，若报白名单错误，窗口会**自动显示当前公网 IP**，点「复制」粘贴到公众号后台即可。

### 3. 写作与排版

- 左侧写 Markdown，右侧实时预览；截图直接 **Ctrl+V** 粘贴图片
- 顶栏切换 **22 套主题**；「🎨 主题」开缩略图画廊；「✎ 编辑主题」可调字距/行距/配色并保存为自己的主题
- 底部状态栏显示字数与预计阅读时长；🌙 切换深色写作模式

### 4. 导出或发布

- **复制 HTML**：粘贴进公众号编辑器，样式与预览一致
- **发布草稿**：填标题/作者/摘要 + 选封面 → 发布后到公众号后台「草稿箱」查看；正文图片自动转存微信图床

## 常见问题

**Q：粘贴到公众号后样式丢失？**
A：请用顶栏「复制 HTML」按钮（剪贴板图标旁的按钮），不要直接复制预览区文字。该按钮会把样式内联进 HTML。

**Q：测试连接报 40164？**
A：本机公网 IP 未加入白名单。错误提示下方会自动显示当前 IP，复制后到公众号后台添加。

**Q：发布报封面相关错误？**
A：微信封面素材有大小限制，请换更小的 JPG（建议 < 1MB）。

**Q：如何备份文章？**
A：文章存在浏览器 localStorage，可用顶栏「导入」反向操作：文章列表在浏览器开发者工具 Application → Local Storage 中导出，或直接把内容复制为 .md 文件。

**Q：保存凭据提示「目录不可写」？**
A：软件目录没有写入权限。把文件夹移到桌面等普通目录后重启即可；便携版不支持放在 C:\Program Files 运行。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口，占用时自动 +1 |
| `WXMD_NO_OPEN` | — | 设为 `1` 不自动打开浏览器（测试/服务化） |
| `WXMD_CONFIG_PATH` | `server/config.json` | 凭据文件路径 |

## 跨平台支持

| | Windows | macOS | Linux |
|---|---|---|---|
| 便携包 | ✅ x64 | ✅ arm64 | ✅ x64 |
| 源码运行 | ✅ | ✅ | ✅ |
| CI 测试 | ✅ | ✅ | ✅ |

## 开发

```bash
npm install                  # 或 pnpm install --ignore-scripts
npm run build                # 类型检查 + 构建到 public/
npm test                     # 单元测试（vitest）
npm run smoke                # 服务端到端冒烟（独立端口与临时配置，安全）
node scripts/build-themes.mjs   # 从 themes-src/ 重新生成主题 CSS
node scripts/package.mjs win-x64  # 打包便携包（当前平台默认）
```

## 安全设计

- 仅监听 `127.0.0.1`；写接口校验 Origin/Referer，阻断跨站请求
- AppSecret 仅存本机且 API 只返回掩码；`server/config.json` 在 .gitignore 中
- Markdown 渲染拦截 `javascript:` 等危险链接协议；代码高亮输出全转义
- 无任何遥测与云端回传

## 致谢

- [WeMD](https://github.com/tenngoxars/WeMD)（MIT）— 17 套主题样式来源
- [doocs/md](https://github.com/doocs/md)（MIT）— 3 套主题与微信导出管线的实现参考
- [highlight.js](https://github.com/highlightjs/highlight.js)（BSD-3-Clause）— 代码语法高亮

## License

[MIT](LICENSE)
