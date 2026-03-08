---
name: wxgzh
description: 微信公众号文章发布工具。使用 wxgzh CLI 将 Markdown 文章发布到公众号草稿箱。触发场景：用户要发公众号文章、配置公众号 AppID/AppSecret、生成封面图、Markdown 转 HTML。
---

# wxgzh

封装 `@lyhue1991/wxgzh` 命令行工具，用于微信公众号文章发布。

## 核心能力

1. **一键发布文章** - Markdown → 公众号草稿箱
2. **配置管理** - AppID/AppSecret 配置
3. **封面生成** - 自动生成或自定义封面图
4. **格式转换** - Markdown → 公众号 HTML

## 工作流程

### 📝 发布文章到公众号

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

然后执行：
```bash
wxgzh config --appid 你的AppID --appsecret 你的AppSecret
```

> ⚠️ 提醒用户：需要把本机公网 IP 加入公众号后台的 IP 白名单
> 查看公网 IP：访问 https://ip.sb/

**Step 3: 发布文章**
```bash
wxgzh article.md --author "文章作者姓名"
```

支持参数：
- `--author <name>` - 作者名
- `--theme <theme>` - 主题样式（default/blue/green/red/yellow/brown/black/orange）
- `--cover <path>` - 指定封面图
- `--digest <text>` - 文章摘要
- `--enable-comment` - 开启评论

### ⚙️ 配置公众号

当用户只需配置 AppID/AppSecret 时：

```bash
wxgzh config --appid 你的AppID --appsecret 你的AppSecret
```

### 🖼️ 生成封面图

当用户需要生成封面时：

```bash
wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg
```

生成后立即预览结果（macOS）：

```bash
wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg && open .wxgzh/cover.jpg
```

查看内置背景：
```bash
wxgzh cover --list
```

### 📄 Markdown 转 HTML

当用户只需转换格式时：

```bash
wxgzh md2html --from article.md --to .wxgzh/article.html
```

## 注意事项

1. **IP 白名单** - 调用微信接口前，必须把本机公网 IP 加入公众号后台白名单
2. **配置文件位置** - `~/.config/wxgzh/wxgzh.json`
3. **中间产物** - 默认输出到文章同级目录的 `.wxgzh/` 文件夹

## 快速参考

```bash
# 查看帮助
wxgzh --help

# 查看配置
wxgzh config --list

# 查看主题
wxgzh config --list-themes

# 一键发布
wxgzh article.md --author 你的名字 --theme blue

# 分步执行
wxgzh md2html --from article.md --to .wxgzh/article.html
wxgzh fix .wxgzh/article.html
wxgzh cover --title "标题" --to .wxgzh/cover.jpg
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
```
