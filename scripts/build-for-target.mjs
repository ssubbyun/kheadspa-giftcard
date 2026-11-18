import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseEnvFile } from './prepare-firebase-deploy.mjs';

const rootDir = process.cwd();

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

function main() {
  const target = parseTargetArg(process.argv.slice(2));
  const envFilePath = path.join(rootDir, `.env.${target}`);
  const exampleFilePath = path.join(rootDir, `.env.${target}.example`);
  const sourcePath = fs.existsSync(envFilePath) ? envFilePath : exampleFilePath;
  const targetEnv = parseEnvFile(sourcePath);

  if (target === 'production') {
    targetEnv.APP_ENV = 'production';
    targetEnv.NEXT_PUBLIC_APP_ENV = 'production';
    targetEnv.ALLOW_DEMO_CHECKOUT = 'false';
    targetEnv.NEXT_PUBLIC_DEMO_CHECKOUT = 'false';
  } else {
    targetEnv.APP_ENV = 'staging';
    targetEnv.NEXT_PUBLIC_APP_ENV = 'staging';
  }

  console.log(`\n[build-for-target] Building Next.js 16 & Firebase bundle for "${target}" using ${path.basename(sourcePath)}...`);

  const childEnv = {
    ...process.env,
    ...targetEnv,
  };

  execSync('npx next build', {
    cwd: rootDir,
    env: childEnv,
    stdio: 'inherit',
  });

  execSync(`node scripts/prepare-firebase-deploy.mjs --target ${target}`, {
    cwd: rootDir,
    env: childEnv,
    stdio: 'inherit',
  });
}

main();
