import path from 'node:path';

import * as cheerio from 'cheerio';

import { readHtmlMetadata } from './converter';
import { readTextFile, writeTextFile } from '../utils/fs';
import { WechatClient } from './wechat';

export interface FixHtmlOptions {
  upload: boolean;
  cdn?: string;
  wechat?: WechatClient;
}

export interface FixHtmlResult {
  imageCount: number;
  skippedImages: string[];
}

const LAZY_SOURCE_ATTRIBUTE = 'data-src';

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || trimmed.startsWith('data:') || trimmed === 'about:blank';
}

function isUsableSource(value: string | undefined): value is string {
  return value !== undefined && !isPlaceholderValue(value);
}

function pickImageSource(lazySource: string | undefined, directSource: string | undefined): string | undefined {
  // 微信保存页等懒加载结构：真实地址在 data-src，src 可能是空白占位图
  if (isUsableSource(lazySource)) {
    return lazySource.trim();
  }

  if (isUsableSource(directSource)) {
    return directSource.trim();
  }

  return undefined;
}

function toCdnUrl(cdn: string, source: string): string {
  const cleanBase = cdn.replace(/\/+$/, '');
  const fileName = path.basename(source);
  return `${cleanBase}/${encodeURIComponent(fileName)}`;
}

function resolveImageSource(baseDir: string, source: string): string {
  if (isRemoteUrl(source) || path.isAbsolute(source)) {
    return source;
  }

  const normalizedSource = (() => {
    try {
      return decodeURIComponent(source);
    } catch {
      return source;
    }
  })();

  return path.resolve(baseDir, normalizedSource);
}

export async function fixHtmlFile(articlePath: string, options: FixHtmlOptions): Promise<FixHtmlResult> {
  const html = await readTextFile(articlePath);
  const metadata = readHtmlMetadata(html);
  const $ = cheerio.load(html);
  const sourceBaseDir = metadata.sourceDir ? path.resolve(metadata.sourceDir) : path.dirname(articlePath);

  $('script,iframe').remove();

  const images = $('img').toArray();
  const skippedImages: string[] = [];
  let imageCount = 0;

  for (const [index, element] of images.entries()) {
    const image = $(element);
    const source = pickImageSource(image.attr(LAZY_SOURCE_ATTRIBUTE), image.attr('src'));
    if (source === undefined) {
      skippedImages.push(`第 ${index + 1} 张图片缺少可用地址（src 与 data-src 均为空或占位图），已跳过`);
      continue;
    }

    let finalSource = source;
    if (options.upload && options.wechat && !source.includes('mmbiz.qpic.cn')) {
      finalSource = await options.wechat.uploadArticleImage(resolveImageSource(sourceBaseDir, source));
      image.attr('data-original-src', source);
    } else if (options.cdn && !isRemoteUrl(source)) {
      finalSource = toCdnUrl(options.cdn, source);
    }

    // 真实地址统一回写 src，并移除懒加载占位属性，避免渲染端读到占位图
    image.attr('src', finalSource);
    image.removeAttr(LAZY_SOURCE_ATTRIBUTE);

    image.attr('style', [
      'display:block',
      'max-width:100%',
      'height:auto',
      'margin:0 auto',
      'border-radius:6px'
    ].join(';'));
    imageCount += 1;
  }

  await writeTextFile(articlePath, $.html());
  return { imageCount, skippedImages };
}
