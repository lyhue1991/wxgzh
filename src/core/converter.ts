import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { inline } from '@css-inline/css-inline';
import * as cheerio from 'cheerio';
import type { AnyNode, DataNode, Element } from 'domhandler';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';

import type { ArticleMetadata } from '../types';
import { getDefaultThemeName, isValidTheme } from './themes';

const HIGHLIGHT_INLINE_CSS = `
.hljs-comment,
.hljs-quote {
  color: #6a9955;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-section,
.hljs-link,
.hljs-meta .hljs-keyword {
  color: #c586c0;
  font-weight: 600;
}

.hljs-string,
.hljs-regexp,
.hljs-symbol,
.hljs-bullet,
.hljs-addition,
.hljs-template-tag,
.hljs-template-variable {
  color: #ce9178;
}

.hljs-number,
.hljs-literal,
.hljs-meta,
.hljs-selector-attr,
.hljs-selector-pseudo,
.hljs-attr,
.hljs-attribute {
  color: #b5cea8;
}

.hljs-built_in,
.hljs-type,
.hljs-name,
.hljs-selector-class,
.hljs-selector-id {
  color: #4ec9b0;
}

.hljs-title,
.hljs-title.class_,
.hljs-title.class_.inherited__,
.hljs-title.function_,
.hljs-function .hljs-title,
.hljs-class .hljs-title {
  color: #dcdcaa;
}

.hljs-variable,
.hljs-params,
.hljs-operator,
.hljs-punctuation,
.hljs-subst,
.hljs-deletion,
.hljs-property {
  color: #d4d4d4;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: 700;
}
`;

const WECHAT_BLOCKQUOTE_INLINE_CSS = `
blockquote,
q {
  margin: 1.2em 3% !important;
  padding: 0 0 0 1em !important;
  border: 0 !important;
  border-left: 4px solid #d9d9d9 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #8c8c8c !important;
  quotes: none;
}

blockquote p,
blockquote ul,
blockquote ol,
blockquote section,
blockquote pre,
blockquote table,
q p,
q ul,
q ol,
q section,
q pre,
q table {
  margin: 0.45em 0 !important;
  color: inherit !important;
}

blockquote p:first-child,
blockquote ul:first-child,
blockquote ol:first-child,
blockquote section:first-child,
blockquote pre:first-child,
blockquote table:first-child,
q p:first-child,
q ul:first-child,
q ol:first-child,
q section:first-child,
q pre:first-child,
q table:first-child {
  margin-top: 0 !important;
}

blockquote p:last-child,
blockquote ul:last-child,
blockquote ol:last-child,
blockquote section:last-child,
blockquote pre:last-child,
blockquote table:last-child,
q p:last-child,
q ul:last-child,
q ol:last-child,
q section:last-child,
q pre:last-child,
q table:last-child {
  margin-bottom: 0 !important;
}
`;

const WECHAT_TABLE_INLINE_CSS = `
section.tbl-wrapper {
  margin: 1.4em 3% !important;
  padding: 0 0 10px 0 !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch;
  background: transparent !important;
}

section.tbl-wrapper table {
  width: max-content !important;
  min-width: 100% !important;
  margin: 0 !important;
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  table-layout: auto !important;
  background: #ffffff !important;
  font-size: 15px !important;
  line-height: 1.75 !important;
}

section.tbl-wrapper thead,
section.tbl-wrapper tbody,
section.tbl-wrapper tr {
  background: #ffffff !important;
}

section.tbl-wrapper th,
section.tbl-wrapper td {
  min-width: 120px !important;
  padding: 14px 16px !important;
  border: 1px solid #d9d9d9 !important;
  text-align: left !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

section.tbl-wrapper th {
  background: #fafafa !important;
  color: #444444 !important;
  font-weight: 700 !important;
}

section.tbl-wrapper td {
  color: #4f638f !important;
}

section.tbl-wrapper a {
  color: #4f638f !important;
  text-decoration: none !important;
}
`;

const WECHAT_MATH_INLINE_CSS = `
span.math-inline {
  display: inline-block !important;
  max-width: 100% !important;
  margin: 0 0.12em !important;
  vertical-align: middle !important;
}

span.math-inline mjx-container {
  display: inline-block !important;
  max-width: 100% !important;
  color: #111111 !important;
  vertical-align: middle !important;
}

section.math-block {
  margin: 1.4em 3% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  text-align: center !important;
  -webkit-overflow-scrolling: touch;
}

section.math-block mjx-container {
  display: inline-block !important;
  min-width: min-content !important;
  color: #111111 !important;
}

section.math-block mjx-container > svg,
span.math-inline mjx-container > svg {
  display: block !important;
}
`;

