import fs from 'fs';
import path from 'path';
import { callStitchTool, extractMcpPayload } from './stitch-mcp.mjs';

const DEFAULT_PROMPT = [
  'K-HeadSpa & Wellness digital gift card storefront landing page.',
  'Warm luxury organic Korean botanical spa aesthetic (#FAF8F5 cream, #1B3022 deep forest green, #B8935E brushed gold, Cormorant Garamond serif headlines + Inter body).',
  '1. Header with K-HeadSpa & Wellness branding, EN/KO toggle, and "Book a service" CTA.',
  '2. Live interactive gift card preview card (with theme swatches, balance badge, QR & barcode area) paired with purchase form ($100/$150/$200/$500 presets, recipient email/SMS, scheduled 8:00 AM EST delivery).',
  '3. Clean section spacing, subtle shadows, accessible inputs, responsive desktop layout.',
].join('\n');

function parseCliArgs(argv) {
  const opts = {
    project: (process.env.STITCH_PROJECT_ID || '').trim(),
    prompt: DEFAULT_PROMPT,
    device: 'DESKTOP',
    designSystem: '',
    model: 'GEMINI_3_8_FLASH',
    out: path.join('scripts', 'stitch_gen_res.json'),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project' && argv[i + 1]) {
      opts.project = argv[++i];
    } else if (arg === '--prompt' && argv[i + 1]) {
      opts.prompt = argv[++i];
    } else if (arg === '--device' && argv[i + 1]) {
      opts.device = argv[++i].toUpperCase();
    } else if (arg === '--design-system' && argv[i + 1]) {
      opts.designSystem = argv[++i];
    } else if (arg === '--model' && argv[i + 1]) {
      opts.model = argv[++i].toUpperCase();
    } else if (arg === '--out' && argv[i + 1]) {
      opts.out = argv[++i];
    }
  }

  opts.project = opts.project.replace(/^projects\//, '').trim();
  return opts;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (!opts.project) {
    console.error(
      'Missing --project <projectId> (or STITCH_PROJECT_ID env var). Run "pnpm stitch:projects" first to pick or create a project.'
    );
    process.exit(1);
  }

  const toolArgs = {
    projectId: opts.project,
    prompt: opts.prompt,
    deviceType: opts.device,
    modelId: opts.model,
  };
  if (opts.designSystem) {
    toolArgs.designSystem = opts.designSystem;
  }

  console.log(`Requesting Stitch screen generation (project=${opts.project}, device=${opts.device}, model=${opts.model})...`);
  const rpcRes = await callStitchTool('generate_screen_from_text', toolArgs);

  const outPath = path.resolve(process.cwd(), opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rpcRes, null, 2), 'utf-8');
  console.log(`Saved Stitch generation response to ${opts.out}`);

  const payload = extractMcpPayload(rpcRes);
  const firstScreen = payload?.outputComponents?.[0]?.design?.screens?.[0];
  if (firstScreen) {
    const htmlEntry = firstScreen.htmlCode?.name || firstScreen.html_code?.name || '';
    console.log(`Generated screen: ${firstScreen.name || '(unnamed)'}`);
    if (htmlEntry) {
      console.log(`HTML entry: ${htmlEntry}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
