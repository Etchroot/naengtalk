// Loopback-only preview of these dashboard assets, never the repository or secrets.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/model.js': ['model.js', 'text/javascript'], '/dashboard.js': ['dashboard.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
http.createServer(async (req, res) => {
  const asset = assets[new URL(req.url, 'http://127.0.0.1').pathname];
  if (!asset || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL(asset[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Asset unavailable'); }
}).listen(4187, '127.0.0.1', () => console.log('Dashboard: http://127.0.0.1:4187/'));