const LANGUAGE_ALIASES: Record<string, string | null> = {
  'c#': 'csharp',
  'c++': 'cpp',
  bash: 'bash',
  console: 'bash',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  py3: 'python',
  python3: 'python',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  text: null,
  plaintext: null,
  txt: null,
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
  zsh: 'bash'
};

function resolveHighlightLanguage(language: string): string | null {
  const raw = language.trim().toLowerCase();
  if (!raw) {
    return '';
  }

  const token = raw
    .replace(/^[{\[]|[}\]]$/g, '')
    .replace(/^language-/, '')
    .replace(/^lang-/, '')
    .split(/[\s,{]/, 1)[0]
    ?.trim();

  if (!token) {
    return '';
  }

  if (Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, token)) {
    return LANGUAGE_ALIASES[token];
  }

  return token;
}

function renderHighlightedCode(code: string, language: string): string {
  const normalizedLanguage = resolveHighlightLanguage(language);

  if (normalizedLanguage === null) {
    return escapeHtml(code);
  }

  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return hljs.highlight(code, { language: normalizedLanguage }).value;
  }

  return hljs.highlightAuto(code).value;
}

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(code: string, language: string): string {
    const normalizedLanguage = resolveHighlightLanguage(language);
    const highlighted = renderHighlightedCode(code, language);
    const languageClass = normalizedLanguage ? ` language-${normalizedLanguage}` : '';
    return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>`;
  }
});

markdown.use(mathjax3);

const DEFAULT_THEME = getDefaultThemeName();
const VOID_HTML_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function isTextNodeEmpty(node: AnyNode): boolean {
  return node.type === 'text' && !node.data.trim();
}

function isStandaloneImageParagraph($paragraph: cheerio.Cheerio<any>): boolean {
  const nodes = $paragraph.contents().toArray().filter((node) => !isTextNodeEmpty(node));
  return nodes.every((node) => node.type === 'tag' && ['img', 'br'].includes((node as Element).tagName.toLowerCase()));
}

function getStylesRoot(): string {
  return path.resolve(__dirname, '../../styles');
}

function getThemeCssPath(theme: string): string {
  return path.join(getStylesRoot(), `${theme}.css`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getCustomCssPath(): string {
  return path.join(getStylesRoot(), 'custom.css');
}

async function loadThemeCss(theme?: string): Promise<string> {
  const resolvedTheme = (theme ?? DEFAULT_THEME).trim() || DEFAULT_THEME;

  if (resolvedTheme === DEFAULT_THEME || !isValidTheme(resolvedTheme)) {
    return readFile(getThemeCssPath(DEFAULT_THEME), 'utf8');
  }

  return readFile(getThemeCssPath(resolvedTheme), 'utf8');
}

async function loadCustomCss(): Promise<string> {
  const customCssPath = getCustomCssPath();
  if (!(await pathExists(customCssPath))) {
    return '';
  }

  return readFile(customCssPath, 'utf8');
}

function normalizeListItems($: cheerio.CheerioAPI): void {
  $('li').each((_, element) => {
    const $item = $(element);
    const childElements = $item
      .contents()
      .toArray()
      .filter((node) => !isTextNodeEmpty(node));

    if (childElements.length === 0) {
      return;
    }

    const hasBlockChild = childElements.some((node) => {
      if (node.type !== 'tag') {
        return false;
      }

      const tagName = (node as Element).tagName.toLowerCase();
      return ['p', 'ul', 'ol', 'section', 'blockquote', 'pre', 'table'].includes(tagName);
    });

    const firstChild = childElements[0];
    if (!hasBlockChild && firstChild?.type === 'tag' && (firstChild as Element).tagName.toLowerCase() === 'span' && childElements.length === 1) {
      return;
    }

    if (hasBlockChild) {
      return;
    }

    $item.html(`<span>${$item.html() ?? ''}</span>`);
  });
}

function normalizeImages($: cheerio.CheerioAPI): void {
  $('img').each((_, element) => {
    const $image = $(element);
    const parent = $image.parent();
    const parentTag = parent.get(0)?.type === 'tag' ? (parent.get(0) as Element).tagName.toLowerCase() : undefined;

    if (parentTag === 'section' && parent.attr('data-wxgzh') === 'image') {
      parent.addClass('img-wrapper');
      return;
    }

    if (parentTag === 'p') {
      if (isStandaloneImageParagraph(parent)) {
        parent.replaceWith(`<section class="img-wrapper" data-wxgzh="image">${$.html($image)}</section>`);
      } else {
        $image.wrap('<section class="img-wrapper" data-wxgzh="image"></section>');
      }
      return;
    }

    $image.wrap('<section class="img-wrapper" data-wxgzh="image"></section>');
  });
}

function normalizeTables($: cheerio.CheerioAPI): void {
  $('table').each((_, element) => {
    const $table = $(element);
    const parent = $table.parent();
    const parentTag = parent.get(0)?.type === 'tag' ? (parent.get(0) as Element).tagName.toLowerCase() : undefined;

    if (parentTag === 'section' && parent.attr('data-wxgzh') === 'table') {
      parent.addClass('tbl-wrapper');
      return;
    }

    $table.wrap('<section class="tbl-wrapper" data-wxgzh="table"></section>');
  });
}

function renderSoftBreakFriendlyHtml(nodes: AnyNode[], preserveSoftBreak = true): string {
  return nodes.map((node) => renderSoftBreakFriendlyNode(node, preserveSoftBreak)).join('');
}

function renderSoftBreakFriendlyNode(node: AnyNode, preserveSoftBreak: boolean): string {
  if (node.type === 'text') {
    return renderSoftBreakFriendlyText(node as DataNode, preserveSoftBreak);
  }

  if (node.type !== 'tag') {
    return '';
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const attributes = Object.entries(element.attribs ?? {})
    .map(([key, value]) => ` ${key}="${escapeHtmlAttribute(String(value))}"`)
    .join('');

  if (VOID_HTML_TAGS.has(tagName)) {
    return `<${tagName}${attributes}>`;
  }

  const nextPreserveSoftBreak = preserveSoftBreak && !['code', 'pre'].includes(tagName);
  const children = renderSoftBreakFriendlyHtml(element.children ?? [], nextPreserveSoftBreak);
  return `<${tagName}${attributes}>${children}</${tagName}>`;
}

function renderSoftBreakFriendlyText(node: DataNode, preserveSoftBreak: boolean): string {
  const normalized = node.data.replace(/\r\n?/g, '\n');
  if (!preserveSoftBreak || !normalized.includes('\n')) {
    return escapeHtml(normalized);
  }

  return normalized.split('\n').map((segment) => escapeHtml(segment)).join('<br>');
}

function normalizeBlockquoteSoftBreaks($: cheerio.CheerioAPI): void {
  $('blockquote p, q p').each((_, element) => {
    const paragraph = element as Element;
    $(paragraph).html(renderSoftBreakFriendlyHtml(paragraph.children ?? []));
  });
}

function normalizeMathFormulas($: cheerio.CheerioAPI): void {
  $('span[id^="mjx-"]').each((_, element) => {
    const $wrapper = $(element);
    const $container = $wrapper.find('mjx-container').first();

    if ($container.length === 0) {
      return;
    }

    $wrapper.find('style, mjx-assistive-mml').remove();
    const isDisplay = $container.attr('display') === 'true';
    $container.removeAttr('style');

    if (isDisplay) {
      $wrapper.replaceWith(`<section class="math-block" data-wxgzh="math-block">${$.html($container)}</section>`);
      return;
    }

    $wrapper.replaceWith(`<span class="math-inline" data-wxgzh="math-inline">${$.html($container)}</span>`);
  });

  $('section > eqn').each((_, element) => {
    const $eqn = $(element);
    const $container = $eqn.find('mjx-container').first();
    if ($container.length === 0) {
      return;
    }

    $eqn.find('style, mjx-assistive-mml').remove();
    $container.removeAttr('style');
    $eqn.replaceWith(`<section class="math-block" data-wxgzh="math-block">${$.html($container)}</section>`);
  });

  $('eq').each((_, element) => {
    const $eq = $(element);
    const $container = $eq.find('mjx-container').first();
    if ($container.length === 0) {
      return;
    }

    $eq.find('style, mjx-assistive-mml').remove();
    $container.removeAttr('style');
    $eq.replaceWith(`<span class="math-inline" data-wxgzh="math-inline">${$.html($container)}</span>`);
  });
}

function createMetadataTags(metadata: ArticleMetadata): string {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  return entries
    .map(([key, value]) => `<meta name="wxgzh:${key}" content="${escapeHtmlAttribute(String(value))}">`)
    .join('\n');
}

function createDocumentHtml(content: string, metadata: ArticleMetadata): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${escapeHtmlAttribute(metadata.title ?? 'wxgzh article')}</title>`,
    `  ${createMetadataTags(metadata)}`,
    '</head>',
    '<body>',
    `  <div id="write" class="wrapper"><article>${content}</article></div>`,
    '</body>',
    '</html>'
  ].join('\n');
}

