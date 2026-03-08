# wxgzh

一个面向微信公众号的 SKILL，基于 NodeJS CLI.

把 Markdown 文章处理成适合公众号发布的 HTML，上传图片，生成封面，并提交到公众号草稿箱。

<mark>安装此SKILL</mark>

```
npx skills add lyhue1991/wxgzh
```


## 一、功能概述

`wxgzh` 的目标很直接：

- 一条命令把 Markdown 文档发送到微信公众号文章草稿箱。
- 支持常见 Markdown 内容，包括图片、代码块、表格、引用、数学公式等。
- 自动完成从 Markdown -> HTML -> 图片修复上传 -> 封面生成 -> 草稿创建 的整套流程。
- 支持主题样式、自定义 CSS、自动摘要、封面图生成。
- 也支持分步执行，便于你单独检查 HTML、封面或发布结果。

**手动操作方法**

* step1: 一键安装（要求：Node.js >= 18）

```bash
npm install -g @lyhue1991/wxgzh
```
安装完成后可直接使用 `wxgzh` 命令。


* step2: 一键配置 (提前准备好微信公众号AppID和 AppSecret ， 并配置好IP白名单)

```bash
wxgzh config --appid 你的AppID --appsecret 你的AppSecret 

```

* step3: 一键投稿 (将本地markdown文章直接投递到公众号草稿箱， 人工确认后即可发布)

```bash
wxgzh article.md --author 文章作者姓名
```

这条命令会自动执行：

1. 读取 `article.md`
2. 转换成公众号可用 HTML
3. 上传正文中的本地图片和非微信图床图片到微信公众号图床
4. 自动生成封面图（如果你没有提供）
5. 提交到微信公众号草稿箱



## 二、配置说明

### 1. 如何获取公众号 `appid` 和 `appsecret`

前往微信公众号公众平台，使用已认证的公众号管理员账号登录：

1. 打开公众号后台
2. 进入“设置与开发”
3. 找到“开发接口管理”
4. 查看并复制 `AppID` 和 `AppSecret`

拿到后，执行：

```bash
wxgzh config --appid 你的AppID --appsecret 你的AppSecret
```

也可以同时设置默认作者、默认主题：

```bash
wxgzh config --appid 你的AppID --appsecret 你的AppSecret --author "wxgzh" --default-theme blue
```


### 2. 如何把本机IP加入公众号 IP 白名单

> [!IMPORTANT]
> 调用微信公众号接口前，除了配置 `appid` 和 `appsecret`，还要把当前机器的公网 IP 加到公众号后台的 IP 白名单。
> 否则即使密钥正确，也可能在获取 token、上传图片、创建草稿时被微信拒绝。

操作步骤：

1. 登录微信公众号后台
2. 进入“设置与开发” -> “开发接口管理” -> “基本配置”
3. 找到 IP 白名单
4. 把当前机器的公网 IP 添加进去并保存

查看本机公网 IP 的方法：浏览器访问 https://ip.sb/ 查看 Address


### 3. 如何查看当前配置

```bash
wxgzh config --list
```

会输出当前生效配置，并显示用户配置文件位置。

默认用户配置文件路径：

```text
~/.config/wxgzh/wxgzh.json
```

你也可以查看全部可用主题：

```bash
wxgzh config --list-themes
```

当前内置主题来自 `styles/` 目录，例如：`default`、`blue`、`green`、`red`、`yellow`、`brown`、`black`、`orange`。


## 三、快速流程

最常见用法：

```bash
wxgzh article.md
```

适合“写完 Markdown 后直接进草稿箱”的场景。

### 常见范例

指定主题：

```bash
wxgzh article.md --theme blue
```

指定作者与摘要：

```bash
wxgzh article.md --author "wxgzh" --digest "这是一篇摘要"
```

指定现成封面图：

```bash
wxgzh article.md --cover ./cover.jpg
```

指定中间产物输出目录：

```bash
wxgzh article.md --output-dir ./.wxgzh
```

开启评论：

```bash
wxgzh article.md --enable-comment
```

### 常见参数说明

- `--theme <theme>`：指定文章主题。
- `--author <author>`：覆盖作者名。
- `--cover <cover.jpg>`：使用你已有的封面图，不再自动生成。
- `--no-cover`：关闭自动封面生成；如果同时也没有提供封面，会报错。
- `--digest <digest>`：覆盖文章摘要。
- `--output-dir <dir>`：指定中间文件输出目录，默认是文章同级目录下的 `.wxgzh/`。
- `--enable-comment`：为本次草稿开启评论。

### 输出结果

默认流程执行后，通常会在同级 `.wxgzh/` 目录中看到：

- `article.html`：转换后的 HTML
- `article.cover.jpg`：自动生成的封面图

最后命令会输出草稿创建结果 JSON。

## 四、分步流程

