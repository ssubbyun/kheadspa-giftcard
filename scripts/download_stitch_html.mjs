import fs from 'fs';
import path from 'path';
import { callStitchTool, extractMcpPayload } from './stitch-mcp.mjs';

function parseCliArgs(argv) {
  const opts = {
    inFile: path.join('scripts', 'stitch_gen_res.json'),
    entry: '',
    out: path.join('.agents', 'reports', 'stitch_kheadspa_raw.html'),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--in' && argv[i + 1]) {
      opts.inFile = argv[++i];
    } else if (arg === '--entry' && argv[i + 1]) {
      opts.entry = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      opts.out = argv[++i];
    }
  }

  return opts;
}

function findHtmlEntryInGenResult(genRes) {
  const payload = extractMcpPayload(genRes);
  const firstScreen = payload?.outputComponents?.[0]?.design?.screens?.[0];
  const direct = firstScreen?.htmlCode?.name || firstScreen?.html_code?.name;
  if (direct) return direct;

  if (Array.isArray(payload?.outputComponents)) {
    for (const comp of payload.outputComponents) {
      const screens = comp?.design?.screens;
      if (!Array.isArray(screens)) continue;
      for (const screen of screens) {
        const name = screen?.htmlCode?.name || screen?.html_code?.name;
        if (name) return name;
      }
    }
  }

  return '';
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  let htmlEntry = opts.entry.trim();

  if (!htmlEntry) {
    const inPath = path.resolve(process.cwd(), opts.inFile);
    if (!fs.existsSync(inPath)) {
      throw new Error(
        `Input file not found: ${opts.inFile}. Pass --entry <projects/.../files/...> or generate a screen first.`
      );
    }
    const genRes = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
    htmlEntry = findHtmlEntryInGenResult(genRes);
  }

  if (!htmlEntry) {
    throw new Error('Could not resolve htmlCode.name from Stitch generation result.');
  }

  console.log(`Downloading Stitch HTML entry: ${htmlEntry}`);
  const dlRes = await callStitchTool('download_file', { name: htmlEntry });
  const payload = extractMcpPayload(dlRes);
  const htmlContent =
    typeof payload?.html === 'string'
      ? payload.html
      : typeof payload?.rawText === 'string'
        ? payload.rawText
        : dlRes?.result?.content?.[0]?.text || '';

  if (!htmlContent) {
    throw new Error('Downloaded Stitch HTML payload was empty.');
  }

  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, htmlContent, 'utf-8');
  console.log(`Saved Stitch HTML (${htmlContent.length} chars) to ${opts.out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
