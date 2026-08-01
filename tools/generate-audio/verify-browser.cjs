#!/usr/bin/env node
/**
 * verify-browser.cjs — prove every generated file actually decodes in a real
 * browser engine, not just in theory.
 *
 *   node tools/generate-audio/verify-browser.cjs [--port 3100] [--keep-page]
 *
 * WHY THIS EXISTS
 * ---------------
 * The bug this whole task started from ("Unable to decode audio data") was
 * never visible from Node: the WAV headers were valid, the files were fine, and
 * the failure only appeared when Phaser asked a browser to decode a URL that
 * silently returned HTML. So the only verification that means anything is a
 * real `AudioContext.decodeAudioData` against the real dev server.
 *
 * It fetches every asset in assets/audio/MANIFEST.json exactly as the game
 * does, decodes it, and compares the decoded duration / sample rate / channel
 * count against what the generator recorded. It also probes both URLs Phaser
 * would consider for each music key, so a regression back to "the .ogg is
 * missing and Vite hands back index.html" fails loudly here.
 *
 * Requires a dev server already running on the given port
 * (`npx vite --port 3100 --strictPort`).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const PAGE_NAME = '.decode-test.html';
const PAGE_PATH = path.join(AUDIO_DIR, PAGE_NAME);

const argv = process.argv.slice(2);
const portIdx = argv.indexOf('--port');
const PORT = portIdx >= 0 ? argv[portIdx + 1] : '3100';
const KEEP = argv.includes('--keep-page');

// ---------------------------------------------------------------------------
// Locate a Chromium binary
// ---------------------------------------------------------------------------

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const pwCache = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(pwCache)) {
    for (const d of fs.readdirSync(pwCache).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
      candidates.push(path.join(pwCache, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
      candidates.push(path.join(pwCache, d, 'chrome-linux', 'chrome'));
    }
  }
  return candidates.find((c) => c && fs.existsSync(c)) || null;
}

// ---------------------------------------------------------------------------
// The test page (same-origin with the dev server, so fetch just works)
// ---------------------------------------------------------------------------

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>decode-test</title>
<pre id="out">PENDING</pre>
<script>
(async () => {
  const results = [];
  const push = (r) => results.push(r);
  try {
    const manifest = await (await fetch('/audio/MANIFEST.json', { cache: 'no-store' })).json();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    for (const a of manifest.assets) {
      // Serve path: publicDir is assets/, so assets/audio/x -> /audio/x
      const url = '/' + a.file.replace(/^assets\\//, '');
      const rec = { key: a.key, url, expectedSec: a.durationSec, expectedSr: a.sampleRate, expectedCh: a.channels };
      try {
        const res = await fetch(url, { cache: 'no-store' });
        rec.status = res.status;
        rec.contentType = res.headers.get('content-type');
        const buf = await res.arrayBuffer();
        rec.bytes = buf.byteLength;
        // The exact failure mode we are guarding against: an HTML fallback body
        // returned with HTTP 200 for a URL that has no file behind it.
        const head = new Uint8Array(buf.slice(0, 5));
        rec.looksLikeHtml = String.fromCharCode(...head).toLowerCase().startsWith('<!doc');
        const audio = await ctx.decodeAudioData(buf.slice(0));
        rec.decoded = true;
        rec.actualSec = +audio.duration.toFixed(3);
        rec.actualSr = audio.sampleRate;
        rec.actualCh = audio.numberOfChannels;
        // Opus always decodes at 48 kHz and adds encoder padding, so compare
        // duration with a tolerance rather than demanding an exact match.
        rec.durationOk = Math.abs(audio.duration - a.durationSec) < 0.12;
      } catch (e) {
        rec.decoded = false;
        rec.error = String(e && e.message || e);
      }
      push(rec);
    }

    // Extra probe: both URLs Phaser would consider for each music key.
    const probes = [];
    for (const a of manifest.assets.filter((x) => x.group === 'music')) {
      for (const ext of ['ogg', 'wav']) {
        const u = '/audio/music/' + a.key + '.' + ext;
        try {
          const r = await fetch(u, { cache: 'no-store' });
          const b = await r.arrayBuffer();
          const h = String.fromCharCode(...new Uint8Array(b.slice(0, 5))).toLowerCase();
          probes.push({ url: u, status: r.status, type: r.headers.get('content-type'), bytes: b.byteLength, html: h.startsWith('<!doc') });
        } catch (e) { probes.push({ url: u, error: String(e) }); }
      }
    }
    document.getElementById('out').textContent = JSON.stringify({ ok: true, results, probes }, null, 1);
  } catch (e) {
    document.getElementById('out').textContent = JSON.stringify({ ok: false, fatal: String(e && e.stack || e), results }, null, 1);
  }
  document.title = 'DONE';
})();
</script>
`;

// ---------------------------------------------------------------------------

const chrome = findChrome();
if (!chrome) {
  console.error('ERROR: no Chrome/Chromium binary found.');
  process.exit(1);
}

if (!fs.existsSync(path.join(AUDIO_DIR, 'MANIFEST.json'))) {
  console.error('ERROR: assets/audio/MANIFEST.json missing — run generate-all.cjs first.');
  process.exit(1);
}

// Confirm the dev server is up before spending time in the browser.
try {
  execFileSync('curl', ['-sf', '-o', '/dev/null', `http://localhost:${PORT}/audio/MANIFEST.json`]);
} catch {
  console.error(`ERROR: no dev server responding on http://localhost:${PORT}`);
  console.error(`       start one with:  npx vite --port ${PORT} --strictPort`);
  process.exit(1);
}

fs.writeFileSync(PAGE_PATH, PAGE);
console.log(`chrome: ${chrome}`);
console.log(`page:   http://localhost:${PORT}/audio/${PAGE_NAME}\n`);

/**
 * Drive Chrome over the DevTools protocol rather than `--dump-dom`.
 *
 * --virtual-time-budget cannot be used here: Web Audio decoding runs off the
 * virtual clock, so virtual time races to the end of its budget and the page is
 * dumped while every decodeAudioData is still pending. Polling a real page over
 * CDP waits for the real work to finish.
 */
