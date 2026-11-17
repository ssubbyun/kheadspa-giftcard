import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const STITCH_ENDPOINT = 'https://stitch.googleapis.com/mcp';

/**
 * Reads a single key from a dotenv-style file without mutating process.env.
 */
function readEnvKey(filePath, keyName) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (key !== keyName) continue;
    return line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return '';
}

/**
 * Loads STITCH_API_KEY from process.env, secrets/stitch.env, or .env.local.
 */
export function loadStitchApiKey(rootDir = process.cwd()) {
  const fromEnv = (process.env.STITCH_API_KEY || '').trim();
  if (fromEnv) return fromEnv;

  const candidateFiles = [
    path.join(rootDir, 'secrets', 'stitch.env'),
    path.join(rootDir, '.env.local'),
  ];

  for (const filePath of candidateFiles) {
    const value = readEnvKey(filePath, 'STITCH_API_KEY');
    if (value) return value;
  }

  throw new Error(
    'STITCH_API_KEY is missing. Set it in secrets/stitch.env or STITCH_API_KEY env var.'
  );
}

/**
 * Extracts and parses the first MCP text content payload from a JSON-RPC response.
 */
export function extractMcpPayload(rpcResponse) {
  if (rpcResponse?.error) {
    const code = rpcResponse.error.code ?? 'UNKNOWN';
    const message = rpcResponse.error.message || 'Stitch MCP JSON-RPC error';
    throw new Error(`Stitch MCP error (${code}): ${message}`);
  }

  const text = rpcResponse?.result?.content?.[0]?.text ?? '';
  if (rpcResponse?.result?.isError) {
    throw new Error(`Stitch tool failed: ${text || 'Unknown tool error'}`);
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

/**
 * Executes a JSON-RPC 2.0 tools/call request against the Google Stitch MCP server.
 */
export function callStitchTool(name, args = {}) {
  const apiKey = loadStitchApiKey();
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name, arguments: args },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      STITCH_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload, 'utf-8'),
          'X-Goog-Api-Key': apiKey,
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `Stitch MCP HTTP ${status}: ${body.slice(0, 300) || 'Empty response'}`
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(
              new Error(
                `Invalid JSON from Stitch MCP: ${err instanceof Error ? err.message : String(err)}`
              )
            );
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function normalizeProjectId(value) {
  return String(value || '')
    .trim()
    .replace(/^projects\//, '');
}

async function runCli() {
  const [command, rawArg] = process.argv.slice(2);

  if (command === 'list-projects') {
    const rpcRes = await callStitchTool('list_projects', { pageSize: 20 });
    const data = extractMcpPayload(rpcRes);
    const projects = Array.isArray(data.projects) ? data.projects : [];
    console.log(`Stitch projects found: ${projects.length}`);
    for (const proj of projects) {
      const id = normalizeProjectId(proj.name);
      const title = proj.title || '(untitled)';
      const device = proj.deviceType || 'UNKNOWN';
      const visibility = proj.visibility || 'UNKNOWN';
      console.log(`- [${id}] ${title} (${device}, ${visibility})`);
    }
    return;
  }

  if (command === 'get-project') {
    const projectId = normalizeProjectId(rawArg);
    if (!projectId) {
      throw new Error('Usage: node scripts/stitch-mcp.mjs get-project <projectId>');
    }
    const rpcRes = await callStitchTool('get_project', {
      name: `projects/${projectId}`,
    });
    const data = extractMcpPayload(rpcRes);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === 'list-screens') {
    const projectId = normalizeProjectId(rawArg);
    if (!projectId) {
      throw new Error('Usage: node scripts/stitch-mcp.mjs list-screens <projectId>');
    }
    const rpcRes = await callStitchTool('list_screens', { projectId });
    const data = extractMcpPayload(rpcRes);
    const screens = Array.isArray(data.screens) ? data.screens : [];
    console.log(`Screens in project ${projectId}: ${screens.length}`);
    for (const screen of screens) {
      const htmlName = screen.htmlCode?.name || screen.html_code?.name || '-';
      console.log(`- ${screen.name || '(unnamed)'} | title=${screen.title || '-'} | html=${htmlName}`);
    }
    return;
  }

  console.error(
    [
      'Usage:',
      '  node scripts/stitch-mcp.mjs list-projects',
      '  node scripts/stitch-mcp.mjs get-project <projectId>',
      '  node scripts/stitch-mcp.mjs list-screens <projectId>',
    ].join('\n')
  );
  process.exit(1);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
