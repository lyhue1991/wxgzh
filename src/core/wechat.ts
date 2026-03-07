import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import axios from 'axios';
import FormData from 'form-data';

import type { DraftPayload } from '../types';
import { getHttpsAgent } from '../utils/tls';

interface TokenCache {
  access_token: string;
  expires_at: number;
}

interface WechatCredentials {
  appid: string;
  appsecret: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'wxgzh');
const http = axios.create({
  httpsAgent: getHttpsAgent(),
  timeout: 30_000
});

function tokenCachePath(appid: string): string {
  return path.join(CONFIG_DIR, `token.${appid}.json`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertWechatResponse(data: Record<string, any>, fallbackMessage: string): void {
  if (typeof data.errcode === 'number' && data.errcode !== 0) {
    throw new Error(`微信接口调用失败: ${data.errmsg ?? fallbackMessage} (${data.errcode})`);
  }
}

function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') {
    return 'image/png';
  }
  if (ext === '.gif') {
    return 'image/gif';
  }
  if (ext === '.webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export class WechatClient {
  constructor(private readonly credentials: WechatCredentials) {}

  private async readTokenCache(): Promise<TokenCache | null> {
    const cachePath = tokenCachePath(this.credentials.appid);
    if (!(await pathExists(cachePath))) {
      return null;
    }

    const raw = await readFile(cachePath, 'utf8');
    return JSON.parse(raw) as TokenCache;
  }

  private async writeTokenCache(cache: TokenCache): Promise<void> {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(tokenCachePath(this.credentials.appid), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const cached = await this.readTokenCache();
      if (cached && cached.expires_at > Date.now() + 60_000) {
        return cached.access_token;
      }
    }

    const response = await http.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: this.credentials.appid,
        secret: this.credentials.appsecret
      }
    });

    const data = response.data as Record<string, any>;
    assertWechatResponse(data, '获取 access_token 失败');

    const accessToken = String(data.access_token);
    const expiresIn = Number(data.expires_in ?? 7200);
    await this.writeTokenCache({
      access_token: accessToken,
      expires_at: Date.now() + Math.max(expiresIn - 300, 60) * 1000
    });

    return accessToken;
  }

  private async buildImageForm(source: string): Promise<FormData> {
    const form = new FormData();

    if (/^https?:\/\//i.test(source)) {
      const response = await http.get<ArrayBuffer>(source, { responseType: 'arraybuffer' });
      const fileName = path.basename(new URL(source).pathname || 'image.jpg') || 'image.jpg';
      form.append('media', Buffer.from(response.data), {
        filename: fileName,
        contentType: response.headers['content-type'] ?? guessContentType(fileName)
      });
      return form;
    }

    const absolutePath = path.resolve(source);
    form.append('media', createReadStream(absolutePath), {
      filename: path.basename(absolutePath),
      contentType: guessContentType(absolutePath)
    });
    return form;
  }

  async uploadArticleImage(source: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const form = await this.buildImageForm(source);
    const response = await http.post(
      'https://api.weixin.qq.com/cgi-bin/media/uploadimg',
      form,
      {
        params: { access_token: accessToken },
        headers: form.getHeaders()
      }
    );

    const data = response.data as Record<string, any>;
    assertWechatResponse(data, '上传正文图片失败');

    if (!data.url) {
      throw new Error('微信未返回正文图片地址');
    }

    return String(data.url).split('?')[0] ?? String(data.url);
  }

  async uploadCoverImage(source: string): Promise<{ mediaId: string; url?: string }> {
    const accessToken = await this.getAccessToken();
    const form = await this.buildImageForm(source);
    const response = await http.post(
      'https://api.weixin.qq.com/cgi-bin/material/add_material',
      form,
      {
        params: { access_token: accessToken, type: 'thumb' },
        headers: form.getHeaders()
      }
    );

    const data = response.data as Record<string, any>;
    assertWechatResponse(data, '上传封面失败');

    if (!data.media_id) {
      throw new Error('微信未返回封面 media_id');
    }

    return {
      mediaId: String(data.media_id),
      url: typeof data.url === 'string' ? String(data.url).split('?')[0] : undefined
    };
  }

  async createDraft(payload: DraftPayload): Promise<Record<string, any>> {
    const accessToken = await this.getAccessToken();
    const response = await http.post(
      'https://api.weixin.qq.com/cgi-bin/draft/add',
      {
        articles: [
          {
            title: payload.title,
            author: payload.author,
            digest: payload.digest,
            content: payload.content,
            thumb_media_id: payload.thumbMediaId,
            need_open_comment: payload.enableComment ? 1 : 0,
            only_fans_can_comment: 0
          }
        ]
      },
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );

    const data = response.data as Record<string, any>;
    assertWechatResponse(data, '创建草稿失败');
    return data;
  }
}