async function withChrome(url, fn) {
  const os = require('os');
  const debugPort = 9333 + Math.floor(process.hrtime()[1] % 500);
  const child = require('child_process').spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'melaka-audio-')),
    `--remote-debugging-port=${debugPort}`,
    url,
  ], { stdio: 'ignore', detached: false });

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  try {
    // Wait for the DevTools endpoint and find the page target.
    let target = null;
    for (let i = 0; i < 100 && !target; i++) {
      await sleep(200);
      try {
        const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch { /* not up yet */ }
    }
    if (!target) throw new Error('Chrome DevTools endpoint never became available');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket error')); });
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method) events.push(msg);
    };
    const send = (method, params) => new Promise((res) => {
      const myId = ++id;
      pending.set(myId, res);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
      return r.result?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');

    const result = await fn({ send, evaluate, events, sleep });
    ws.close();
    return result;
  } finally {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

/** Phase 1: fetch + decode every manifest asset. */
function decodeAllAssets(url) {
  return withChrome(url, async ({ evaluate, sleep }) => {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      await sleep(500);
      const text = await evaluate("(document.title === 'DONE' && document.getElementById('out')) ? document.getElementById('out').textContent : null");
      if (text) return text;
    }
    throw new Error('decode-test page never signalled DONE within 240s');
  });
}

/**
 * Phase 2: boot the real game and watch the real console.
 *
 * Phase 1 proves the files decode; this proves *Phaser* loads them — that its
 * format probe picks a URL that exists, and that BootScene's loader emits no
 * decode errors for our keys.
 */
function bootGame(url, seconds = 30) {
  return withChrome(url, async ({ send, evaluate, events, sleep }) => {
    // Phaser is bundled as an ESM module, so there is no `window.Phaser` and no
    // global game handle to introspect. Watching the network is both more
    // robust and closer to the question that matters: did the running game
    // request our audio URLs, and did any of them come back wrong?
    await send('Network.enable');

    // The app opens on a React title screen; Phaser (and therefore BootScene's
    // loadAudio) only mounts once a game is started. Click "New Game".
    let clicked = false;
    for (let i = 0; i < 30 && !clicked; i++) {
      await sleep(500);
      clicked = await evaluate(
        "(() => { const b = [...document.querySelectorAll('button')]"
        + ".find(x => /new game/i.test(x.textContent || '')); if (!b) return false; b.click(); return true; })()",
      ).catch(() => false);
    }
    if (!clicked) console.log('  (warning: could not find the "New Game" button)');

    const start = Date.now();
    let quietFor = 0, lastCount = 0;
    while (Date.now() - start < seconds * 1000) {
      await sleep(1000);
      const n = events.filter((e) => e.method === 'Network.responseReceived').length;
      // stop early once the loader has been idle for 6 s
      quietFor = n === lastCount ? quietFor + 1 : 0;
      lastCount = n;
      if (quietFor >= 6 && n > 0) break;
    }
    const audioReqs = new Map();
    for (const e of events) {
      if (e.method === 'Network.responseReceived' && /\/audio\//.test(e.params.response.url)) {
        audioReqs.set(e.params.response.url, {
          url: e.params.response.url,
          status: e.params.response.status,
          mime: e.params.response.mimeType,
        });
      }
      if (e.method === 'Network.loadingFailed') {
        audioReqs.set(`failed:${e.params.requestId}`, { url: '(failed)', status: 0, mime: e.params.errorText });
      }
    }
    const audioKeys = [...audioReqs.values()];
    const messages = [];
    for (const e of events) {
      if (e.method === 'Runtime.consoleAPICalled') {
        messages.push({ level: e.params.type, text: (e.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ') });
      } else if (e.method === 'Log.entryAdded') {
        messages.push({ level: e.params.entry.level, text: e.params.entry.text });
      } else if (e.method === 'Runtime.exceptionThrown') {
        messages.push({ level: 'exception', text: e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text });
      }
    }
    return { audioRequests: audioKeys, messages };
  });
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });

async function main() {
let text;
try {
  text = await decodeAllAssets(`http://localhost:${PORT}/audio/${PAGE_NAME}`);
} finally {
  if (!KEEP && fs.existsSync(PAGE_PATH)) fs.unlinkSync(PAGE_PATH);
}

const data = JSON.parse(text);
if (!data.ok) {
  console.error('FATAL in page:', data.fatal);
  process.exit(1);
}

let fail = 0;
console.log('key                  status ct                    decoded  dur(exp/act)      sr     ch');
for (const r of data.results) {
  const bad = !r.decoded || r.looksLikeHtml || !r.durationOk;
  if (bad) fail++;
  console.log(
    r.key.padEnd(20),
    String(r.status).padStart(4),
    String(r.contentType || '-').padEnd(22),
    (r.decoded ? 'yes' : 'NO ').padEnd(7),
    `${r.expectedSec}/${r.actualSec ?? '-'}`.padEnd(17),
    String(r.actualSr ?? '-').padStart(6),
    String(r.actualCh ?? '-').padStart(4),
    bad ? `  <-- ${r.error || (r.looksLikeHtml ? 'HTML FALLBACK' : 'duration mismatch')}` : '',
  );
}

console.log('\nPhaser URL probes (both candidates per music key):');
for (const p of data.probes) {
  console.log(`  ${p.url.padEnd(42)} ${String(p.status).padStart(4)}  ${String(p.type || '-').padEnd(22)} ${String(p.bytes).padStart(9)}B${p.html ? '  <-- HTML FALLBACK' : ''}`);
}

const htmlFallbacks = data.probes.filter((p) => p.html && p.url.endsWith('.ogg'));
if (htmlFallbacks.length) {
  console.error(`\nFAIL: ${htmlFallbacks.length} .ogg URL(s) still resolve to the SPA HTML fallback.`);
  fail += htmlFallbacks.length;
}

// --- phase 2: boot the actual game ----------------------------------------
console.log('\n=== booting the real game and watching the console ===');
const boot = await bootGame(`http://localhost:${PORT}/`, 40);
const manifest = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'MANIFEST.json'), 'utf8'));
const ourKeys = new Set(manifest.assets.map((a) => a.key));

const decodeErrors = boot.messages.filter((m) => /unable to decode|decodeaudiodata|audio.*decode/i.test(m.text));
const loadErrors = boot.messages.filter((m) => /error|failed/i.test(m.text) && /audio|sound|\.ogg|\.wav/i.test(m.text));

const keyOf = (u) => (u.split('/').pop() || '').replace(/\.(ogg|wav|mp3)(\?.*)?$/, '');
const requested = boot.audioRequests.filter((r) => ourKeys.has(keyOf(r.url)));
const requestedKeys = new Set(requested.map((r) => keyOf(r.url)));
const htmlServed = requested.filter((r) => /text\/html/.test(r.mime));
const notOk = requested.filter((r) => r.status !== 200);
const missing = [...ourKeys].filter((k) => !requestedKeys.has(k));

console.log(`  audio URLs the game requested: ${boot.audioRequests.length} (${requestedKeys.size} of our ${ourKeys.size} keys)`);
if (htmlServed.length) {
  console.log('  SERVED AS HTML (the original bug):');
  for (const r of htmlServed) console.log(`    ${r.url}  ${r.status} ${r.mime}`);
  fail += htmlServed.length;
} else {
  console.log('  every requested audio URL returned real audio (no text/html fallbacks)');
}
if (notOk.length) {
  console.log('  non-200 responses:');
  for (const r of notOk) console.log(`    ${r.url}  ${r.status} ${r.mime}`);
  fail += notOk.length;
}
// A key can legitimately go unrequested: BootScene's own load lists are the
// contract. Anything BootScene claims to load but never fetched is a real
// failure; anything it never lists (the transition stings) is a known gap in
// src/, reported rather than failed — this tool does not edit src/.
const bootSrc = fs.readFileSync(path.join(ROOT, 'src', 'phaser', 'scenes', 'BootScene.ts'), 'utf8');
const bootBlock = bootSrc.slice(bootSrc.indexOf('private loadAudio'), bootSrc.indexOf('create()'));
const bootKeys = new Set([...bootBlock.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).filter((k) => ourKeys.has(k)));
const shouldHaveLoaded = missing.filter((k) => bootKeys.has(k));
const notInBootScene = [...ourKeys].filter((k) => !bootKeys.has(k));

if (shouldHaveLoaded.length) {
  console.log(`  FAIL — BootScene loads these but they never got requested: ${shouldHaveLoaded.join(', ')}`);
  fail += shouldHaveLoaded.length;
}
if (notInBootScene.length) {
  console.log(`  note: not referenced by BootScene.loadAudio (needs a src/ change to ship):`);
  console.log(`        ${notInBootScene.join(', ')}`);
}
console.log(`  console messages captured: ${boot.messages.length}`);
if (decodeErrors.length) {
  console.log('  DECODE ERRORS:');
  for (const m of decodeErrors.slice(0, 20)) console.log(`    [${m.level}] ${m.text}`);
  fail += decodeErrors.length;
} else {
  console.log('  no "Unable to decode audio data" / decodeAudioData errors');
}
if (loadErrors.length) {
  console.log('  audio-related load errors:');
  for (const m of loadErrors.slice(0, 20)) console.log(`    [${m.level}] ${m.text}`);
  fail += loadErrors.length;
}


console.log(`\n${data.results.length} assets checked, ${fail} failure(s).`);
process.exit(fail ? 1 : 0);

}
