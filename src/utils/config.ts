import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertThemeExists } from '../core/themes';
import type { WxgzhConfig } from '../types';

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

function sanitizeConfig(input: Record<string, unknown>): WxgzhConfig {
  const output: WxgzhConfig = {};

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

function envConfig(): WxgzhConfig {
  return sanitizeConfig({
    appid: process.env.WX_APPID,
    appsecret: process.env.WX_APPSECRET
  });
}

export async function loadConfig(): Promise<WxgzhConfig> {
  const env = envConfig();
  const user = sanitizeConfig(await readJson(getUserConfigPath()));

  return {
    ...env,
    ...user
  };
}

export async function saveUserConfig(patch: Partial<WxgzhConfig>): Promise<WxgzhConfig> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const current = sanitizeConfig(await readJson(getUserConfigPath()));
  const next = sanitizeConfig({ ...current, ...patch });
  await writeFile(getUserConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export async function clearUserConfig(): Promise<void> {
  if (await pathExists(getUserConfigPath())) {
    await rm(getUserConfigPath(), { force: true });
  }
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
