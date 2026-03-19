import path from 'node:path';

import { Command } from 'commander';

import { extractPublishableContent, readHtmlMetadata } from '../core/converter';
import { WechatClient } from '../core/wechat';
import { loadConfig, resolveWechatCredentials } from '../utils/config';
import { readTextFile } from '../utils/fs';
import { success } from '../utils/logger';

interface PublishOptions {
  article: string;
  cover: string;
  account?: string;
  title?: string;
  author?: string;
  digest?: string;
  enableComment?: boolean;
}

export async function publishDraft(articlePath: string, coverPath: string, options?: { account?: string; title?: string; author?: string; digest?: string; enableComment?: boolean }): Promise<Record<string, any>> {
  const html = await readTextFile(path.resolve(articlePath));
  const metadata = readHtmlMetadata(html);
  const config = await loadConfig({ account: options?.account ?? metadata.account });
  const credentials = resolveWechatCredentials(config);
  const publishableContent = extractPublishableContent(html);
  const client = new WechatClient(credentials);
  const cover = await client.uploadCoverImage(path.resolve(coverPath));

  return client.createDraft({
    title: options?.title ?? metadata.title ?? path.basename(articlePath, path.extname(articlePath)),
    author: options?.author ?? metadata.author ?? config.author ?? 'wxgzh',
    digest: options?.digest ?? metadata.digest ?? '由 wxgzh 自动生成的公众号草稿',
    content: publishableContent,
    thumbMediaId: cover.mediaId,
    enableComment: options?.enableComment ?? metadata.enableComment ?? config.enableComment ?? true
  });
}

export function registerPublishCommand(program: Command): void {
  program
    .command('publish')
    .description('把 HTML 正文和封面图提交到微信公众号草稿箱')
    .usage('--article <article.html> --cover <cover.jpg> [options]')
    .helpOption('-h, --help', '查看帮助')
    .requiredOption('--article <article.html>', '已处理好的 HTML 正文路径')
    .requiredOption('--cover <cover.jpg>', '封面图路径')
    .option('--account <name>', '指定本次发布使用的公众号账号')
    .option('--title <title>', '覆盖文章标题')
    .option('--author <author>', '覆盖作者名')
    .option('--digest <digest>', '覆盖文章摘要')
    .option('--enable-comment', '为这篇草稿开启评论')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg\n  $ wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg --account 公众号名称1\n  $ wxgzh publish --article .wxgzh/article.html --cover .wxgzh/cover.jpg --title "新的标题"\n'
    )
    .action(async (options: PublishOptions) => {
      const result = await publishDraft(options.article, options.cover, {
        account: options.account,
        title: options.title,
        author: options.author,
        digest: options.digest,
        enableComment: options.enableComment
      });

      success('草稿创建成功');
      console.log(JSON.stringify(result, null, 2));
    });
}
