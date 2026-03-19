import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertThemeExists } from '../core/themes';
import type { WxgzhAccountConfig, WxgzhConfig, WxgzhUserConfig } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'wxgzh');
const USER_CONFIG_PATH = path.join(CONFIG_DIR, 'wxgzh.json');

export function getUserConfigPath(): string {
  return USER_CONFIG_PATH;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  if (!(await pathExists(filePath))) {
    return {};
  }

  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeAccountName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeAccountConfig(input: Record<string, unknown>): WxgzhAccountConfig {
  const output: WxgzhAccountConfig = {};

  if (typeof input.appid === 'string' && input.appid.trim()) {
    output.appid = input.appid.trim();
  }

  if (typeof input.appsecret === 'string' && input.appsecret.trim()) {
    output.appsecret = input.appsecret.trim();
  }

  if (typeof input.author === 'string' && input.author.trim()) {
    output.author = input.author.trim();
  }

  if (typeof input.defaultTheme === 'string' && input.defaultTheme.trim()) {
    output.defaultTheme = assertThemeExists(input.defaultTheme.trim());
  }

  if (typeof input.enableComment === 'boolean') {
    output.enableComment = input.enableComment;
  }

  return output;
}

function sanitizeUserConfig(input: Record<string, unknown>): WxgzhUserConfig {
  const accounts: Record<string, WxgzhAccountConfig> = {};

  if (isRecord(input.accounts)) {
    for (const [accountName, accountValue] of Object.entries(input.accounts)) {
      const sanitizedName = sanitizeAccountName(accountName);
      if (!sanitizedName || !isRecord(accountValue)) {
        continue;
      }

      const sanitizedAccount = sanitizeAccountConfig(accountValue);
      if (Object.keys(sanitizedAccount).length > 0) {
        accounts[sanitizedName] = sanitizedAccount;
      }
    }
  }

  const legacyAccount = sanitizeAccountConfig(input);
  if (Object.keys(accounts).length === 0 && Object.keys(legacyAccount).length > 0) {
    accounts.default = legacyAccount;
  }

  const currentAccount = sanitizeAccountName(typeof input.currentAccount === 'string' ? input.currentAccount : undefined)
    ?? (Object.keys(accounts).length === 1 ? Object.keys(accounts)[0] : undefined);

  return {
    ...(currentAccount ? { currentAccount } : {}),
    accounts
  };
}

function envConfig(): WxgzhAccountConfig {
  return sanitizeAccountConfig({
    appid: process.env.WX_APPID,
    appsecret: process.env.WX_APPSECRET
  });
}

async function writeUserConfig(config: WxgzhUserConfig): Promise<WxgzhUserConfig> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const next = sanitizeUserConfig(config as unknown as Record<string, unknown>);
  await writeFile(getUserConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export async function loadUserConfig(): Promise<WxgzhUserConfig> {
  return sanitizeUserConfig(await readJson(getUserConfigPath()));
}

export async function loadConfig(options?: { account?: string }): Promise<WxgzhConfig> {
  const env = envConfig();
  const user = await loadUserConfig();
  const account = sanitizeAccountName(options?.account) ?? sanitizeAccountName(process.env.WX_ACCOUNT) ?? user.currentAccount;
  const selectedAccountConfig = account ? user.accounts[account] ?? {} : {};

  return {
    ...selectedAccountConfig,
    ...env,
    ...(account ? { account } : {}),
    ...(user.currentAccount ? { currentAccount: user.currentAccount } : {}),
    accounts: user.accounts
  };
}

export async function saveAccountConfig(accountName: string, patch: Partial<WxgzhAccountConfig>): Promise<WxgzhUserConfig> {
  const sanitizedAccountName = sanitizeAccountName(accountName);
  if (!sanitizedAccountName) {
    throw new Error('公众号账号名不能为空');
  }

  const current = await loadUserConfig();
  const nextAccounts = {
    ...current.accounts,
    [sanitizedAccountName]: sanitizeAccountConfig({
      ...(current.accounts[sanitizedAccountName] ?? {}),
      ...patch
    })
  };

  return writeUserConfig({
    currentAccount: current.currentAccount ?? sanitizedAccountName,
    accounts: nextAccounts
  });
}

export async function setDefaultAccount(accountName: string): Promise<WxgzhUserConfig> {
  const sanitizedAccountName = sanitizeAccountName(accountName);
  if (!sanitizedAccountName) {
    throw new Error('公众号账号名不能为空');
  }

  const current = await loadUserConfig();
  if (!current.accounts[sanitizedAccountName]) {
    throw new Error(`未找到公众号账号 ${sanitizedAccountName}，请先通过 --account ${sanitizedAccountName} 写入配置`);
  }

  return writeUserConfig({
    ...current,
    currentAccount: sanitizedAccountName
  });
}

export async function removeAccountConfig(accountName: string): Promise<WxgzhUserConfig> {
  const sanitizedAccountName = sanitizeAccountName(accountName);
  if (!sanitizedAccountName) {
    throw new Error('公众号账号名不能为空');
  }

  const current = await loadUserConfig();
  if (!current.accounts[sanitizedAccountName]) {
    throw new Error(`未找到公众号账号 ${sanitizedAccountName}`);
  }

  const nextAccounts = { ...current.accounts };
  delete nextAccounts[sanitizedAccountName];

  const remainingAccountNames = Object.keys(nextAccounts);
  const nextCurrentAccount = current.currentAccount === sanitizedAccountName
    ? remainingAccountNames[0]
    : current.currentAccount;

  return writeUserConfig({
    ...(nextCurrentAccount ? { currentAccount: nextCurrentAccount } : {}),
    accounts: nextAccounts
  });
}

export async function clearUserConfig(): Promise<void> {
  if (await pathExists(getUserConfigPath())) {
    await rm(getUserConfigPath(), { force: true });
  }
}

export function resolveWechatCredentials(config: WxgzhConfig): { appid: string; appsecret: string } {
  if (!config.appid || !config.appsecret) {
    if (config.account) {
      throw new Error(`未找到公众号账号 ${config.account} 的完整微信认证信息，请先运行: wxgzh config --account ${config.account} --appid xxx --appsecret yyy`);
    }

    throw new Error('未配置微信认证信息，请先运行: wxgzh config --account <name> --appid xxx --appsecret yyy，或通过 --account <name> 指定已配置账号');
  }

  return {
    appid: config.appid,
    appsecret: config.appsecret
  };
}

export function maskSecret(secret?: string): string | undefined {
  if (!secret) {
    return undefined;
  }

  if (secret.length <= 8) {
    return '*'.repeat(secret.length);
  }

  return `${secret.slice(0, 4)}${'*'.repeat(secret.length - 8)}${secret.slice(-4)}`;
}
