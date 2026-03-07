import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Command } from 'commander';
import dotenv from 'dotenv';

import { createCover } from '../core/cover';
import { parseMarkdown } from '../core/parser';
import { assertThemeExists, listAvailableThemes } from '../core/themes';
import { loadConfig } from '../utils/config';
import { ensureParentDir } from '../utils/fs';
import { info } from '../utils/logger';
import { registerConfigCommand } from './config';
import { registerCoverCommand } from './cover';
import { registerFixCommand } from './fix';
import { convertMarkdownFile, registerMd2HtmlCommand } from './md2html';
import { publishDraft, registerPublishCommand } from './publish';

dotenv.config();

const EXAMPLES_TEXT = [
  '常用示例:',
  '  $ wxgzh article.md',
  '  $ wxgzh article.md --theme blue',
  '  $ wxgzh article.md --author "wxgzh" --digest "这是一篇摘要"',
  '  $ wxgzh article.md --cover ./cover.jpg',
  '  $ wxgzh config --list',
  '  $ wxgzh config --list-themes',
  '  $ wxgzh md2html --from article.md --to .wxgzh/article.html',
  '  $ wxgzh fix .wxgzh/article.html --no-upload',
  '  $ wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg',
  '  $ wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg'
].join('\n');

interface RootOptions {
  theme?: string;
  author?: string;
  cover?: string | boolean;
  digest?: string;
  outputDir?: string;
  enableComment?: boolean;
}

function resolveCoverValue(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function runDefaultPipeline(articlePath: string, options: RootOptions): Promise<void> {
  const absoluteArticle = path.resolve(articlePath);
  const outputDir = path.resolve(options.outputDir ?? path.join(path.dirname(absoluteArticle), '.wxgzh'));
  const articleBaseName = path.basename(absoluteArticle, path.extname(absoluteArticle));
  const htmlPath = path.join(outputDir, `${articleBaseName}.html`);
  const coverPath = path.join(outputDir, `${articleBaseName}.cover.jpg`);
  const config = await loadConfig();

  const rawMarkdown = await readFile(absoluteArticle, 'utf8');
  const parsed = parseMarkdown(rawMarkdown);
  const title = parsed.metadata.title ?? articleBaseName;
  const author = options.author ?? parsed.metadata.author ?? config.author ?? 'wxgzh';
  const digest = options.digest ?? parsed.metadata.digest ?? '由 wxgzh 自动生成的公众号草稿';
  const autoCoverDisabled = options.cover === false;
  const resolvedTheme = options.theme ?? parsed.metadata.theme ?? config.defaultTheme;

  await convertMarkdownFile(absoluteArticle, htmlPath, {
    theme: resolvedTheme ? assertThemeExists(resolvedTheme) : undefined,
    author
  });
  info(`已生成 HTML: ${htmlPath}`);

  const { fixHtmlFile } = await import('../core/fixer');
  const { WechatClient } = await import('../core/wechat');

  if (!config.appid || !config.appsecret) {
    throw new Error('未配置微信认证信息，请先运行: wxgzh config --appid xxx --appsecret yyy');
  }

  const wechat = new WechatClient({ appid: config.appid, appsecret: config.appsecret });
  await fixHtmlFile(htmlPath, { upload: true, wechat });
  info(`已修复并上传正文图片: ${htmlPath}`);

  let finalCoverPath = resolveCoverValue(options.cover) ?? parsed.metadata.cover;
  if (finalCoverPath && !path.isAbsolute(finalCoverPath)) {
    finalCoverPath = path.resolve(path.dirname(absoluteArticle), finalCoverPath);
  }

  if (!finalCoverPath && !autoCoverDisabled) {
    await ensureParentDir(coverPath);
    await createCover({ title, author, outputPath: coverPath });
    finalCoverPath = coverPath;
    info(`已生成封面图: ${coverPath}`);
  }

  if (!finalCoverPath) {
    throw new Error('当前未提供封面图。请通过 --cover 指定，或去掉 --no-cover 以自动生成简易封面。');
  }

  const result = await publishDraft(htmlPath, finalCoverPath, {
    title,
    author,
    digest,
    enableComment: options.enableComment ?? parsed.metadata.enableComment ?? config.enableComment
  });

  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('wxgzh')
    .description('把 Markdown 文章处理成微信公众号草稿，支持主题、图片修复、封面生成与一键发布')
    .usage('[article.md] [options]')
    .helpOption('-h, --help', '查看帮助')
    .showHelpAfterError('(使用 --help 查看完整帮助)')
    .argument('[article]', 'Markdown 文件路径；传入后会自动执行 md2html -> fix -> cover -> publish')
    .option('--theme <theme>', `指定主题名，可用值：${listAvailableThemes().join(', ')}`)
    .option('--author <author>', '覆盖作者名；未传时优先使用 front matter 或 config 中的 author')
    .option('--cover <cover.jpg>', '指定现成封面图；未传时默认自动生成')
    .option('--no-cover', '禁用自动封面生成；适合 front matter 已配置 cover 的场景')
    .option('--digest <digest>', '覆盖文章摘要；未传时自动从正文提取')
    .option('--output-dir <dir>', '指定中间产物输出目录，默认写入文章同级 .wxgzh/')
    .option('--enable-comment', '为本次草稿开启评论')
    .addHelpText('after', `\n${EXAMPLES_TEXT}\n`)
    .action(async (article: string | undefined, options: RootOptions) => {
      if (!article) {
        program.outputHelp();
        return;
      }

      await runDefaultPipeline(article, options);
    });

  const examplesCommand = new Command('examples')
    .description('打印常用命令示例')
    .helpOption('-h, --help', '查看帮助')
    .action(() => {
      console.log(EXAMPLES_TEXT);
    });

  program.addCommand(examplesCommand);

  registerConfigCommand(program);
  registerMd2HtmlCommand(program);
  registerFixCommand(program);
  registerCoverCommand(program);
  registerPublishCommand(program);

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ ${message}`);
  process.exitCode = 1;
});
