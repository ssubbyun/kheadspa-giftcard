import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const target = process.argv[2];

if (!target) {
  console.error('Usage: node analyze-impact.mjs <file-path-or-symbol>');
  process.exit(1);
}

function listSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'lib') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const searchDirs = [
  path.join(ROOT_DIR, 'src'),
  path.join(ROOT_DIR, 'functions', 'src'),
  path.join(ROOT_DIR, 'scripts'),
];
const allFiles = searchDirs.flatMap(listSourceFiles);

const normalizedTarget = target.replace(/\\/g, '/').replace(/^\.\//, '');
const targetAbs = path.join(ROOT_DIR, normalizedTarget);
const isFile = fs.existsSync(targetAbs) && fs.statSync(targetAbs).isFile();

const searchTokens = new Set();
const exportedSymbols = [];

if (isFile) {
  const relNoExt = normalizedTarget.replace(/\.(ts|tsx|js|mjs)$/, '');
  if (relNoExt.startsWith('src/')) {
    searchTokens.add(`@/${relNoExt.slice(4)}`);
  }
  searchTokens.add(path.basename(relNoExt));

  const content = fs.readFileSync(targetAbs, 'utf-8');
  const exportMatches = content.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g
  );
  for (const m of exportMatches) {
    exportedSymbols.push(m[1]);
    searchTokens.add(m[1]);
  }
} else {
  searchTokens.add(target);
}

console.log(`\n=== Impact Analysis for: ${target} ===`);
console.log(`Mode: ${isFile ? 'File + Exported Symbols' : 'Symbol Search'}`);
if (exportedSymbols.length > 0) {
  console.log(`Exported symbols (${exportedSymbols.length}): ${exportedSymbols.join(', ')}`);
}

const matchesByFile = new Map();
for (const file of allFiles) {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  if (rel === normalizedTarget) continue;

  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  const matchedLines = [];
  lines.forEach((line, idx) => {
    for (const token of searchTokens) {
      if (line.includes(token)) {
        matchedLines.push({ lineNum: idx + 1, line: line.trim(), token });
        break;
      }
    }
  });

  if (matchedLines.length > 0) {
    matchesByFile.set(rel, matchedLines);
  }
}

console.log(`\nCallers / References found in ${matchesByFile.size} file(s):`);
for (const [rel, lines] of matchesByFile.entries()) {
  console.log(`  - ${rel}`);
  for (const item of lines.slice(0, 5)) {
    console.log(`      L${item.lineNum}: ${item.line.slice(0, 110)}`);
  }
  if (lines.length > 5) {
    console.log(`      ... (+${lines.length - 5} more lines)`);
  }
}

const touchesNextApi =
  normalizedTarget.startsWith('src/app/api/') ||
  Array.from(matchesByFile.keys()).some((f) => f.startsWith('src/app/api/'));
const touchesFunctions =
  normalizedTarget.startsWith('functions/') || matchesByFile.has('functions/src/index.ts');
const touchesStorageOrFirebase =
  normalizedTarget.includes('storage.ts') ||
  normalizedTarget.includes('firebase.ts') ||
  matchesByFile.has('src/lib/storage.ts') ||
  matchesByFile.has('src/lib/firebase.ts');

console.log('\n=== Dual-Layer Warnings ===');
if (touchesNextApi || touchesFunctions) {
  console.log(
    '[WARN][DUAL-BACKEND] This target connects to API endpoints. Any API change MUST be synchronized between src/app/api/** AND functions/src/index.ts!'
  );
}
if (touchesStorageOrFirebase) {
  console.log(
    '[WARN][DUAL-STORAGE] This target interacts with persistence. Keep local JSON (src/lib/storage.ts) and Firestore (src/lib/firebase.ts) strictly isolated without hybrid fallback, and avoid unindexed composite Firestore queries.'
  );
}
if (!touchesNextApi && !touchesFunctions && !touchesStorageOrFirebase) {
  console.log('No dual-backend or dual-storage boundary crossed directly.');
}

// Match relevant pitfalls from known-pitfalls.md
const pitfallsPath = path.join(ROOT_DIR, '.agents', 'memory', 'known-pitfalls.md');
if (fs.existsSync(pitfallsPath)) {
  const pitfallsRaw = fs.readFileSync(pitfallsPath, 'utf-8');
  const sections = pitfallsRaw.split(/^##\s+/m).slice(1);
  const keywords = new Set([
    ...Array.from(searchTokens).map((t) => t.toLowerCase()),
    ...normalizedTarget.toLowerCase().split(/[\/._-]+/),
  ]);

  const related = [];
  for (const sec of sections) {
    const title = sec.split(/\r?\n/)[0].trim();
    if (!title.startsWith('PITFALL-')) continue;
    const lower = sec.toLowerCase();
    for (const kw of keywords) {
      if (kw.length >= 3 && lower.includes(kw)) {
        related.push(title);
        break;
      }
    }
  }

  console.log('\n=== Related Known Pitfalls ===');
  if (related.length > 0) {
    for (const r of related) console.log(`  * ${r}`);
  } else {
    console.log('  (No direct keyword match, still review .agents/memory/known-pitfalls.md)');
  }
}
