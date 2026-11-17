import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const INVARIANTS_PATH = path.join(ROOT_DIR, '.agents', 'memory', 'system-invariants.json');

function parseArgs(argv) {
  let allowed = null;
  let allowApiDrift = false;
  let skipBuildArtifacts = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--allowed' && argv[i + 1]) {
      allowed = argv[++i]
        .split(',')
        .map((s) => s.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
        .filter(Boolean);
    } else if (arg.startsWith('--allowed=')) {
      allowed = arg
        .slice('--allowed='.length)
        .split(',')
        .map((s) => s.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
        .filter(Boolean);
    } else if (arg === '--allow-api-drift') {
      allowApiDrift = true;
    } else if (arg === '--skip-build-artifacts') {
      skipBuildArtifacts = true;
    }
  }

  return { allowed, allowApiDrift, skipBuildArtifacts };
}

function getModifiedFiles() {
  try {
    const raw = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' });
    const files = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const entry = line.slice(3).trim();
      const arrowIdx = entry.indexOf(' -> ');
      const file = (arrowIdx >= 0 ? entry.slice(arrowIdx + 4) : entry).replace(/\\/g, '/');
      files.push(file);
    }
    return files;
  } catch {
    return [];
  }
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf-8');
}

function main() {
  const { allowed, allowApiDrift, skipBuildArtifacts } = parseArgs(process.argv.slice(2));
  const invariants = JSON.parse(fs.readFileSync(INVARIANTS_PATH, 'utf-8'));
  const errors = [];
  const checks = [];

  const modifiedFiles = getModifiedFiles();

  // 1. Scope enforcement when --allowed is provided
  if (allowed && allowed.length > 0) {
    const codeScopes = [/^src\//, /^functions\/src\//, /^scripts\//, /^package\.json$/, /^next\.config\./, /^firebase\.json$/, /^firestore\./];
    const allowedSet = new Set(allowed);
    const outOfScope = modifiedFiles.filter((f) => {
      if (f.startsWith('.agents/')) return false; // QA suites & pitfall logs are valid learning outputs
      if (!codeScopes.some((rx) => rx.test(f))) return false;
      return !allowedSet.has(f);
    });

    if (outOfScope.length > 0) {
      errors.push(`Out-of-scope modified source files detected: ${outOfScope.join(', ')}`);
    } else {
      checks.push('Scope check passed (all modified source files are inside --allowed list).');
    }
  }

  // 2. Dual-backend synchronization check
  const nextApiModified = modifiedFiles.some((f) => f.startsWith('src/app/api/'));
  const functionsModified = modifiedFiles.includes('functions/src/index.ts');
  if (nextApiModified && !functionsModified && !allowApiDrift) {
    errors.push(
      'Dual-backend drift detected: src/app/api/** was modified without updating functions/src/index.ts (pass --allow-api-drift only if intentional).'
    );
  } else {
    checks.push('Dual-backend diff sync check passed.');
  }

  // 3. Required API route parity & security invariants
  const fnSrc = readText('functions/src/index.ts');
  for (const route of invariants.requiredApiRoutes) {
    if (!fs.existsSync(path.join(ROOT_DIR, route.nextRouteFile))) {
      errors.push(`Missing required Next.js route: ${route.nextRouteFile}`);
    }
    if (!fnSrc.includes(route.functionsPattern)) {
      errors.push(`Missing required Functions route pattern ${route.functionsPattern} in functions/src/index.ts`);
    }
  }
  checks.push(`All ${invariants.requiredApiRoutes.length} required API routes present in both backends.`);

  for (const [invName, inv] of Object.entries(invariants.securityInvariants)) {
    const tokens = inv.requiredTokens || [inv.requiredToken];
    for (const relFile of inv.files) {
      const content = readText(relFile);
      for (const tok of tokens) {
        if (!content.includes(tok)) {
          errors.push(`Security invariant "${invName}" failed: "${tok}" missing in ${relFile}`);
        }
      }
    }
  }
  checks.push('All security invariants (timingSafeEqual, Stripe verification, no-store, pk_live_) verified.');

  // 4. functions/.env reserved prefix audit (PITFALL-005)
  const functionsEnvPath = path.join(ROOT_DIR, 'functions', '.env');
  if (fs.existsSync(functionsEnvPath)) {
    const envLines = fs.readFileSync(functionsEnvPath, 'utf-8').split(/\r?\n/);
    for (const rawLine of envLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const key = line.split('=')[0].trim();
      for (const prefix of invariants.forbiddenFunctionsEnvPrefixes) {
        if (key === prefix || key.startsWith(prefix)) {
          errors.push(`Forbidden reserved env var "${key}" found in functions/.env (PITFALL-005).`);
        }
      }
    }
    checks.push('functions/.env reserved-prefix check passed.');
  }

  // 5. Required build artifacts check
  if (!skipBuildArtifacts) {
    for (const artifact of invariants.requiredBuildArtifacts) {
      if (!fs.existsSync(path.join(ROOT_DIR, artifact))) {
        errors.push(`Missing build artifact: ${artifact}. Run "pnpm build:firebase".`);
      }
    }
    checks.push('All Firebase build artifacts exist.');
  }

  console.log('\n=== Fix Safety Verification ===');
  for (const msg of checks) {
    console.log(`  [OK] ${msg}`);
  }

  if (errors.length > 0) {
    console.error('\n[FAILED] Safety violations found:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\n[PASS] All safety invariants and scope checks passed.');
}

main();
