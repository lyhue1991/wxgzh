import { readdirSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

export interface CoverOptions {
  title: string;
  author?: string;
  outputPath: string;
  backgroundPath?: string;
  presetName?: string;
  width?: number;
  height?: number;
}

const BUILTIN_BACKGROUND_DIR = path.resolve(__dirname, '../../assets/backgrounds');
const FALLBACK_GRADIENT = {
  start: '#e8f3ef',
  end: '#c9ded6'
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttribute(value: string): string {
  return escapeXml(value);
}

function readFiles(dirPath: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dirPath)
      .filter((fileName) => pattern.test(fileName))
      .map((fileName) => path.join(dirPath, fileName))
      .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
  } catch {
    return [];
  }
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function getBuiltinBackgrounds(): string[] {
  return readFiles(BUILTIN_BACKGROUND_DIR, /\.(jpe?g|png)$/i);
}

function buildTitleLines(text: string, maxLineLength: number): string[] {
  const trimmed = text.trim() || '未命名文章';
  const quoted = trimmed.includes('『') || trimmed.includes('』') ? trimmed : `『${trimmed}』`;

  if (quoted.includes('\n')) {
    return quoted.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  const chars = [...quoted];
  const lines: string[] = [];

  for (let index = 0; index < chars.length; index += maxLineLength) {
    lines.push(chars.slice(index, index + maxLineLength).join(''));
  }

  return lines;
}

function estimateFontSize(width: number, lines: string[]): { title: number; author: number; longestChars: number } {
  const longestChars = Math.max(...lines.map((line) => [...line].length), 1);
  const title = Math.max(42, Math.floor(width / (longestChars + 6)));
  return {
    title,
    author: Math.max(20, Math.floor(title / 2)),
    longestChars
  };
}

function buildGradientBackground(width: number, height: number): Buffer {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${FALLBACK_GRADIENT.start}" />
          <stop offset="100%" stop-color="${FALLBACK_GRADIENT.end}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
    </svg>`;

  return Buffer.from(svg);
}

function buildTextSvg(params: {
  title: string;
  author: string;
  width: number;
  height: number;
}): Buffer {
  const lines = buildTitleLines(params.title, 10);
  const sizes = estimateFontSize(params.width, lines);
  const lineHeight = Math.round(sizes.title * 1.15);
  const titleBlockHeight = lineHeight * lines.length;
  const titleTop = Math.round((params.height - titleBlockHeight) / 2);
  const fontFamily = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  const titleWidth = sizes.longestChars * sizes.title;
  const titleRight = Math.round(params.width / 2 + titleWidth / 2);
  const authorY = titleTop + titleBlockHeight + sizes.author + Math.round(sizes.author * 0.4);

  const titleText = lines
    .map((line, index) => {
      const y = titleTop + sizes.title + index * lineHeight;
      return `<text x="50%" y="${y}" text-anchor="middle" font-size="${sizes.title}" font-family="${escapeAttribute(fontFamily)}" fill="rgba(0,0,0,0.72)">${escapeXml(line)}</text>`;
    })
    .join('');

  const authorText = params.author.trim()
    ? `<text x="${titleRight}" y="${authorY}" text-anchor="end" font-size="${sizes.author}" font-family="${escapeAttribute(fontFamily)}" fill="rgba(0,0,0,0.72)">${escapeXml(params.author.trim())}</text>`
    : '';

  const svg = `
    <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
      ${titleText}
      ${authorText}
    </svg>`;

  return Buffer.from(svg);
}

function resolveBackgroundPath(backgroundPath?: string, presetName?: string): string | undefined {
  if (backgroundPath) {
    return path.resolve(backgroundPath);
  }

  const backgrounds = getBuiltinBackgrounds();
  if (backgrounds.length === 0) {
    return undefined;
  }

  if (presetName) {
    const matched = backgrounds.find((filePath) => path.basename(filePath, path.extname(filePath)) === presetName);
    if (matched) {
      return matched;
    }
  }

  return pickRandom(backgrounds);
}

export function listCoverPresets(): string[] {
  const backgrounds = getBuiltinBackgrounds();
  if (backgrounds.length === 0) {
    return [];
  }

  return backgrounds.map((filePath) => path.basename(filePath, path.extname(filePath)));
}

export async function createCover(options: CoverOptions): Promise<string> {
  const width = options.width ?? 1000;
  const height = options.height ?? 700;
  const author = options.author?.trim() || 'wxgzh';
  const outputPath = path.resolve(options.outputPath);
  const backgroundPath = resolveBackgroundPath(options.backgroundPath, options.presetName);
  const background = backgroundPath
    ? sharp(backgroundPath).resize(width, height, { fit: 'cover' })
    : sharp(buildGradientBackground(width, height));

  await background
    .composite([
      {
        input: {
          create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0.58 }
          }
        }
      },
      {
        input: buildTextSvg({
          title: options.title,
          author,
          width,
          height
        })
      }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  return outputPath;
}
