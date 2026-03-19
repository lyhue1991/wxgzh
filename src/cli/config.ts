import { Command } from 'commander';

import { assertThemeExists, listAvailableThemes } from '../core/themes';
import {
  clearUserConfig,
  getUserConfigPath,
  loadConfig,
  loadUserConfig,
  maskSecret,
  removeAccountConfig,
  saveAccountConfig,
  setDefaultAccount
} from '../utils/config';
import { info, success } from '../utils/logger';

interface ConfigOptions {
  account?: string;
  appid?: string;
  appsecret?: string;
  author?: string;
  defaultTheme?: string;
  enableComment?: boolean;
  disableComment?: boolean;
  setDefaultAccount?: string;
  removeAccount?: string;
  list?: boolean;
  listAccounts?: boolean;
  listThemes?: boolean;
  clear?: boolean;
}

function listConfig(config: Awaited<ReturnType<typeof loadConfig>>): void {
  const payload = {
    account: config.account,
    currentAccount: config.currentAccount,
    availableAccounts: Object.keys(config.accounts),
    appid: config.appid,
    appsecret: maskSecret(config.appsecret),
    author: config.author,
    defaultTheme: config.defaultTheme,
    enableComment: config.enableComment
  };

  console.log(JSON.stringify(payload, null, 2));
  info(`用户级配置路径: ${getUserConfigPath()}`);
}

function listAccounts(config: Awaited<ReturnType<typeof loadUserConfig>>): void {
  const accountNames = Object.keys(config.accounts);
  if (accountNames.length === 0) {
    info('当前还没有配置任何公众号账号');
    return;
  }

  for (const accountName of accountNames) {
    console.log(accountName === config.currentAccount ? `${accountName} (default)` : accountName);
  }

  info(`用户级配置路径: ${getUserConfigPath()}`);
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('查看或更新 wxgzh 的用户级默认配置')
    .usage('[options]')
    .helpOption('-h, --help', '查看帮助')
    .option('--account <name>', '指定要查看或更新的公众号账号名；设置 appid/appsecret 时必填')
    .option('--appid <appid>', '为目标账号设置微信公众号 appid')
    .option('--appsecret <appsecret>', '为目标账号设置微信公众号 appsecret')
    .option('--author <author>', '为目标账号设置默认作者名')
    .option('--default-theme <theme>', `为目标账号设置默认主题，可用值：${listAvailableThemes().join(', ')}`)
    .option('--enable-comment', '把目标账号的默认评论开关设为开启')
    .option('--disable-comment', '把目标账号的默认评论开关设为关闭')
    .option('--set-default-account <name>', '设置默认公众号账号')
    .option('--remove-account <name>', '删除指定公众号账号配置')
    .option('--list', '查看当前生效配置')
    .option('--list-accounts', '查看全部已配置账号')
    .option('--list-themes', '查看全部可用主题名')
    .option('--clear', '清空用户级配置文件')
    .addHelpText(
      'after',
      '\n示例:\n  $ wxgzh config --list\n  $ wxgzh config --list-accounts\n  $ wxgzh config --account 公众号名称1 --appid wx123 --appsecret abc123\n  $ wxgzh config --account 公众号名称1 --author "wxgzh" --default-theme blue\n  $ wxgzh config --set-default-account 公众号名称1\n\n说明:\n  设置 appid 或 appsecret 时，必须同时通过 --account 指定公众号账号名\n'
    )
    .action(async (options: ConfigOptions, command: Command) => {
      const mergedOptions = command.optsWithGlobals() as ConfigOptions;
      const patch = {
        ...(mergedOptions.appid ? { appid: mergedOptions.appid } : {}),
        ...(mergedOptions.appsecret ? { appsecret: mergedOptions.appsecret } : {}),
        ...(mergedOptions.author ? { author: mergedOptions.author } : {}),
        ...(mergedOptions.defaultTheme ? { defaultTheme: assertThemeExists(mergedOptions.defaultTheme) } : {}),
        ...(mergedOptions.enableComment ? { enableComment: true } : {}),
        ...(mergedOptions.disableComment ? { enableComment: false } : {})
      };

      if (mergedOptions.clear) {
        await clearUserConfig();
        success('已清空用户级配置');
        return;
      }

      if (mergedOptions.list) {
        listConfig(await loadConfig({ account: mergedOptions.account }));
        return;
      }

      if (mergedOptions.listThemes) {
        console.log(listAvailableThemes().join('\n'));
        return;
      }

      if (mergedOptions.listAccounts) {
        listAccounts(await loadUserConfig());
        return;
      }

      if (mergedOptions.removeAccount) {
        if (Object.keys(patch).length > 0 || mergedOptions.setDefaultAccount) {
          throw new Error('--remove-account 不能与其他写入类参数同时使用');
        }

        const next = await removeAccountConfig(mergedOptions.removeAccount);
        success(`已删除公众号账号 ${mergedOptions.removeAccount}`);
        listAccounts(next);
        return;
      }

      let selectedAccount = mergedOptions.account;
      const hasCredentialsToSave = mergedOptions.appid || mergedOptions.appsecret;
      
      if (hasCredentialsToSave && !selectedAccount) {
        throw new Error('配置 appid 或 appsecret 时，必须通过 --account <name> 指定公众号账号名');
      }

      if (Object.keys(patch).length > 0) {
        if (!selectedAccount) {
          const userConfig = await loadUserConfig();
          selectedAccount = userConfig.currentAccount;
        }

        if (!selectedAccount) {
          throw new Error('当前没有默认公众号账号，请通过 --account <name> 指定要写入的账号');
        }

        await saveAccountConfig(selectedAccount, patch);
      }

      if (mergedOptions.setDefaultAccount) {
        await setDefaultAccount(mergedOptions.setDefaultAccount);
        selectedAccount = mergedOptions.setDefaultAccount;
      }

      if (Object.keys(patch).length === 0 && !mergedOptions.setDefaultAccount) {
        listConfig(await loadConfig({ account: mergedOptions.account }));
        return;
      }

      success('用户级配置已更新');
      listConfig(await loadConfig({ account: selectedAccount }));
    });
}
