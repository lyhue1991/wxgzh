# wxgzh 规格说明

## 项目概述

`wxgzh` 是一个基于 Node.js + TypeScript 的命令行工具，用于把 Markdown 文章处理成微信公众号草稿。

当前已实现能力：

- Markdown 解析与 front matter 元数据提取。
- 主题 CSS 内联，生成适合微信公众号编辑器的 HTML。
- 修复正文中的图片与不兼容结构，并可上传正文图片到微信。
- 基于内置背景图或自定义背景图生成封面。
- 上传封面并创建微信公众号草稿。
- 提供一键流程：`md2html -> fix -> cover -> publish`。

---

## 运行环境

- Node.js >= 18
- 包管理器：`npm`
- 编译命令：`npm run build`
- 类型检查：`npm run typecheck`

---

## 命令设计

### 1. 根命令

```bash
wxgzh [article.md] [options]
```

传入 Markdown 文件后，会自动执行完整流程：

1. 转换 Markdown 为 HTML
2. 修复 HTML 并上传正文图片
3. 生成或使用现成封面
4. 发布为微信公众号草稿

支持参数：

- `--theme <theme>`：覆盖主题名
- `--author <author>`：覆盖作者名
- `--cover <cover.jpg>`：指定现成封面图
- `--no-cover`：禁用自动生成封面
- `--digest <digest>`：覆盖摘要
- `--output-dir <dir>`：指定中间产物输出目录
- `--enable-comment`：为本次草稿开启评论

示例：

```bash
wxgzh article.md
wxgzh article.md --theme blue
wxgzh article.md --author "wxgzh" --digest "这是一篇摘要"
wxgzh article.md --cover ./cover.jpg
wxgzh article.md --no-cover
```

说明：

- 默认中间产物目录为文章同级的 `.wxgzh/`。
- 若未传 `--cover` 且未指定 `--no-cover`，会自动生成简易封面。
- 根命令会直接调用微信接口，因此要求已配置 `appid` 与 `appsecret`。

---

### 2. `config`

```bash
wxgzh config [options]
```

用于查看或更新用户级默认配置。

支持参数：

- `--appid <appid>`：设置微信公众号 appid
- `--appsecret <appsecret>`：设置微信公众号 appsecret
- `--author <author>`：设置默认作者名
- `--default-theme <theme>`：设置默认主题
- `--enable-comment`：默认开启评论
- `--disable-comment`：默认关闭评论
- `--list`：查看当前生效配置
- `--list-themes`：列出可用主题
- `--clear`：清空用户级配置文件

示例：

```bash
wxgzh config --list
wxgzh config --list-themes
wxgzh config --author "wxgzh" --default-theme blue
wxgzh config --enable-comment
```

说明：

- 用户级配置文件路径为 `~/.config/wxgzh/wxgzh.json`。
- 当前未实现项目级配置文件。
- 环境变量仅支持 `WX_APPID`、`WX_APPSECRET`。

---

### 3. `md2html`

```bash
wxgzh md2html --from <input.md> --to <output.html> [options]
```

把 Markdown 转换为带内联样式前原始结构的 HTML，并写入元数据。

支持参数：

- `--from <input.md>`：输入 Markdown 文件路径
- `--to <output.html>`：输出 HTML 文件路径
- `--theme <theme>`：覆盖主题名
- `--author <author>`：覆盖作者名

示例：

```bash
wxgzh md2html --from article.md --to .wxgzh/article.html
wxgzh md2html --from article.md --to .wxgzh/article.html --theme blue
```

说明：

- 支持 front matter：`title`、`author`、`digest`、`theme`、`cover`、`enableComment`。
- 若 front matter 中未设置 `title`，会尝试使用正文第一个一级标题。
- 若 front matter 中未设置 `digest`，会优先使用二级标题拼接生成摘要，兜底为标题或默认摘要。
- 会记录源 Markdown 所在目录，用于后续解析相对图片路径。

---

### 4. `fix`

```bash
wxgzh fix <article.html> [options]
```

修复 HTML 中的图片与不兼容结构，并按需上传正文图片。

支持参数：

- `--no-upload`：只修复 HTML，不上传图片
- `--cdn <url>`：把本地图片路径替换为指定 CDN 地址

