/**
 * env.ts — 最先执行的环境变量加载器
 *
 * 必须作为其他模块的第一个 import，
 * 保证 process.env.DATABASE_URL 等变量在 db.ts 执行前就已就绪。
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从项目根目录（server/ 的上一级）加载 .env
const envPath = path.resolve(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

function expandEnvReferences(): void {
  const variablePattern = /\$\{([^}]+)\}/g;
  const entries = Object.entries(process.env);

  for (const [key, rawValue] of entries) {
    if (typeof rawValue !== 'string' || !rawValue.includes('${')) continue;

    const expandedValue = rawValue.replace(variablePattern, (_match, variableName: string) => {
      const referenced = process.env[variableName];
      return typeof referenced === 'string' ? referenced : '';
    });

    process.env[key] = expandedValue;
  }
}

expandEnvReferences();

if (result.error) {
  console.warn(`⚠️  无法加载 ${envPath}:`, result.error.message);
} else {
  console.log(`✅ 已加载环境变量: ${envPath}`);
}
