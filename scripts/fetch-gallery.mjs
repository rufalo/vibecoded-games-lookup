#!/usr/bin/env node
// Builds a screenshot gallery per game: docs/media/gallery/<id>/NN.jpg plus NN-t.jpg thumbnails,
// recorded in games.json as `gallery: [{ src, thumb, w, h, source }]`.
//
// Candidate order (first sources win):
//   1. game.galleryCandidates, hand-picked. Each entry is one of:
//        https://…/image.jpg          a direct image URL
//        youtube:<videoId>            three auto-generated HD frames of a (gameplay) video
//        screenshot:<pageUrl>[|ms]    a live headless-Edge screenshot (optional wait in ms)
//        readme:<githubRepoUrl>       every image in that repo's README
//   If game.galleryAuto === false, only these are used (fully curated). Otherwise discovery continues:
//   2. Steam store screenshots (links.steam / playUrl app id)
//   3. images on game.galleryPages, links.devlog, links.creatorPost, links.itch, playUrl
//   4. images in the GitHub README (links.github)
//   5. auto-generated YouTube frames of links.video (maxres1-3)
//   6. only with --press: images on the game's cited sources (mostly stock photos, so off by default)
// Filters: real image bytes, >= 560x300, landscape-ish (aspect 1.1–2.5), no icons/logos/avatars,
// near-duplicates (8x8 average hash) dropped, including duplicates of the cover image.
// Curate with game.galleryExclude: [source URLs to skip]. Existing galleries are kept unless --force.
// ALWAYS review the result visually: scraped pages also contain "related posts" and stock images.
//
// Usage: node scripts/fetch-gallery.mjs [--force] [--press] [--max 8] [id ...]

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DOCS = join(ROOT, 'docs');
const DATA = join(DOCS, 'data', 'games.json');
const PROC = join(ROOT, 'scripts', 'process-images.ps1');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const args = process.argv.slice(2);
const force = args.includes('--force');
const press = args.includes('--press');
const SHOT = join(ROOT, 'scripts', 'screenshot.ps1');
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 8;
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--max');

const games = JSON.parse(readFileSync(DATA, 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'vgl-gallery-'));

const SKIP_PAGE = /(^|\.)(x\.com|twitter\.com|linkedin\.com|reddit\.com|facebook\.com|instagram\.com|threads\.net|tiktok\.com)$/;
const SKIP_IMG = /(avatar|logo|icon|favicon|badge|emoji|gravatar|profile|author|headshot|sprite|placeholder|spinner|pixel|tracking|1x1|banner-ad|\/ads?\/|shields\.io|\.svg(\?|$)|opengraph\.githubassets|wp-content\/plugins)/i;

async function get(url, { asText = false } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: asText ? 'text/html,*/*' : 'image/jpeg,image/png,image/gif,image/*;q=0.8,*/*;q=0.5' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (asText) {
    const type = res.headers.get('content-type') || '';
    if (!/html|text|markdown|plain|json/.test(type)) throw new Error(`not text (${type})`);
    return (await res.text()).slice(0, 3_000_000);
  }
  return Buffer.from(await res.arrayBuffer());
}

const attrsOf = (tag) => {
  const a = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) a[m[1].toLowerCase()] = (m[3] ?? m[4]).replace(/&amp;/g, '&');
  return a;
};
const abs = (u, base) => { try { return new URL(u.trim(), base).href; } catch { return null; } };

