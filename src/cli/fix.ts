import path from 'node:path';

import { Command } from 'commander';

import { readHtmlMetadata } from '../core/converter';
import { fixHtmlFile } from '../core/fixer';
import { WechatClient } from '../core/wechat';
import { loadConfig, resolveWechatCredentials } from '../utils/config';
import { readTextFile } from '../utils/fs';
import { success } from '../utils/logger';

interface FixOptions {
  account?: string;
  upload?: boolean;
  cdn?: string;
}

export function registerFixCommand(program: Command): void {
  program
    .command('fix')
    .description('修复 HTML 中的图片与不兼容结构，并按需上传正文图片')
    .usage('<article.html> [options]')
    .helpOption('-h, --help', '查看帮助')
    .argument('<article.html>', '要修复的 HTML 文件路径')
    .option('--account <name>', '指定上传正文图片时使用的公众号账号')
    .option('--no-upload', '只修复 HTML 结构，不上传图片到微信')
    .option('--cdn <url>', '把本地图片路径替换为指定 CDN 地址')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh fix .wxgzh/article.html\n  $ wxgzh fix .wxgzh/article.html --account 公众号名称1\n  $ wxgzh fix .wxgzh/article.html --no-upload\n  $ wxgzh fix .wxgzh/article.html --cdn https://cdn.example.com\n'
    )
    .action(async (articlePath: string, options: FixOptions) => {
      const absoluteArticlePath = path.resolve(articlePath);
      let wechat: WechatClient | undefined;

      if (options.upload !== false) {
        const html = await readTextFile(absoluteArticlePath);
        const metadata = readHtmlMetadata(html);
        const config = await loadConfig({ account: options.account ?? metadata.account });
        wechat = new WechatClient(resolveWechatCredentials(config));
      }

      const result = await fixHtmlFile(absoluteArticlePath, {
        upload: options.upload !== false,
        cdn: options.cdn,
        wechat
      });

      success(`HTML 修复完成，共处理 ${result.imageCount} 张图片`);
    });
}
