# AGENTS.md

本文件面向在本仓库内工作的自动化编码代理，提供仓库级约束、常用命令与代码风格约定。

## 1. 仓库概览

- 项目类型：Node.js + TypeScript CLI 工具。
- 运行目标：把 Markdown 转为微信公众号草稿，支持主题、图片修复、封面生成与发布。
- 运行环境：Node.js >= 18。
- 编译输出：`dist/`。
- 源码目录：`src/`。
- 样式资源：`styles/`、`assets/`。
- CLI 入口：`src/cli/index.ts`。
- 发布入口脚本：`bin/wxgzh.js`。

## 2. 重要目录

- `src/cli/`：命令行子命令注册与参数处理。
- `src/core/`：Markdown 转换、HTML 修复、微信接口、主题等核心逻辑。
- `src/utils/`：文件、配置、日志、TLS 等基础工具。
- `src/types.ts`：共享类型定义。
- `styles/`：主题 CSS 与自定义覆盖样式。
- `dist/`：编译产物，默认不要直接手改。

## 3. 构建 / 检查 / 测试命令

### 3.1 安装依赖

- 安装依赖：`npm install`
- 说明：仓库当前使用 `package-lock.json`，优先沿用 `npm`，不要擅自切换到其他包管理器。

### 3.2 构建

- 完整构建：`npm run build`
- 实际命令：`tsc -p tsconfig.json`
- 用途：将 `src/**/*.ts` 编译到 `dist/`。

### 3.3 类型检查

- 类型检查：`npm run typecheck`
- 实际命令：`tsc -p tsconfig.json --noEmit`
- 修改 TypeScript 代码后，至少运行此命令。

### 3.4 Lint

- 当前状态：仓库未配置 ESLint。
- 当前状态：仓库未发现 `eslint.config.*`、`.eslintrc*`。
- 结论：没有可直接执行的 lint 命令。
- 代理要求：不要虚构 lint 命令；如新增 lint 配置，应同步更新本文件。

### 3.5 测试

- 当前状态：仓库未配置 Jest、Vitest 或其他测试框架。
- 当前状态：仓库内未发现 `*.test.*`、`*.spec.*` 测试文件。
- 结论：当前没有可执行的测试命令。

### 3.6 运行单个测试

- 当前不可用：因为仓库尚未接入测试框架，所以不存在“单测命令”或“单个测试命令”。
- 如果你新增测试框架，务必补充：
- 新增完整测试命令，例如 `npm test`。
- 新增单文件测试命令，例如 `npm test -- path/to/file.test.ts`。
- 新增单个测试用例命令，例如 `npm test -- -t "case name"`。
- 然后更新本文件对应章节。

## 4. 常用开发命令

- 查看 CLI 帮助：`node dist/cli/index.js --help`
- 查看配置命令帮助：`node dist/cli/index.js config --help`
- 查看示例命令：`node dist/cli/index.js examples`
- 本地转换 Markdown：`node dist/cli/index.js article.md`
- 仅转 HTML：`node dist/cli/index.js md2html --from article.md --to .wxgzh/article.html`

## 5. 变更前后建议流程

- 修改前先阅读相关模块，优先遵循现有模式，不要强行引入新抽象。
- 修改 TypeScript 源码后，先运行 `npm run typecheck`。
- 如果改动影响编译产物或 CLI 行为，再运行 `npm run build`。
- 不要因为小改动顺手重写无关文件。
- 未被要求时，不要修改 `dist/` 中的生成物以外的无关内容。

## 6. 自动生成文件策略

- `dist/` 是编译输出目录。
- 优先修改 `src/`，再通过 `npm run build` 更新 `dist/`。
- 不要直接手改 `dist/` 作为最终修复手段，除非用户明确要求只改编译产物。

## 7. Cursor / Copilot 规则检查结果

- 未发现 `.cursor/rules/`。
- 未发现 `.cursorrules`。
- 未发现 `.github/copilot-instructions.md`。
- 因此本文件即为当前仓库的主要代理指引。

## 8. 代码风格总则

- 语言：TypeScript。
- 模块系统：CommonJS，见 `tsconfig.json` 中 `"module": "CommonJS"`。
- 编译严格度：启用 `strict: true`。
- 风格原则：小而清晰、显式、可读、与现有文件保持一致。
- 若现有实现已经足够直接，不要为了“更优雅”而过度抽象。

## 9. 导入约定

