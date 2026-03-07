import path from 'node:path';

import { Command } from 'commander';

import { fixHtmlFile } from '../core/fixer';
import { WechatClient } from '../core/wechat';
import { loadConfig } from '../utils/config';
import { error, success } from '../utils/logger';

interface FixOptions {
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
    .option('--no-upload', '只修复 HTML 结构，不上传图片到微信')
    .option('--cdn <url>', '把本地图片路径替换为指定 CDN 地址')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh fix .wxgzh/article.html\n  $ wxgzh fix .wxgzh/article.html --no-upload\n  $ wxgzh fix .wxgzh/article.html --cdn https://cdn.example.com\n'
    )
    .action(async (articlePath: string, options: FixOptions) => {
      let wechat: WechatClient | undefined;

      if (options.upload !== false) {
        const config = await loadConfig();
        if (!config.appid || !config.appsecret) {
          error('未配置微信认证信息，请先运行: wxgzh config --appid xxx --appsecret yyy');
        }
        wechat = new WechatClient({ appid: config.appid, appsecret: config.appsecret });
      }

      const result = await fixHtmlFile(path.resolve(articlePath), {
        upload: options.upload !== false,
        cdn: options.cdn,
        wechat
      });

      success(`HTML 修复完成，共处理 ${result.imageCount} 张图片`);
    });
}