示例：

```bash
wxgzh fix .wxgzh/article.html
wxgzh fix .wxgzh/article.html --no-upload
wxgzh fix .wxgzh/article.html --cdn https://cdn.example.com
```

当前行为：

- 移除 `<script>`、`<iframe>` 标签。
- 为图片补充适合微信正文的内联样式。
- 若开启上传，会把非微信 CDN 图片上传到微信素材接口。
- 若指定 `--cdn` 且未上传，则把本地图片替换为 CDN 地址。

---

### 5. `cover`

```bash
wxgzh cover [options]
```

生成公众号封面图。

支持参数：

- `--background <pic.jpg>`：指定自定义背景图
- `--title <title>`：封面标题
- `--author <author>`：作者名
- `--to <cover.jpg>`：输出文件路径
- `--list`：列出全部内置背景图名称

示例：

```bash
wxgzh cover --list
wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg
wxgzh cover --title "我的文章" --background ./bg.jpg --to .wxgzh/cover.jpg
```

说明：

- 未指定 `--background` 时，会自动随机选取 `assets/backgrounds/` 中的内置背景图。
- 若内置背景图目录为空，则退化为渐变底色封面。
- 当前封面生成基于 `sharp` + SVG 叠字实现，不依赖 `canvas` 或本地字体目录。

---

### 6. `publish`

```bash
wxgzh publish --article <article.html> --cover <cover.jpg> [options]
```

把 HTML 正文与封面图提交到微信公众号草稿箱。

支持参数：

- `--article <article.html>`：正文 HTML 路径
- `--cover <cover.jpg>`：封面图路径
- `--title <title>`：覆盖标题
- `--author <author>`：覆盖作者名
- `--digest <digest>`：覆盖摘要
- `--enable-comment`：开启评论

示例：

```bash
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg --title "新的标题"
```

说明：

- 会先上传封面图，再创建草稿。
- 标题、作者、摘要、评论开关都支持命令参数覆盖 HTML 元数据与默认配置。

---

### 7. `examples`

```bash
wxgzh examples
```

打印常用示例命令。

---

## Front Matter

当前支持的 front matter 字段：

```yaml
---
title: 我的文章标题
author: wxgzh
digest: 文章摘要
theme: default
cover: ./cover.jpg
enableComment: true
---
```

字段说明：

- `title`：文章标题
- `author`：作者名
- `digest`：摘要
- `theme`：主题名
- `cover`：封面图相对或绝对路径
- `enableComment`：是否开启评论

---

## 配置文件

用户级配置文件路径：

```text
~/.config/wxgzh/wxgzh.json
```

配置格式：

```json
{
  "appid": "wx1234567890abcdef",
  "appsecret": "1234567890abcdef1234567890abcdef",
  "author": "wxgzh",
  "defaultTheme": "default",
  "enableComment": true
}
```

环境变量：

- `WX_APPID`
- `WX_APPSECRET`

说明：

- `config --list` 输出的是当前生效配置。
- `appsecret` 在输出时会自动脱敏。
- 微信 access token 会额外缓存到 `~/.config/wxgzh/token.<appid>.json`。

---

## 技术栈

### 运行时依赖

| 包名 | 用途 |
|------|------|
| `axios` | 微信接口与远程资源请求 |
| `cheerio` | HTML 结构处理 |
| `commander` | CLI 框架 |
| `dotenv` | 环境变量加载 |
| `form-data` | 上传微信素材 |
| `gray-matter` | front matter 解析 |
| `highlight.js` | 代码高亮 |
| `juice` | CSS 内联 |
| `markdown-it` | Markdown 渲染 |
| `markdown-it-mathjax3` | 数学公式渲染 |
| `mathjax` | MathJax 支持 |
| `sharp` | 封面图生成 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| `typescript` | TypeScript 编译 |
| `@types/node` | Node.js 类型定义 |
| `@types/markdown-it` | MarkdownIt 类型定义 |

说明：

- 当前仓库未接入 Jest、Vitest 等测试框架。
- 当前仓库未配置 ESLint。

---

## 项目结构

