import { Command } from 'commander';

import { assertThemeExists, listAvailableThemes } from '../core/themes';
import { clearUserConfig, getUserConfigPath, loadConfig, maskSecret, saveUserConfig } from '../utils/config';
import { info, success } from '../utils/logger';

interface ConfigOptions {
  appid?: string;
  appsecret?: string;
  author?: string;
  defaultTheme?: string;
  enableComment?: boolean;
  disableComment?: boolean;
  list?: boolean;
  listThemes?: boolean;
  clear?: boolean;
}

function listConfig(config: Awaited<ReturnType<typeof loadConfig>>): void {
  const payload = {
    ...config,
    appsecret: maskSecret(config.appsecret)
  };

  console.log(JSON.stringify(payload, null, 2));
  info(`用户级配置路径: ${getUserConfigPath()}`);
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('查看或更新 wxgzh 的用户级默认配置')
    .usage('[options]')
    .helpOption('-h, --help', '查看帮助')
    .option('--appid <appid>', '设置微信公众号 appid')
    .option('--appsecret <appsecret>', '设置微信公众号 appsecret')
    .option('--author <author>', '设置默认作者名')
    .option('--default-theme <theme>', `设置默认主题，可用值：${listAvailableThemes().join(', ')}`)
    .option('--enable-comment', '把默认评论开关设为开启')
    .option('--disable-comment', '把默认评论开关设为关闭')
    .option('--list', '查看当前生效配置')
    .option('--list-themes', '查看全部可用主题名')
    .option('--clear', '清空用户级配置文件')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh config --list\n  $ wxgzh config --list-themes\n  $ wxgzh config --author "wxgzh" --default-theme blue\n  $ wxgzh config --enable-comment\n'
    )
    .action(async (options: ConfigOptions, command: Command) => {
      const mergedOptions = command.optsWithGlobals() as ConfigOptions;

      if (mergedOptions.clear) {
        await clearUserConfig();
        success('已清空用户级配置');
        return;
      }

      if (mergedOptions.list) {
        listConfig(await loadConfig());
        return;
      }

      if (mergedOptions.listThemes) {
        console.log(listAvailableThemes().join('\n'));
        return;
      }

      const patch = {
        ...(mergedOptions.appid ? { appid: mergedOptions.appid } : {}),
        ...(mergedOptions.appsecret ? { appsecret: mergedOptions.appsecret } : {}),
        ...(mergedOptions.author ? { author: mergedOptions.author } : {}),
        ...(mergedOptions.defaultTheme ? { defaultTheme: assertThemeExists(mergedOptions.defaultTheme) } : {}),
        ...(mergedOptions.enableComment ? { enableComment: true } : {}),
        ...(mergedOptions.disableComment ? { enableComment: false } : {})
      };

      if (Object.keys(patch).length === 0) {
        listConfig(await loadConfig());
        return;
      }

      const next = await saveUserConfig(patch);
      success('用户级配置已更新');
      console.log(JSON.stringify({ ...next, appsecret: maskSecret(next.appsecret) }, null, 2));
    });
}