function imagesInHtml(html, base) {
  const out = [];
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    if ((+a.width && +a.width < 300) || (+a.height && +a.height < 170)) continue;
    let src = null;
    const srcset = a.srcset || a['data-srcset'];
    if (srcset) {
      let best = -1;
      for (const part of srcset.split(/,\s+(?=\S)/)) {
        const [u, d] = part.trim().split(/\s+/);
        const n = parseFloat(d) || 1;
        if (n > best) { best = n; src = u; }
      }
    }
    src ||= a['data-src'] || a['data-original'] || a['data-lazy-src'] || a.src;
    if (src && !src.startsWith('data:')) out.push(abs(src, base));
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    if (/^(og:image|twitter:image)/i.test(a.property || a.name || '') && a.content) out.push(abs(a.content, base));
  }
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+\.(?:jpe?g|png)(?:\?[^"']*)?)["']/gi)) out.push(abs(m[1], base));
  return out.filter(Boolean);
}

async function readmeImages(githubUrl) {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(githubUrl || '');
  if (!m) return [];
  const base = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/HEAD/`;
  try {
    const md = await get(base + 'README.md', { asText: true });
    return [
      ...[...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)].map((x) => x[1]),
      ...[...md.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((x) => x[1]),
    ].map((u) => abs(u, base)).filter(Boolean);
  } catch { return []; }
}

async function steamShots(g) {
  const m = /store\.steampowered\.com\/app\/(\d+)/.exec(g.links?.steam || g.playUrl || '');
  if (!m) return [];
  try {
    const j = JSON.parse(await get(`https://store.steampowered.com/api/appdetails?appids=${m[1]}`, { asText: true }));
    return (j[m[1]]?.data?.screenshots || []).map((s) => s.path_full);
  } catch { return []; }
}