- 导入顺序遵循三段式：Node 内置模块、第三方依赖、项目内模块。
- 不同分组之间保留一个空行。
- 类型导入优先使用 `import type`。
- 内部模块使用相对路径导入，遵循现有写法。
- Node 内置模块通常使用 `node:` 前缀，例如 `node:path`、`node:fs/promises`。

示例：

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';

import type { WxgzhConfig } from '../types';
import { loadConfig } from '../utils/config';
```

## 10. 格式化约定

- 使用 2 空格缩进。
- 使用单引号。
- 语句末尾保留分号。
- 多行对象、数组、参数列表保持现有换行风格。
- 除非现有文件已经这样做，否则不要引入尾随逗号风格漂移。
- 保持空行克制，只在逻辑分段处留空行。

## 11. 命名约定

- 函数名、变量名：`camelCase`。
- 类型、接口、类名：`PascalCase`。
- 常量：`UPPER_SNAKE_CASE`，仅用于真正的常量值。
- 布尔值命名优先使用 `is`、`has`、`enable`、`should` 等前缀。
- 路径解析、配置清洗、HTML 处理等辅助函数使用语义明确的动词命名。

## 12. 类型约定

- 充分利用 TypeScript 严格模式，不要绕过类型系统。
- 优先使用精确类型，而不是宽泛的 `any`。
- 如必须处理外部不可信响应，优先用 `unknown` 或 `Record<string, unknown>`，再做收窄。
- 当前代码中对微信接口响应存在 `Record<string, any>` 用法；新代码应尽量收敛范围，不要扩散这种写法。
- 返回值类型尽量显式，尤其是导出函数与公共 API。
- 异步函数显式标注 `Promise<T>`。

## 13. 错误处理约定

- 对外部系统失败要抛出明确错误，错误信息使用中文，便于 CLI 用户理解。
- 错误消息应包含上下文，例如接口名称、缺失配置项、失败原因。
- 仅在“有明确降级策略”时使用空 `catch`，例如探测文件是否存在、回退系统证书。
- 不要吞掉真正的业务错误。
- CLI 顶层统一在入口处兜底输出错误并设置非 0 退出码，参考 `src/cli/index.ts`。

## 14. 日志与输出

- 普通提示优先复用 `src/utils/logger.ts` 中的 `info`、`success`、`warn`。
- 需要中断流程时使用抛错，而不是只打印错误后继续运行。
- 面向机器消费的结果可输出 JSON，现有 `publish`/`config` 流程已经这样做。
- 不要无故增加调试日志。

## 15. 配置处理约定

- 配置读取集中在 `src/utils/config.ts`。
- 用户配置与环境变量都要经过清洗再进入业务逻辑。
- 对字符串配置执行 `trim()`，对布尔配置做显式判断。
- 涉及主题名等受限值时，要先做校验，例如 `assertThemeExists()`。
- 对密钥类信息输出时必须脱敏，参考 `maskSecret()`。

## 16. 文件与路径处理约定

- 路径处理统一使用 `path.resolve()`、`path.join()`、`path.dirname()` 等标准库。
- 写文件前优先确保父目录存在，参考 `ensureParentDir()`。
- 文本文件默认使用 UTF-8。
- 涉及用户传入的相对路径时，要基于明确的基准目录解析。

## 17. HTML / Markdown 处理约定

- HTML 处理以 `cheerio` 为主，修改 DOM 时尽量局部、可预测。
- Markdown 转换集中在 `src/core/converter.ts` 与 `src/core/parser.ts`。
- 主题样式与自定义样式加载逻辑已存在，新增样式能力时优先复用现有入口。
- 处理微信公众号兼容性时，优先延续“先结构化转换，再内联样式”的现有思路。

## 18. CLI 设计约定

- 子命令注册集中在 `src/cli/`。
- 命令描述、帮助文案、错误提示保持中文。
- 新增 CLI 参数时，同时补充帮助说明与示例。
- 能复用已有 pipeline 时，不要创建重复命令。

## 19. 依赖与发布相关约定

- 不要随意升级依赖版本。
- 只有在确有需要时才修改 `package.json` 与 `package-lock.json`。
- 如果新增依赖，确认其适配 Node 18，并说明用途。
- `prepare` 会触发构建，注意安装依赖时会自动执行 `npm run build`。

## 20. 提交前最低检查

- 代码改动与需求一致。
- 未手改无关生成物。
- `npm run typecheck` 通过。
- 如改动影响运行时行为，`npm run build` 通过。
- 如新增命令、测试或规则文件，记得回写本 `AGENTS.md`。
