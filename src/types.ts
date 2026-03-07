export interface ArticleMetadata {
  title?: string;
  author?: string;
  digest?: string;
  theme?: string;
  cover?: string;
  enableComment?: boolean;
  sourceDir?: string;
}

export interface ParsedMarkdown {
  metadata: ArticleMetadata;
  body: string;
  originalBody: string;
}

export interface WxgzhConfig {
  appid?: string;
  appsecret?: string;
  author?: string;
  defaultTheme?: string;
  enableComment?: boolean;
}

export interface DraftPayload {
  title: string;
  author: string;
  digest: string;
  content: string;
  thumbMediaId: string;
  enableComment: boolean;
}
