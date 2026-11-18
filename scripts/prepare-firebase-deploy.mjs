import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const firebasePublicDir = path.join(rootDir, '.firebase-public');
const nextDir = path.join(rootDir, '.next');
const publicDir = path.join(rootDir, 'public');
const functionsDir = path.join(rootDir, 'functions');

function parseTargetArg(argv) {
  let target = 'staging';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target' && argv[i + 1]) {
      target = argv[++i].trim().toLowerCase();
    } else if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length).trim().toLowerCase();
    }
  }
  if (target !== 'staging' && target !== 'production') {
    throw new Error(`Invalid --target "${target}". Expected "staging" or "production".`);
  }
  return target;
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

export function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function formatEnvValue(val) {
  const str = String(val ?? '');
  if (/[\s#"']/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

async function main() {
  const target = parseTargetArg(process.argv.slice(2));

  // 1. .firebase-public 초기화 및 정적 에셋 복사
  if (fs.existsSync(firebasePublicDir)) {
    fs.rmSync(firebasePublicDir, { recursive: true, force: true });
  }
  fs.mkdirSync(firebasePublicDir, { recursive: true });

  copyDirSync(publicDir, firebasePublicDir);
  copyDirSync(
    path.join(nextDir, 'static'),
    path.join(firebasePublicDir, '_next', 'static')
  );

  const indexHtmlSrc = path.join(nextDir, 'server', 'app', 'index.html');
  if (!copyFileIfExists(indexHtmlSrc, path.join(firebasePublicDir, 'index.html'))) {
    throw new Error(`Next.js index.html not found at ${indexHtmlSrc}. Run "next build" first.`);
  }

  copyFileIfExists(
    path.join(nextDir, 'server', 'app', '_not-found.html'),
    path.join(firebasePublicDir, '404.html')
  );

  const publicFavicon = path.join(firebasePublicDir, 'favicon.ico');
  if (!fs.existsSync(publicFavicon)) {
    copyFileIfExists(path.join(rootDir, 'src', 'app', 'favicon.ico'), publicFavicon);
  }

  // 2. Cloud Functions TypeScript 번들링 (esbuild)
  const functionsEntry = path.join(functionsDir, 'src', 'index.ts');
  const functionsOut = path.join(functionsDir, 'lib', 'index.js');
  fs.mkdirSync(path.dirname(functionsOut), { recursive: true });

  await esbuild.build({
    entryPoints: [functionsEntry],
    outfile: functionsOut,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    external: [
      'firebase-admin',
      'firebase-admin/*',
      'firebase-functions',
      'firebase-functions/*',
      'stripe',
      'qrcode',
    ],
  });

  // 3. functions/.env 타겟 전용 동기화 (staging <-> production 교차 오염 방지, 예약 접두어 제외)
  const targetEnvPath = path.join(rootDir, `.env.${target}`);
  const fallbackExamplePath = path.join(rootDir, `.env.${target}.example`);
  const sourceEnvPath = fs.existsSync(targetEnvPath) ? targetEnvPath : fallbackExamplePath;
  const targetEnv = parseEnvFile(sourceEnvPath);

  const defaultAppUrl =
    target === 'production'
      ? 'https://gift.kheadspawellness.com'
      : 'https://kheadspa-giftcard-staging.web.app';

  const syncedEnv = {
    APP_ENV: target,
    STRIPE_SECRET_KEY:
      targetEnv.STRIPE_SECRET_KEY ||
      (target === 'production' ? 'sk_live_placeholder' : 'sk_test_sample'),
    ALLOW_DEMO_CHECKOUT:
      target === 'production'
        ? 'false'
        : targetEnv.ALLOW_DEMO_CHECKOUT || 'true',
    STAFF_PORTAL_PIN: targetEnv.STAFF_PORTAL_PIN || '1234',
    NEXT_PUBLIC_APP_URL: targetEnv.NEXT_PUBLIC_APP_URL || defaultAppUrl,
    NEXT_PUBLIC_BOOKING_URL:
      targetEnv.NEXT_PUBLIC_BOOKING_URL ||
      'https://kheadspawellness.glossgenius.com',
    RESEND_API_KEY: targetEnv.RESEND_API_KEY || '',
    EMAIL_FROM:
      targetEnv.EMAIL_FROM ||
      (target === 'production'
        ? 'K-headspa & wellness <noreply@kheadspawellness.com>'
        : 'K-headspa & wellness [TEST] <noreply@kheadspawellness.com>'),
    TWILIO_ACCOUNT_SID: targetEnv.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: targetEnv.TWILIO_AUTH_TOKEN || '',
    TWILIO_FROM_NUMBER: targetEnv.TWILIO_FROM_NUMBER || '',
  };

  const envLines = Object.entries(syncedEnv).map(
    ([key, val]) => `${key}=${formatEnvValue(val)}`
  );
  const functionsEnvPath = path.join(functionsDir, '.env');
  fs.writeFileSync(functionsEnvPath, `${envLines.join('\n')}\n`, 'utf-8');

  console.log(
    `Firebase deploy artifacts prepared cleanly for target="${target}" (using ${path.basename(sourceEnvPath)}).`
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
