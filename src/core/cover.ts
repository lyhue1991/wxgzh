import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { parse, type BoundingBox, type Font, type Path } from 'opentype.js';
import sharp, { type OverlayOptions } from 'sharp';

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
const COVER_TITLE_FONT_PATH = path.resolve(__dirname, '../../assets/fonts/仓耳小丸子.ttf');
const FALLBACK_GRADIENT = {
  start: '#e8f3ef',
  end: '#c9ded6'
};
const DEFAULT_TITLE_LINE_LENGTH = 15;
const COVER_TEXT_COLOR = '#000000b8';

let cachedCoverFont: Font | undefined;

interface FontMetrics {
  ascender: number;
  lineHeight: number;
}

interface GlyphOutline {
  pathData: string;
  width: number;
  x1: number;
  x2: number;
}

interface PositionedPath {
  right: number;
  path: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getCoverFont(): Font | undefined {
  if (!existsSync(COVER_TITLE_FONT_PATH)) {
    return undefined;
  }

  if (!cachedCoverFont) {
    const fontBuffer = readFileSync(COVER_TITLE_FONT_PATH);
    const arrayBuffer = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
    cachedCoverFont = parse(arrayBuffer);
  }

  return cachedCoverFont;
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

function getFontLineMetrics(font: Font, fontSize: number): FontMetrics {
  const unitsPerEm = font.unitsPerEm || 1000;
  const ascender = Math.round(font.ascender / unitsPerEm * fontSize);
  const descender = Math.abs(Math.round(font.descender / unitsPerEm * fontSize));
  return {
    ascender,
    lineHeight: Math.max(Math.round((ascender + descender) * 1.08), fontSize)
  };
}

function buildFontPath(font: Font, text: string, fontSize: number): GlyphOutline {
  const pathObject: Path = font.getPath(text, 0, 0, fontSize);
  const box: BoundingBox = pathObject.getBoundingBox();
  return {
    pathData: pathObject.toPathData(3),
    width: Math.max(box.x2 - box.x1, 0),
    x1: box.x1,
    x2: box.x2
  };
}

function buildPathElement(pathData: string, x: number, y: number): string {
  return `<path d="${pathData}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)})" fill="${COVER_TEXT_COLOR}" />`;
}

function buildTitlePath(
  font: Font,
  line: string,
  index: number,
  canvasWidth: number,
  titleTop: number,
  lineHeight: number,
  ascender: number,
  fontSize: number
): PositionedPath {
  const glyphPath = buildFontPath(font, line, fontSize);
  const baselineY = titleTop + index * lineHeight + ascender;
  const startX = (canvasWidth - glyphPath.width) / 2 - glyphPath.x1;

  return {
    right: startX + glyphPath.x2,
    path: buildPathElement(glyphPath.pathData, startX, baselineY)
  };
}

function buildAuthorPath(
  font: Font,
  text: string,
  fontSize: number,
  right: number,
  baselineY: number
): string {
  const glyphPath = buildFontPath(font, text, fontSize);
  const startX = right - glyphPath.x2;
  return buildPathElement(glyphPath.pathData, startX, baselineY);
}

function buildTextSvg(params: {
  title: string;
  author: string;
  width: number;
  height: number;
}): Buffer | undefined {
  const font = getCoverFont();
  if (!font) {
    return undefined;
  }

  const lines = buildTitleLines(params.title, DEFAULT_TITLE_LINE_LENGTH);
  const sizes = estimateFontSize(params.width, lines);
  const titleMetrics = getFontLineMetrics(font, sizes.title);
  const authorMetrics = getFontLineMetrics(font, sizes.author);
  const lineHeight = titleMetrics.lineHeight;
  const titleBlockHeight = lineHeight * lines.length;
  const titleTop = Math.round((params.height - titleBlockHeight) / 2);

  const titlePaths = lines.map((line, index) => buildTitlePath(
    font,
    line,
    index,
    params.width,
    titleTop,
    lineHeight,
    titleMetrics.ascender,
    sizes.title
  ));

  const titleRight = titlePaths.length > 0
    ? Math.max(...titlePaths.map((item) => item.right))
    : params.width / 2;

  const authorText = params.author.trim();
  const authorPath = authorText
    ? buildAuthorPath(
        font,
        authorText,
        sizes.author,
        titleRight,
        titleTop + titleBlockHeight + Math.round(sizes.author * 0.4) + authorMetrics.ascender
      )
    : '';

  const svg = `
    <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
      ${titlePaths.map((item) => item.path).join('')}
      ${authorPath}
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
  const textSvg = buildTextSvg({
    title: options.title,
    author,
    width,
    height
  });

  const overlays: OverlayOptions[] = [
    {
      input: {
        create: {
          width,
          height,
          channels: 4 as const,
          background: { r: 255, g: 255, b: 255, alpha: 0.58 }
        }
      }
    }
  ];

  if (textSvg) {
    overlays.push({ input: textSvg });
  }

  await background
    .composite(overlays)
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  return outputPath;
}