const youtubeFrames = (url) => {
  const m = /(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/.exec(url || '');
  return m ? [1, 2, 3].map((n) => `https://img.youtube.com/vi/${m[1]}/maxres${n}.jpg`) : [];
};

function sniff(buf) {
  const ascii = (a, b) => buf.toString('latin1', a, b);
  if (buf.length < 32) return null;
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (ascii(0, 4) === 'GIF8') return { type: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const mk = buf[i + 1];
      if (mk === 0xff) { i++; continue; }
      if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { type: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const c = ascii(12, 16);
    if (c === 'VP8 ') return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (c === 'VP8L') { const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]]; return { type: 'webp', w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
    if (c === 'VP8X') return { type: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

const okSize = (s) => s && s.w >= 560 && s.h >= 300 && s.w / s.h >= 1.1 && s.w / s.h <= 2.5;
const hamming = (a, b) => { let x = BigInt('0x' + a) ^ BigInt('0x' + b); let n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

function processBatch(items) {
  if (!items.length) return [];
  const manifest = join(work, `manifest-${Date.now()}.json`);
  writeFileSync(manifest, JSON.stringify(items));
  const out = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROC, '-Manifest', manifest], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const parsed = JSON.parse(out.trim() || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function pool(list, n, fn) {
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < list.length) { const i = next++; results[i] = await fn(list[i], i); } }));
  return results;
}

async function candidatesFor(g) {
  const seen = new Set();
  const list = [];
  const exclude = new Set(g.galleryExclude || []);
  const push = (urls, origin) => {
    for (const u of urls) {
      if (!u || seen.has(u) || exclude.has(u) || u === g.imageSource || SKIP_IMG.test(u)) continue;
      seen.add(u);
      list.push({ url: u, origin });
    }
  };
  for (const c of g.galleryCandidates || []) {
    if (c.startsWith('youtube:')) push(youtubeFrames(`https://youtu.be/${c.slice(8)}`), 'video');
    else if (c.startsWith('readme:')) push(await readmeImages(c.slice(7)), 'repo');
    else if (c.startsWith('screenshot:')) { if (!seen.has(c)) { seen.add(c); list.push({ url: c, origin: 'live' }); } }
    else push([c], 'picked');
  }
  if (g.galleryAuto === false) return list;
  push(await steamShots(g), 'steam');
  const own = [...(g.galleryPages || []), g.links?.devlog, g.links?.creatorPost, g.links?.itch, g.status === 'steam' ? null : g.playUrl];
  for (const page of own) {
    if (!page || SKIP_PAGE.test(new URL(page).hostname) || /github\.com/.test(page)) continue;
    try { push(imagesInHtml(await get(page, { asText: true }), page), 'creator'); } catch {}
  }
  push(await readmeImages(g.links?.github), 'repo');
  push(youtubeFrames(g.links?.video), 'video');
  if (!press) return list;
  const pages = (g.sources || []).map((s) => s.url).filter((u) => u && !own.includes(u) && !/github\.com|store\.steampowered|youtube\.com|youtu\.be/.test(u));
  for (const page of pages) {
    try { if (SKIP_PAGE.test(new URL(page).hostname)) continue; push(imagesInHtml(await get(page, { asText: true }), page), 'press'); } catch {}
  }
  return list;
}

let total = 0;
for (const g of games) {
  if (only.length && !only.includes(g.id)) continue;
  if (g.gallery?.length && !force) continue;

  const cands = (await candidatesFor(g)).slice(0, 60);
  const dir = join(work, g.id);
  mkdirSync(dir, { recursive: true });

  // Download + size filter (parallel), keep candidate order.
  const liveShot = (spec, i) => {
    const [url, ms] = spec.slice('screenshot:'.length).split('|');
    const png = join(dir, `live-${i}.png`);
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SHOT, '-Url', url, '-Out', png, '-WaitMs', String(ms || 15000), '-ColorScheme', 'dark'], { stdio: 'pipe' });
    return readFileSync(png);
  };
  const downloaded = (await pool(cands, 6, async (c, i) => {
    try {
      const buf = c.origin === 'live' ? liveShot(c.url, i) : await get(c.url);
      const s = sniff(buf);
      if (!okSize(s) || buf.length < 15000) return null;
      const file = join(dir, `${String(i).padStart(3, '0')}.${s.type}`);
      writeFileSync(file, buf);
      return { ...c, ...s, file, sha: createHash('sha1').update(buf).digest('hex') };
    } catch { return null; }
  })).filter(Boolean);

  // Exact duplicates first, then resize + hash.
  const shas = new Set();
  const uniq = downloaded.filter((d) => (shas.has(d.sha) ? false : shas.add(d.sha))).slice(0, MAX * 3);
  const items = uniq.map((d) => ({ in: d.file, out: d.file + '.full.jpg', thumb: d.file + '.thumb.jpg' }));
  const coverPath = g.image && /\.jpe?g$/.test(g.image) ? join(DOCS, g.image) : null;
  if (coverPath && existsSync(coverPath)) items.push({ in: coverPath, out: null, thumb: null });
  const results = Object.fromEntries(processBatch(items).map((r) => [r.in, r]));
  const coverHash = coverPath ? results[coverPath]?.hash : null;

  const kept = [];
  for (const d of uniq) {
    if (kept.length >= MAX) break;
    const r = results[d.file];
    if (!r?.ok) continue;
    if (coverHash && hamming(r.hash, coverHash) <= 6) continue;
    if (kept.some((k) => k.hash && hamming(k.hash, r.hash) <= 6)) continue;
    kept.push({ ...d, full: d.file + '.full.jpg', thumb: d.file + '.thumb.jpg', hash: r.hash });
  }

  const outDir = join(DOCS, 'media', 'gallery', g.id);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  g.gallery = kept.map((k, i) => {
    const n = String(i + 1).padStart(2, '0');
    copyFileSync(k.full, join(outDir, `${n}.jpg`));
    copyFileSync(k.thumb, join(outDir, `${n}-t.jpg`));
    return { src: `media/gallery/${g.id}/${n}.jpg`, thumb: `media/gallery/${g.id}/${n}-t.jpg`, w: k.w, h: k.h, source: k.url.replace(/^screenshot:/, '').split('|')[0], origin: k.origin };
  });
  if (!g.gallery.length) rmSync(outDir, { recursive: true, force: true });
  total += g.gallery.length;
  const by = g.gallery.reduce((m, x) => ((m[x.origin] = (m[x.origin] || 0) + 1), m), {});
  console.log(`${String(g.gallery.length).padStart(2)} imgs  ${g.id.padEnd(28)} (${cands.length} candidates, ${downloaded.length} big enough) ${JSON.stringify(by)}`);
  writeFileSync(DATA, JSON.stringify(games, null, 2) + '\n', 'utf8'); // save progress per game
}

rmSync(work, { recursive: true, force: true });
console.log(`\n${total} gallery images written.`);