如果你想更可控地处理文章，可以分步骤执行。

### 第 1 步：将 Markdown 转成 HTML

```bash
wxgzh md2html --from article.md --to .wxgzh/article.html
```

指定主题：

```bash
wxgzh md2html --from article.md --to .wxgzh/article.html --theme blue
```

这个步骤会：

- 解析 Markdown
- 提取标题、作者、摘要等元信息
- 渲染代码高亮
- 渲染数学公式
- 内联主题 CSS，生成适合公众号场景的 HTML

### 第 2 步：修复 HTML，并上传正文图片

```bash
wxgzh fix .wxgzh/article.html
```

这个步骤会：

- 移除不适合公众号的结构（如 `script`、`iframe`）
- 处理图片样式
- 将本地图片上传到微信，替换为微信返回的图片地址

如果你只想修结构，不上传图片：

```bash
wxgzh fix .wxgzh/article.html --no-upload
```

如果你希望把本地图片路径替换成 CDN：

```bash
wxgzh fix .wxgzh/article.html --cdn https://cdn.example.com
```

### 第 3 步：制作封面图

自动随机使用内置背景：

```bash
wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg
```

指定作者名：

```bash
wxgzh cover --title "我的文章" --author "wxgzh" --to .wxgzh/cover.jpg
```

指定自定义背景图：

```bash
wxgzh cover --title "我的文章" --background ./bg.jpg --to .wxgzh/cover.jpg
```

查看内置背景名称：

```bash
wxgzh cover --list
```

内置背景图片位于 `assets/backgrounds/`。

### 第 4 步：发布到公众号草稿箱

```bash
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
```

也可以覆盖标题、作者、摘要：

```bash
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg --title "新的标题" --author "wxgzh" --digest "新的摘要"
```

开启评论：

```bash
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg --enable-comment
```

### 一键流程与分步流程如何选择

- 想快速发布：直接用 `wxgzh article.md`
- 想检查 HTML 效果：先用 `md2html`
- 想自行处理图片：再单独执行 `fix`
- 想手动挑选封面：单独执行 `cover`
- 想复用现有 HTML 和封面：最后执行 `publish`

## 五、样式控制

### 1. 修改文章主题

项目的主题 CSS 位于 `styles/` 目录，每个主题一个 CSS 文件，例如：

- `styles/default.css`
- `styles/blue.css`
- `styles/green.css`
- `styles/red.css`

使用方法：

```bash
wxgzh article.md --theme blue
```

或者设置为默认主题：

```bash
wxgzh config --default-theme blue
```

### 2. 修改 CSS 样式

如果你想在现有主题基础上做少量覆盖，直接编辑：

```text
styles/custom.css
```

这个文件会在主题 CSS 之后加载，适合做局部覆盖。

例如：

```css
h3 {
  text-align: center !important;
}

blockquote {
  color: #666666 !important;
}
```

如果你想做完整主题，也可以直接修改或新增 `styles/*.css` 文件。

### 3. 修改封面背景

封面支持两种背景来源：

- 使用内置背景图
- 使用你自己的背景图

使用你自己的背景图：

```bash
wxgzh cover --title "文章标题" --background ./my-bg.jpg --to .wxgzh/cover.jpg
```

如果走一键发布流程，但你不想用自动封面，可以直接指定已有封面：

```bash
wxgzh article.md --cover ./cover.jpg
```

### 4. 自定义封面

如果你已经在设计工具里做好了封面，最简单的方式就是直接传入：

```bash
wxgzh article.md --cover ./cover.jpg
```

或者分步发布时使用：

```bash
wxgzh publish --article .wxgzh/article.html --cover ./cover.jpg
```

### 5. 使用 Front Matter 控制元信息

Markdown 文件支持 Front Matter，例如：

```yaml
---
title: 这是文章标题
author: wxgzh
digest: 这是文章摘要
theme: blue
cover: ./cover.jpg
enableComment: true
---

# 这是文章标题

正文内容
```

支持的常用字段：

- `title`：标题
- `author`：作者
- `digest`：摘要
- `theme`：主题名
- `cover`：封面图路径
- `enableComment`：是否开启评论

命令行参数优先级高于 Front Matter，Front Matter 又高于默认配置。


## 六，备忘清单

### 1. 支持的 Markdown 内容

本项目当前重点支持这些常见内容：

- 标题、段落、粗体、斜体、链接
- 有序列表、无序列表
- 引用块
- 代码块与语法高亮
- 图片
- 表格
- 数学公式（行内与块级）

### 2. 常用命令速查

```bash
wxgzh --help  
wxgzh article.md
wxgzh config --list
wxgzh config --list-themes
wxgzh md2html --from article.md --to .wxgzh/article.html
wxgzh fix .wxgzh/article.html --no-upload
wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg
wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg
```


