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

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
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

export async function fixHtmlFile(articlePath: string, options: FixHtmlOptions): Promise<{ imageCount: number }> {
  const html = await readTextFile(articlePath);
  const metadata = readHtmlMetadata(html);
  const $ = cheerio.load(html);
  const sourceBaseDir = metadata.sourceDir ? path.resolve(metadata.sourceDir) : path.dirname(articlePath);

  $('script,iframe').remove();

  const images = $('img').toArray();
  for (const element of images) {
    const image = $(element);
    const source = image.attr('src');
    if (!source) {
      continue;
    }

    if (options.upload && options.wechat && !source.includes('mmbiz.qpic.cn')) {
      const uploadedUrl = await options.wechat.uploadArticleImage(resolveImageSource(sourceBaseDir, source));
      image.attr('src', uploadedUrl);
      image.attr('data-original-src', source);
    } else if (options.cdn && !isRemoteUrl(source)) {
      image.attr('src', toCdnUrl(options.cdn, source));
    }

    image.attr('style', [
      'display:block',
      'max-width:100%',
      'height:auto',
      'margin:0 auto',
      'border-radius:6px'
    ].join(';'));
  }

  await writeTextFile(articlePath, $.html());
  return { imageCount: images.length };
}
