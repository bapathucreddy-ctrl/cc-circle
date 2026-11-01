/**
 * CC Circle BTS Reel Generator
 * Single-page approach: serves render-reels.html which records itself.
 * Uses Chrome's --remote-debugging-port + CDP to inject JS and drive recording.
 */
const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const net  = require('node:net');

const rootDir  = path.resolve(__dirname, '..');
const reelsDir = path.join(rootDir, 'reels');
const ffmpegExe = path.join(rootDir, '.local-tools', 'ffmpeg-extracted',
  'ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe');

fs.mkdirSync(reelsDir, { recursive: true });

const DURATION_MS      = 18500; // 18 seconds per reel + 500ms buffer
const TOTAL_CAMPAIGNS  = 3;
const SERVER_PORT      = 9877;
const CAMPAIGNS = [
  'reel-1-3d-gps-tracking',
  'reel-2-booking-payments',
  'reel-3-marketplace',
];

let completedCount = 0;
let chromeProcess;

// ── ffmpeg conversion ────────────────────────────────────────────────────────
function convertToMp4(webmPath, mp4Path) {
  console.log(`\n[ffmpeg] Converting ${path.basename(webmPath)} → MP4...`);
  try {
    execFileSync(ffmpegExe, [
      '-y', '-i', webmPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      mp4Path
    ], { stdio: 'inherit' });
    const sizeMb = (fs.statSync(mp4Path).size / 1024 / 1024).toFixed(1);
    console.log(`[ffmpeg] ✅ ${path.basename(mp4Path)} — ${sizeMb} MB`);
    fs.unlinkSync(webmPath);
    return true;
  } catch(e) {
    console.error('[ffmpeg] ❌ Error:', e.message);
    return false;
  }
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${SERVER_PORT}`);

  // Serve the renderer page
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'render-reels.html'), 'utf8'));
    return;
  }

  // Receive recorded video blobs
  if (url.pathname === '/save-video') {
    const name = url.searchParams.get('name') || `reel-${Date.now()}`;
    const webm = path.join(reelsDir, `${name}.webm`);
    const mp4  = path.join(reelsDir, `${name}.mp4`);
    const out  = fs.createWriteStream(webm);
    req.pipe(out);
    req.on('end', () => {
      const mb = (fs.statSync(webm).size / 1024 / 1024).toFixed(2);
      console.log(`[Studio] ✅ Received ${name}.webm (${mb} MB)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      convertToMp4(webm, mp4);
      completedCount++;

      if (completedCount >= TOTAL_CAMPAIGNS) {
        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║  🎬  All 3 BTS Reels Generated!           ║');
        console.log('╚══════════════════════════════════════════╝');
        fs.readdirSync(reelsDir).filter(f=>f.endsWith('.mp4')).forEach(f=>{
          const mb = (fs.statSync(path.join(reelsDir,f)).size/1024/1024).toFixed(1);
          console.log(`  📹  ${f}  —  ${mb} MB`);
        });
        console.log(`\nFolder: ${reelsDir}\n`);
        setTimeout(() => {
          try { chromeProcess.kill(); } catch(_) {}
          server.close();
          process.exit(0);
        }, 800);
      }
    });
    req.on('error', err => { console.error('[Studio] Upload error:', err.message); res.writeHead(500); res.end(); });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(SERVER_PORT, async () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  CC Circle BTS Reel Studio v2                     ║');
  console.log('║  MacBook VS Code  +  iOS Simulator  split-screen  ║');
  console.log('║  18 sec  ·  1080×1920  ·  9:16  ·  MP4 output   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(ffmpegExe)) {
    console.error('❌ ffmpeg not found at:\n ' + ffmpegExe); process.exit(1);
  }
  console.log('✅ ffmpeg ready');

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const browserPath = chromePaths.find(p => fs.existsSync(p));
  if (!browserPath) { console.error('❌ Chrome/Edge not found.'); process.exit(1); }
  console.log('✅ Browser:', path.basename(path.dirname(browserPath)));

  // Launch Chrome headless with remote debugging
  const CDP_PORT = 9229;
  console.log('\n🚀 Launching headless browser...');
  chromeProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${CDP_PORT}`,
    '--autoplay-policy=no-user-gesture-required',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--window-size=1200,2200',
    `http://localhost:${SERVER_PORT}/`
  ], { stdio: ['ignore','ignore','pipe'] });

  chromeProcess.stderr && chromeProcess.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('ERROR') || s.includes('DevTools')) process.stdout.write('[Chrome] ' + s);
  });
  chromeProcess.on('error', err => { console.error('Chrome error:', err.message); process.exit(1); });

  // Wait for Chrome's DevTools to be ready, then drive it via CDP
  await new Promise(r => setTimeout(r, 4000));
  console.log('⏳ Page loading... waiting 2 more seconds...');
  await new Promise(r => setTimeout(r, 2000));

  await driveCDP(CDP_PORT);
});