```text
wxgzh/
├── AGENTS.md
├── assets/
│   └── backgrounds/              # 内置封面背景图
├── bin/
│   └── wxgzh.js                  # CLI 启动入口
├── dist/                         # 编译产物
├── src/
│   ├── cli/
│   │   ├── config.ts             # config 命令
│   │   ├── cover.ts              # cover 命令
│   │   ├── fix.ts                # fix 命令
│   │   ├── index.ts              # 根命令与子命令注册
│   │   ├── md2html.ts            # md2html 命令
│   │   └── publish.ts            # publish 命令
│   ├── core/
│   │   ├── converter.ts          # Markdown -> HTML 与样式内联
│   │   ├── cover.ts              # 封面图生成
│   │   ├── fixer.ts              # HTML 修复与图片处理
│   │   ├── parser.ts             # Markdown 与 front matter 解析
│   │   ├── themes.ts             # 主题发现与校验
│   │   └── wechat.ts             # 微信 API 封装
│   ├── types/
│   │   └── markdown-it-mathjax3.d.ts
│   ├── types.ts                  # 共享类型定义
│   └── utils/
│       ├── config.ts             # 用户配置管理
│       ├── fs.ts                 # 文件工具
│       ├── logger.ts             # 日志输出
│       └── tls.ts                # TLS 兼容处理
├── styles/
│   ├── default.css               # 默认主题
│   ├── custom.css                # 自定义覆盖样式
│   ├── blue.css                  # 其他主题
│   ├── black.css
│   ├── brown.css
│   ├── green.css
│   ├── orange.css
│   ├── red.css
│   └── yellow.css
├── package.json
├── package-lock.json
├── spec.md
├── test_article1.md
├── test_article2.md
└── tsconfig.json
```

---

## 微信接口

当前实际使用的微信接口如下。

### 1. 获取 Access Token

```http
GET https://api.weixin.qq.com/cgi-bin/token
```

查询参数：

- `grant_type=client_credential`
- `appid=<APPID>`
- `secret=<APPSECRET>`

### 2. 上传正文图片

```http
POST https://api.weixin.qq.com/cgi-bin/media/uploadimg
```

### 3. 上传封面图

```http
POST https://api.weixin.qq.com/cgi-bin/material/add_material
```

查询参数：

- `type=thumb`

### 4. 创建草稿

```http
POST https://api.weixin.qq.com/cgi-bin/draft/add
```

请求体核心字段：

```json
{
  "articles": [
    {
      "title": "标题",
      "author": "作者",
      "digest": "摘要",
      "content": "HTML 内容",
      "thumb_media_id": "封面 media_id",
      "need_open_comment": 1,
      "only_fans_can_comment": 0
    }
  ]
}
```

---

## 当前行为说明

### HTML 处理

- 使用 `markdown-it` 渲染 Markdown。
- 使用 `highlight.js` 处理代码块高亮。
- 使用 `markdown-it-mathjax3` + `mathjax` 处理数学公式。
- 使用 `juice` 把主题 CSS 与补充样式内联到最终 HTML。
- 会标准化图片、表格、引用块等结构，以适配微信公众号。

### 图片处理

- 支持本地图片与远程图片。
- 相对图片路径会基于源 Markdown 所在目录解析。
- 正文图片上传后会替换为微信返回的 CDN 地址。

### 封面生成

- 优先使用命令行传入的背景图。
- 未传背景图时，从 `assets/backgrounds/` 中随机选择。
- 若没有可用背景图，使用内置渐变背景兜底。

---

## 已知限制

- 当前没有项目级配置文件，仅支持用户级配置和部分环境变量。
- 当前未接入自动化测试框架。
- 当前未接入 ESLint。
- 当前未实现 Mermaid 专用渲染，Mermaid 代码块会按普通代码块处理。
- 微信平台对外链、HTML 标签和样式能力本身仍有限制，最终展示以平台实际效果为准。

---

## 常用验证命令

```bash
npm run typecheck
npm run build
node dist/cli/index.js --help
node dist/cli/index.js config --help
node dist/cli/index.js md2html --help
node dist/cli/index.js fix --help
node dist/cli/index.js cover --help
node dist/cli/index.js publish --help
```
