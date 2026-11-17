import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

const rootDir = process.cwd();
const firebasePublicDir = path.join(rootDir, '.firebase-public');
const nextDir = path.join(rootDir, '.next');
const publicDir = path.join(rootDir, 'public');
const functionsDir = path.join(rootDir, 'functions');

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

function parseEnvFile(filePath) {
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

function isPlaceholder(val) {
  return !val || val.includes('sample') || val.includes('placeholder');
}

async function main() {
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

  // 3. functions/.env 동기화 (예약 접두어 FIREBASE_*, GCLOUD_*, K_*, PORT 절대 제외)
  const functionsEnvPath = path.join(functionsDir, '.env');
  const localEnv = parseEnvFile(path.join(rootDir, '.env.local'));
  const existingFuncEnv = parseEnvFile(functionsEnvPath);

  const pickSecret = (key, fallback) => {
    const fromLocal = localEnv[key];
    const fromExisting = existingFuncEnv[key];
    if (!isPlaceholder(fromLocal)) return fromLocal;
    if (!isPlaceholder(fromExisting)) return fromExisting;
    return fromLocal || fromExisting || fallback;
  };

  const pickAppUrl = () => {
    const fromExisting = existingFuncEnv.NEXT_PUBLIC_APP_URL;
    if (fromExisting && !fromExisting.includes('localhost')) return fromExisting;
    const fromLocal = localEnv.NEXT_PUBLIC_APP_URL;
    if (fromLocal && !fromLocal.includes('localhost')) return fromLocal;
    return 'https://gift.kheadspawellness.com';
  };

  const syncedEnv = {
    STRIPE_SECRET_KEY: pickSecret('STRIPE_SECRET_KEY', 'sk_test_sample'),
    STAFF_PORTAL_PIN: localEnv.STAFF_PORTAL_PIN || existingFuncEnv.STAFF_PORTAL_PIN || '1234',
    NEXT_PUBLIC_APP_URL: pickAppUrl(),
    NEXT_PUBLIC_BOOKING_URL:
      localEnv.NEXT_PUBLIC_BOOKING_URL ||
      existingFuncEnv.NEXT_PUBLIC_BOOKING_URL ||
      'https://kheadspawellness.glossgenius.com',
    RESEND_API_KEY: localEnv.RESEND_API_KEY || existingFuncEnv.RESEND_API_KEY || '',
    EMAIL_FROM:
      localEnv.EMAIL_FROM ||
      existingFuncEnv.EMAIL_FROM ||
      'K-headspa & wellness <noreply@kheadspawellness.com>',
    TWILIO_ACCOUNT_SID:
      localEnv.TWILIO_ACCOUNT_SID || existingFuncEnv.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN:
      localEnv.TWILIO_AUTH_TOKEN || existingFuncEnv.TWILIO_AUTH_TOKEN || '',
    TWILIO_FROM_NUMBER:
      localEnv.TWILIO_FROM_NUMBER || existingFuncEnv.TWILIO_FROM_NUMBER || '',
  };

  const envLines = Object.entries(syncedEnv).map(
    ([key, val]) => `${key}=${formatEnvValue(val)}`
  );
  fs.writeFileSync(functionsEnvPath, `${envLines.join('\n')}\n`, 'utf-8');

  console.log('Firebase deploy artifacts prepared successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
