import { readdirSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_THEME = 'default';

function getStylesDir(): string {
  return path.resolve(__dirname, '../../styles');
}

function normalizeThemeName(fileName: string): string | undefined {
  if (!fileName.endsWith('.css')) {
    return undefined;
  }

  const themeName = path.basename(fileName, '.css');
  if (!themeName || themeName === 'custom') {
    return undefined;
  }

  return themeName;
}

export function listAvailableThemes(): string[] {
  try {
    const themes = readdirSync(getStylesDir())
      .map(normalizeThemeName)
      .filter((themeName): themeName is string => Boolean(themeName))
      .sort((left, right) => left.localeCompare(right, 'en'));

    if (!themes.includes(DEFAULT_THEME)) {
      return [DEFAULT_THEME, ...themes];
    }

    return themes;
  } catch {
    return [DEFAULT_THEME];
  }
}

export function isValidTheme(theme?: string): boolean {
  if (!theme) {
    return false;
  }

  return listAvailableThemes().includes(theme.trim());
}

export function assertThemeExists(theme?: string): string {
  const normalized = theme?.trim();
  if (!normalized) {
    throw new Error('主题名不能为空');
  }

  if (!isValidTheme(normalized)) {
    throw new Error(`不支持的主题: ${normalized}。可用主题：${listAvailableThemes().join(', ')}`);
  }

  return normalized;
}

export function getDefaultThemeName(): string {
  return DEFAULT_THEME;
}
