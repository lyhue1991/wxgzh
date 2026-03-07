import matter from 'gray-matter';

import type { ArticleMetadata, ParsedMarkdown } from '../types';

function extractFirstHeading(markdown: string): { title?: string; body: string } {
  const lines = markdown.split(/\r?\n/);
  let inCodeBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    const match = line.match(/^#\s+(.+)$/);
    if (!match) {
      continue;
    }

    const nextLines = [...lines.slice(0, index), ...lines.slice(index + 1)];
    if ((nextLines[index] ?? '').trim() === '') {
      nextLines.splice(index, 1);
    }

    return {
      title: match[1].trim(),
      body: nextLines.join('\n')
    };
  }

  return { body: markdown };
}

function extractSecondaryHeadings(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const headings: string[] = [];
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine ?? '';

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    const match = line.match(/^##\s+(.+)$/);
    if (!match) {
      continue;
    }

    const heading = match[1].trim();
    if (heading) {
      headings.push(heading);
    }
  }

  return headings;
}

function buildDigest(markdown: string, title?: string): string {
  const headings = extractSecondaryHeadings(markdown);
  if (headings.length > 0) {
    return headings.join('；');
  }

  if (title?.trim()) {
    return title.trim();
  }

  return '由 wxgzh 自动生成的公众号草稿';
}

function normalizeMetadata(data: Record<string, unknown>): ArticleMetadata {
  const metadata: ArticleMetadata = {};

  if (typeof data.title === 'string' && data.title.trim()) {
    metadata.title = data.title.trim();
  }

  if (typeof data.author === 'string' && data.author.trim()) {
    metadata.author = data.author.trim();
  }

  if (typeof data.digest === 'string' && data.digest.trim()) {
    metadata.digest = data.digest.trim();
  }

  if (typeof data.theme === 'string' && data.theme.trim()) {
    metadata.theme = data.theme.trim();
  }

  if (typeof data.cover === 'string' && data.cover.trim()) {
    metadata.cover = data.cover.trim();
  }

  if (typeof data.enableComment === 'boolean') {
    metadata.enableComment = data.enableComment;
  }

  return metadata;
}

export function parseMarkdown(rawMarkdown: string): ParsedMarkdown {
  const parsed = matter(rawMarkdown);
  const frontMatter = normalizeMetadata(parsed.data as Record<string, unknown>);
  const extracted = extractFirstHeading(parsed.content.trim());
  const resolvedTitle = frontMatter.title ?? extracted.title;

  return {
    metadata: {
      ...frontMatter,
      title: resolvedTitle,
      digest: frontMatter.digest ?? buildDigest(extracted.body, resolvedTitle)
    },
    body: extracted.body,
    originalBody: parsed.content
  };
}
