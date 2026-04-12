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
const explicitEnvPath = process.env.APP_ENV_FILE?.trim();
const envPath = explicitEnvPath ? path.resolve(explicitEnvPath) : path.resolve(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️  无法加载 ${envPath}:`, result.error.message);
} else {
  console.log(`✅ 已加载环境变量: ${envPath}`);
}
