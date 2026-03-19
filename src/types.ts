export interface ArticleMetadata {
  title?: string;
  author?: string;
  digest?: string;
  theme?: string;
  account?: string;
  cover?: string;
  enableComment?: boolean;
  sourceDir?: string;
}

export interface ParsedMarkdown {
  metadata: ArticleMetadata;
  body: string;
  originalBody: string;
}

export interface WxgzhAccountConfig {
  appid?: string;
  appsecret?: string;
  author?: string;
  defaultTheme?: string;
  enableComment?: boolean;
}

export interface WxgzhUserConfig {
  currentAccount?: string;
  accounts: Record<string, WxgzhAccountConfig>;
}

export interface WxgzhConfig extends WxgzhAccountConfig {
  account?: string;
  currentAccount?: string;
  accounts: Record<string, WxgzhAccountConfig>;
}

export interface DraftPayload {
  title: string;
  author: string;
  digest: string;
  content: string;
  thumbMediaId: string;
  enableComment: boolean;
}