function setInlineStyleProperty(existingStyle: string | undefined, property: string, value: string): string {
  const entries = new Map<string, string>();

  if (existingStyle) {
    for (const declaration of existingStyle.split(';')) {
      const trimmed = declaration.trim();
      if (!trimmed) {
        continue;
      }

      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const name = trimmed.slice(0, separatorIndex).trim();
      const declarationValue = trimmed.slice(separatorIndex + 1).trim();
      if (!name || !declarationValue) {
        continue;
      }

      entries.set(name, declarationValue);
    }
  }

  entries.set(property, value);

  return Array.from(entries.entries())
    .map(([name, declarationValue]) => `${name}: ${declarationValue}`)
    .join('; ');
}

function cleanInlinedHtml(html: string): string {
  const $ = cheerio.load(html);

  $('pre > code').each((_, element) => {
    const $element = $(element);
    $element.html(renderWechatFriendlyCodeHtml($element.contents().toArray()));
  });

  const $article = $('body > #write > article').first();
  const $firstChild = $article.children().first();
  if ($firstChild.length > 0) {
    $firstChild.attr('style', setInlineStyleProperty($firstChild.attr('style'), 'margin-top', '0 !important'));
  }

  $('style').remove();
  return $.html();
}

function renderWechatFriendlyCodeHtml(nodes: AnyNode[]): string {
  return nodes.map((node) => renderWechatFriendlyCodeNode(node)).join('');
}

