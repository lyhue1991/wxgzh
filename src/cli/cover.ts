import path from 'node:path';

import { Command } from 'commander';

import { createCover, listCoverPresets } from '../core/cover';
import { success } from '../utils/logger';

interface CoverOptions {
  background?: string;
  title?: string;
  author?: string;
  to?: string;
  list?: boolean;
}

export function registerCoverCommand(program: Command): void {
  program
    .command('cover')
    .description('生成公众号封面图，支持自定义背景或随机使用内置背景')
    .usage('[options]')
    .helpOption('-h, --help', '查看帮助')
    .option('--background <pic.jpg>', '指定自定义背景图路径；未传时自动随机使用内置背景图')
    .option('--title <title>', '封面标题')
    .option('--author <author>', '作者名')
    .option('--to <cover.jpg>', '输出文件路径')
    .option('--list', '列出全部内置背景图名称')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh cover --list\n  $ wxgzh cover --title "我的文章" --to .wxgzh/cover.jpg\n  $ wxgzh cover --title "我的文章" --background ./bg.jpg --to .wxgzh/cover.jpg\n'
    )
    .action(async (options: CoverOptions, command: Command) => {
      const mergedOptions = command.optsWithGlobals() as CoverOptions;

      if (options.list) {
        console.log(listCoverPresets().join('\n'));
        return;
      }

      if (!mergedOptions.title || !options.to) {
        throw new Error('请提供 --title 和 --to');
      }

      const output = await createCover({
        title: mergedOptions.title,
        author: mergedOptions.author,
        outputPath: path.resolve(options.to),
        backgroundPath: options.background
      });

      success(`已生成封面图: ${output}`);
    });
}
