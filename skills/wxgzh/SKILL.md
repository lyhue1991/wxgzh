---
name: wxgzh
description: 微信公众号文章发布工具。使用 wxgzh CLI 将 Markdown 文章发布到公众号草稿箱。触发场景：用户要发公众号文章、配置公众号 AppID/AppSecret、生成封面图、Markdown 转 HTML、多账号管理。
---

# wxgzh

封装 `@lyhue1991/wxgzh` 命令行工具，用于微信公众号文章发布。

## 核心能力

1. **一键发布文章** - Markdown → 公众号草稿箱
2. **配置管理** - AppID/AppSecret 多账号配置
3. **封面生成** - 自动生成或自定义封面图
4. **格式转换** - Markdown → 公众号 HTML
5. **多账号支持** - 管理多个公众号账号

## 工作流程

### 发布文章到公众号

当用户表达发布文章意图时，按以下流程执行：

```
1. 检查安装 → 2. 检查配置 → 3. 发布文章
```

**Step 1: 检查是否安装 wxgzh**
```bash
command -v wxgzh
```
如果未安装，执行：
```bash
npm install -g @lyhue1991/wxgzh
```

**Step 2: 检查配置**
```bash
wxgzh config --list
```
如果未配置，询问用户提供：
- `AppID`（公众号开发接口管理中的 AppID）
- `AppSecret`（公众号开发接口管理中的 AppSecret）

然后执行（**必须同时指定公众号账号名**）：
```bash
wxgzh config --account 公众号名称1 --appid 你的AppID --appsecret 你的AppSecret
```

> ⚠️ 提醒用户：需要把本机公网 IP 加入公众号后台的 IP 白名单
> 查看公网 IP：访问 https://ip.sb/

**Step 3: 发布文章**
```bash
wxgzh article.md --author "文章作者姓名"
```

### 多账号管理

支持管理多个公众号账号：

```bash
# 添加第二个账号
wxgzh config --account 公众号名称2 --appid 另一个AppID --appsecret 另一个AppSecret

# 设置默认账号
wxgzh config --set-default-account 公众号名称1

# 列出全部账号
wxgzh config --list-accounts

# 发布时指定账号
wxgzh article.md --account 公众号名称2
```

## 常用命令

### 一键发布（完整流程）
```bash
wxgzh article.md --author 你的名字 --theme blue
```

### 分步执行
```bash
# 第1步：Markdown 转 HTML
wxgzh md2html --from article.md --to .wxgzh/article.html

# 第2步：修复 HTML 并上传图片
wxgzh fix .wxgzh/article.html

# 第3步：生成封面图
wxgzh cover --title "标题" --to .wxgzh/cover.jpg

# 第4步：发布草稿
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
```

### 仅转换格式（不上传图片）
```bash
wxgzh md2html --from article.md --to .wxgzh/article.html
wxgzh fix .wxgzh/article.html --no-upload
```

## 完整参数说明

### 全局参数
- `--author <name>` - 作者名
- `--theme <theme>` - 主题样式（default/blue/green/red/yellow/brown/black/orange）
- `--account <name>` - 指定公众号账号
- `--output-dir <dir>` - 中间产物输出目录

### publish 命令
- `--article <file>` - HTML 正文路径（必填）
- `--cover <file>` - 封面图路径（必填）
- `--title <title>` - 覆盖标题
- `--digest <text>` - 文章摘要
- `--enable-comment` - 开启评论

### cover 命令
- `--title <title>` - 封面标题
- `--author <name>` - 作者名
- `--background <file>` - 自定义背景图
- `--list` - 列出内置背景

### fix 命令
- `--account <name>` - 指定上传图片的账号
- `--no-upload` - 只修复结构，不上传图片
- `--cdn <url>` - 用 CDN 地址替换本地图片

## 注意事项

1. **IP 白名单** - 调用微信接口前，必须把本机公网 IP 加入公众号后台白名单
2. **配置文件位置** - `~/.config/wxgzh/wxgzh.json`
3. **中间产物** - 默认输出到文章同级目录的 `.wxgzh/` 文件夹
4. **多账号优先级** - 命令行 `--account` > front matter `account` > 环境变量 > 默认账号

## 快速参考

```bash
# 查看帮助
wxgzh --help

# 配置管理
wxgzh config --list
wxgzh config --list-accounts
wxgzh config --list-themes
wxgzh config --account 公众号名称1 --appid xxx --appsecret xxx
wxgzh config --set-default-account 公众号名称1

# 一键发布
wxgzh article.md --author 你的名字 --theme blue --account 公众号名称1

# 分步执行
wxgzh md2html --from article.md --to .wxgzh/article.html
wxgzh fix .wxgzh/article.html --no-upload
wxgzh cover --title "标题" --to .wxgzh/cover.jpg
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
```