// ── CDP (Chrome DevTools Protocol) driver ────────────────────────────────────
async function driveCDP(port) {
  // Get list of pages
  const pages = await fetchJson(`http://localhost:${port}/json`);
  const page = pages.find(p => p.type === 'page');
  if (!page) { console.error('No CDP page found'); return; }

  const ws = require('net'); // we'll use raw HTTP evaluate via /json/runtime instead
  // Actually use CDP evaluate via HTTP long poll isn't standard.
  // Use the simpler approach: inject via the renderer page's fetch

  // Instead, use the /json/evaluate approach via a second chrome instance or
  // use the built-in approach: serve an auto-run script from the HTML itself.

  // The render-reels.html already has window.startRecording.
  // We need to CALL it. The cleanest way without puppeteer:
  // → Serve a second page that iframes the renderer + drives it.

  console.log('🎬 Driving recording via CDP...');
  await cdpEvaluate(port, page.id, buildOrchestratorScript());
}

function buildOrchestratorScript() {
  const serverPort = SERVER_PORT;
  const durationMs = DURATION_MS;
  const campaigns = JSON.stringify(CAMPAIGNS);

  return `
(async function() {
  const DURATION = ${durationMs};
  const names = ${campaigns};
  console.log('[Orchestrator] Starting', names.length, 'campaigns');

  for (let i = 0; i < names.length; i++) {
    console.log('[Orchestrator] Recording campaign', i, names[i]);
    document.getElementById('status').textContent = 'Recording ' + names[i] + '...';

    let dataUrl;
    try {
      dataUrl = await window.startRecording(i, DURATION);
    } catch(e) {
      console.error('[Orchestrator] Recording error:', e);
      continue;
    }

    console.log('[Orchestrator] Uploading', names[i], '...');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    const blob = new Blob([bytes], { type: 'video/webm' });

    try {
      const resp = await fetch('http://localhost:${serverPort}/save-video?name=' + names[i], {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'video/webm' }
      });
      const json = await resp.json();
      console.log('[Orchestrator] Saved:', names[i], json);
    } catch(e) {
      console.error('[Orchestrator] Upload error:', e);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  document.getElementById('status').textContent = 'All done!';
  console.log('[Orchestrator] All campaigns recorded.');
})();
`;
}

// ── Simple CDP evaluate via WebSocket ────────────────────────────────────────
async function cdpEvaluate(port, pageId, script) {
  return new Promise(async (resolve, reject) => {
    const info = await fetchJson(`http://localhost:${port}/json/${pageId}`).catch(()=>null) ||
                 (await fetchJson(`http://localhost:${port}/json`)).find(p=>p.type==='page');

    if (!info || !info.webSocketDebuggerUrl) {
      console.error('No webSocketDebuggerUrl found, trying fallback...');
      // Fallback: load a data URL page that contains the script
      return;
    }

    const wsUrl = info.webSocketDebuggerUrl;
    console.log('CDP WebSocket:', wsUrl);

    // Use Node's built-in net + http upgrade for WebSocket
    const url = new URL(wsUrl);
    const msgId = 1;

    const client = require('net').createConnection({ host: url.hostname, port: parseInt(url.port) || 80 }, () => {
      const key = Buffer.from(Math.random().toString(36)).toString('base64');
      const handshake = [
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.hostname}:${url.port}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${key}`,
        `Sec-WebSocket-Version: 13`,
        `\r\n`
      ].join('\r\n');
      client.write(handshake);
    });

    let buffer = Buffer.alloc(0);
    let upgraded = false;

    client.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!upgraded) {
        const head = buffer.toString('utf8');
        if (head.includes('\r\n\r\n')) {
          upgraded = true;
          buffer = buffer.slice(buffer.indexOf('\r\n\r\n') + 4);
          // Send Runtime.evaluate
          const payload = JSON.stringify({
            id: msgId,
            method: 'Runtime.evaluate',
            params: { expression: script, awaitPromise: true, timeout: (DURATION_MS + 5000) * TOTAL_CAMPAIGNS }
          });
          sendWsFrame(client, payload);
          console.log('[CDP] Sent evaluation script to page');
        }
        return;
      }

      // Parse WS frame
      try {
        const result = parseWsFrame(buffer);
        if (result) {
          const msg = JSON.parse(result.payload.toString('utf8'));
          if (msg.id === msgId) {
            console.log('[CDP] Script completed:', JSON.stringify(msg.result || msg.error).slice(0,200));
            client.destroy();
            resolve(msg);
          }
        }
      } catch(e) { /* incomplete frame, wait for more data */ }
    });

    client.on('error', err => { console.error('[CDP WS] Error:', err.message); reject(err); });
    client.on('close', () => resolve());
  });
}

function sendWsFrame(socket, text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  const mask = Buffer.from([Math.random()*256, Math.random()*256, Math.random()*256, Math.random()*256].map(Math.floor));
  let header;
  if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0]=0x81; header[1]=0xFE; header.writeUInt16BE(len,2); }
  else { header = Buffer.alloc(10); header[0]=0x81; header[1]=0xFF; header.writeBigUInt64BE(BigInt(len),2); }
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  socket.write(Buffer.concat([header, mask, masked]));
}

function parseWsFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); offset = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
  if (buf.length < offset + len) return null;
  return { payload: buf.slice(offset, offset + len), opcode };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}
