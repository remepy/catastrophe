// Local static server that behaves like S3/CloudFront for QA: no redirects or
// "clean URLs", and the same cache headers as production (bridge spec §4.5).
//   npm run build && npm run serve
//   → http://localhost:3000/games/catastrophe/he/index.html
//
// Add ?bridge=1 to the page URL and this server (not the game) injects a
// stand-in for the app's CyanGameBridge channel. It logs every message in the
// browser console and answers game_ready with a session_start. In the console:
//   qa.pause() · qa.resume() · qa.abort() · qa.messages
// Optional overrides:
//   ?bridge=1&tutorial=0&levels=catastrophe-0007,catastrophe-0008&locale=en-US&reducedMotion=1
const QA_BRIDGE = (q) => `<script>
(() => {
  const q = new URLSearchParams(${JSON.stringify(q)});
  const levelIds = (q.get('levels') || 'catastrophe-0001,catastrophe-0002,catastrophe-0003,catastrophe-0004').split(',');
  const send = (m) => { console.log('%capp → game', 'color:#0a84ff', m); window.cyanBridge.receive(m); };
  window.qa = { messages: [],
    pause: () => send({ type: 'pause' }), resume: () => send({ type: 'resume' }),
    abort: () => send({ type: 'abort', data: { reason: 'qa' } }) };
  window.CyanGameBridge = { postMessage: (raw) => {
    const m = JSON.parse(raw); qa.messages.push(m);
    console.log('%cgame → app', 'color:#30d158', m);
    if (m.type === 'game_ready') setTimeout(() => send({ type: 'session_start', data: {
      protocolVersion: 1, sessionId: 'qa-' + Date.now(), expectedLocale: q.get('locale') || m.data.locale, levelIds,
      reducedMotion: q.get('reducedMotion') === '1', tutorialSeen: q.get('tutorial') === '0' } }), 300);
  } };
})();
</script>`;
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT ?? 3000);
const NO_CACHE = new Set(['index.html', 'translations.json', 'words.json']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    let body = await readFile(file);
    const name = file.split('/').pop();
    if (name === 'index.html' && url.searchParams.get('bridge') === '1') {
      body = body.toString().replace('<head>', '<head>' + QA_BRIDGE(url.search));
    }
    const cache = NO_CACHE.has(name) ? 'no-cache' : 'public, max-age=31536000, immutable';
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`Serving ${ROOT}/ on http://localhost:${PORT}`);
  console.log(`  Hebrew:  http://localhost:${PORT}/games/catastrophe/he/index.html`);
  console.log(`  English: http://localhost:${PORT}/games/catastrophe/en/index.html`);
  console.log(`  Add ?bridge=1 to simulate the app (messages appear in the browser console).`);
});