function renderWechatFriendlyCodeNode(node: AnyNode): string {
  if (node.type === 'text') {
    return renderWechatFriendlyCodeText(node as DataNode);
  }

  if (node.type !== 'tag') {
    return '';
  }

  const element = node as Element;
  const attributes = Object.entries(element.attribs ?? {})
    .map(([key, value]) => ` ${key}="${escapeHtmlAttribute(String(value))}"`)
    .join('');
  const children = renderWechatFriendlyCodeHtml(element.children ?? []);

  return `<${element.tagName}${attributes}>${children}</${element.tagName}>`;
}

function renderWechatFriendlyCodeText(node: DataNode): string {
  const normalized = node.data.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  let result = '';

  for (const char of normalized) {
    if (char === '\n') {
      result += '<br>';
      continue;
    }

    if (char === ' ') {
      result += '&nbsp;';
      continue;
    }

    result += escapeHtml(char);
  }

  return result;
}

export async function renderMarkdownToHtml(body: string, metadata: ArticleMetadata): Promise<string> {
  const content = markdown.render(body);
  const $ = cheerio.load(`<article>${content}</article>`);

  normalizeListItems($);
  normalizeImages($);
  normalizeTables($);
  normalizeBlockquoteSoftBreaks($);
  normalizeMathFormulas($);

  const themeCss = await loadThemeCss(metadata.theme);
  const customCss = await loadCustomCss();
  const articleHtml = $('article').html() ?? '';
  const baseHtml = createDocumentHtml(articleHtml, metadata);
  const inlinedHtml = inline(baseHtml, {
    extraCss: `${themeCss}\n${HIGHLIGHT_INLINE_CSS}\n${WECHAT_BLOCKQUOTE_INLINE_CSS}\n${WECHAT_TABLE_INLINE_CSS}\n${WECHAT_MATH_INLINE_CSS}\n${customCss}`,
    keepAtRules: true,
    applyWidthAttributes: false,
    applyHeightAttributes: false
  });

  return cleanInlinedHtml(inlinedHtml);
}

export function extractPublishableContent(html: string): string {
  const $ = cheerio.load(html);
  const articleHtml = $('body > #write > article').first().html();
  if (typeof articleHtml === 'string' && articleHtml.trim()) {
    return articleHtml.trim();
  }

  const bodyHtml = $('body').html();
  if (typeof bodyHtml === 'string' && bodyHtml.trim()) {
    return bodyHtml.trim();
  }

  return html.trim();
}

export function readHtmlMetadata(html: string): ArticleMetadata {
  const $ = cheerio.load(html);
  const metadata: ArticleMetadata = {};

  $('meta[name^="wxgzh:"]').each((_, element) => {
    const name = $(element).attr('name')?.replace('wxgzh:', '');
    const value = $(element).attr('content');
    if (!name || value === undefined) {
      return;
    }

    if (name === 'enableComment') {
      metadata.enableComment = value === 'true';
      return;
    }

    (metadata as Record<string, unknown>)[name] = value;
  });

  return metadata;
}
