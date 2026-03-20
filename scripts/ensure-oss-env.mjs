import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_REQUIRED_KEYS = [
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_ACCESS_KEY_ID',
  'ALIYUN_OSS_ACCESS_KEY_SECRET',
];

function parseArgs(argv) {
  const args = {
    target: '.env',
    source: '.env.local',
    require: [...DEFAULT_REQUIRED_KEYS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--target') {
      args.target = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--source') {
      args.source = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--require') {
      args.require.push(argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  args.require = [...new Set(args.require.filter(Boolean))];
  return args;
}

function parseEnvLines(text) {
  const lines = text.split(/\n/);
  const map = new Map();

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.trimStart().startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (key) {
      map.set(key, value);
    }
  }

  return map;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      text: '',
      map: new Map(),
    };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  return {
    text,
    map: parseEnvLines(text),
  };
}

function appendMissingKeys(targetText, targetMap, sourceMap, requiredKeys) {
  const linesToAppend = [];
  const appendedKeys = [];

  for (const key of requiredKeys) {
    const targetValue = targetMap.get(key)?.trim();
    if (targetValue) {
      continue;
    }

    const sourceValue = sourceMap.get(key)?.trim();
    if (!sourceValue) {
      continue;
    }

    linesToAppend.push(`${key}=${sourceValue}`);
    appendedKeys.push(key);
    targetMap.set(key, sourceValue);
  }

  if (linesToAppend.length === 0) {
    return {
      updatedText: targetText,
      appendedKeys,
    };
  }

  const normalized = targetText.replace(/\r\n/g, '\n');
  const suffix = normalized && !normalized.endsWith('\n') ? '\n' : '';
  const updatedText = `${normalized}${suffix}${linesToAppend.join('\n')}\n`;

  return {
    updatedText,
    appendedKeys,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(projectRoot, args.target);
  const sourcePath = path.resolve(projectRoot, args.source);

  const target = readEnvFile(targetPath);
  const source = readEnvFile(sourcePath);

  const { updatedText, appendedKeys } = appendMissingKeys(
    target.text,
    target.map,
    source.map,
    args.require,
  );

  if (appendedKeys.length > 0) {
    fs.writeFileSync(targetPath, updatedText, 'utf8');
    console.log(`[INFO] Synced missing keys into ${path.relative(projectRoot, targetPath)}: ${appendedKeys.join(', ')}`);
  } else {
    console.log(`[INFO] No OSS env sync needed for ${path.relative(projectRoot, targetPath)}.`);
  }

  const missingKeys = args.require.filter((key) => {
    const value = target.map.get(key)?.trim();
    return !value;
  });

  if (missingKeys.length > 0) {
    console.error(
      `[FAIL] Missing required env keys in ${path.relative(projectRoot, targetPath)}: ${missingKeys.join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`[PASS] Required env keys present in ${path.relative(projectRoot, targetPath)}.`);
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
