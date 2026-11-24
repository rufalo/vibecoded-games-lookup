#!/usr/bin/env node
// Zero-dependency static file server for the Vibe-Coded Games field guide.
//
// Serves ../site on 127.0.0.1:8210 (localhost only). Tailscale exposes it to the tailnet with:
//   tailscale serve --bg --http=8210 http://127.0.0.1:8210
//
// Env overrides: PORT, HOST.

import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../docs/', import.meta.url)));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8210);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

async function resolveFile(pathname) {
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const full = resolve(ROOT, '.' + p);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null; // path traversal guard
  try {
    const s = await stat(full);
    if (s.isDirectory()) {
      const index = join(full, 'index.html');
      return { path: index, stat: await stat(index) };
    }
    return s.isFile() ? { path: full, stat: s } : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = await resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const etag = `W/"${file.stat.size.toString(16)}-${Math.floor(file.stat.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': TYPES[extname(file.path).toLowerCase()] || 'application/octet-stream',
    ETag: etag,
    'Last-Modified': file.stat.mtime.toUTCString(),
    // Always revalidate so edits to data/games.json show up on the next reload (304s are cheap).
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  res.writeHead(200, { ...headers, 'Content-Length': file.stat.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file.path)
    .on('error', () => res.destroy())
    .pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use; the server is probably already running.`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT} at http://${HOST}:${PORT}/`);
});
