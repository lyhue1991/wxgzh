import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, content, 'utf8');
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}
