import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { renderMarkdownToHtml } from '../core/converter';
import { parseMarkdown } from '../core/parser';
import { assertThemeExists } from '../core/themes';
import { loadConfig } from '../utils/config';
import { writeTextFile } from '../utils/fs';
import { success } from '../utils/logger';

interface Md2HtmlOptions {
  from: string;
  to: string;
  theme?: string;
  author?: string;
}

export async function convertMarkdownFile(inputPath: string, outputPath: string, options?: { theme?: string; author?: string }): Promise<void> {
  const config = await loadConfig();
  const absoluteInputPath = path.resolve(inputPath);
  const raw = await readFile(absoluteInputPath, 'utf8');
  const parsed = parseMarkdown(raw);
  const resolvedTheme = options?.theme ?? parsed.metadata.theme ?? config.defaultTheme ?? 'default';
  const html = await renderMarkdownToHtml(parsed.body, {
    ...parsed.metadata,
    theme: assertThemeExists(resolvedTheme),
    author: options?.author ?? parsed.metadata.author ?? config.author,
    sourceDir: path.dirname(absoluteInputPath)
  });

  await writeTextFile(path.resolve(outputPath), html);
}

export function registerMd2HtmlCommand(program: Command): void {
  program
    .command('md2html')
    .description('把 Markdown 转成适合微信公众号编辑器粘贴和发布的 HTML')
    .usage('--from <input.md> --to <output.html> [options]')
    .helpOption('-h, --help', '查看帮助')
    .requiredOption('--from <input.md>', '输入 Markdown 文件路径')
    .requiredOption('--to <output.html>', '输出 HTML 文件路径')
    .option('--theme <theme>', '覆盖主题名；未传时使用 front matter 或默认配置')
    .option('--author <author>', '覆盖作者名；会写入 HTML 元数据')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh md2html --from article.md --to .wxgzh/article.html\n  $ wxgzh md2html --from article.md --to .wxgzh/article.html --theme blue\n'
    )
    .action(async (options: Md2HtmlOptions, command: Command) => {
      const mergedOptions = command.optsWithGlobals() as Md2HtmlOptions;

      await convertMarkdownFile(options.from, options.to, {
        theme: mergedOptions.theme,
        author: mergedOptions.author
      });
      success(`已生成 HTML: ${path.resolve(options.to)}`);
    });
}
