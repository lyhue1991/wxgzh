import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import https from 'node:https';
import tls from 'node:tls';

let cachedAgent: https.Agent | undefined;

function readMacCertificates(): string[] {
  const keychains = [
    '/System/Library/Keychains/SystemRootCertificates.keychain',
    '/Library/Keychains/System.keychain'
  ].filter((filePath) => existsSync(filePath));

  const certificates: string[] = [];

  for (const keychain of keychains) {
    try {
      const output = execFileSync('security', ['find-certificate', '-a', '-p', keychain], {
        encoding: 'utf8'
      });

      if (output.trim()) {
        certificates.push(output);
      }
    } catch {
      // 读取系统钥匙串失败时退回 Node 内置证书。
    }
  }

  return certificates;
}

export function getHttpsAgent(): https.Agent {
  if (cachedAgent) {
    return cachedAgent;
  }

  const ca = [...tls.rootCertificates];

  if (process.platform === 'darwin') {
    ca.push(...readMacCertificates());
  }

  cachedAgent = new https.Agent({
    ca,
    keepAlive: true
  });

  return cachedAgent;
}
