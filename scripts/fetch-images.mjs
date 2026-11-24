#!/usr/bin/env node
// Finds and downloads a cover image for every game in docs/data/games.json that has none.
//
// Candidate order per game:
//   1. game.imageCandidates (direct image URLs; GitHub's generic repo cards are pushed to the end)
//   2. og:image / twitter:image of game.imagePages (articles etc.), playUrl, links.steam, links.itch, links.devlog
//   3. images in the GitHub README (badges skipped)
//   4. YouTube thumbnail of links.video
// Downloads go to a fresh temp folder and are only used if their bytes are a real PNG/JPEG/GIF/WebP/AVIF.
// PNG/JPEG/GIF are re-encoded to <=1280px-wide JPEG by scripts/resize-image.ps1 (Windows System.Drawing);
// WebP/AVIF are copied as-is. The chosen file is written to docs/media/<id>.<ext> and games.json is updated.
//
// Usage: node scripts/fetch-images.mjs [--force] [id ...]

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA = join(ROOT, 'docs', 'data', 'games.json');
const MEDIA = join(ROOT, 'docs', 'media');
const RESIZE = join(ROOT, 'scripts', 'resize-image.ps1');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

const games = JSON.parse(readFileSync(DATA, 'utf8'));
mkdirSync(MEDIA, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'vgl-images-'));

async function get(url, { asText = false } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: asText ? 'text/html,*/*' : 'image/avif,image/webp,image/*,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (asText) {
    const type = res.headers.get('content-type') || '';
    if (!/html|text|markdown|plain/.test(type)) throw new Error(`not text (${type})`);
    return (await res.text()).slice(0, 2_000_000);
  }
  return Buffer.from(await res.arrayBuffer());
}

function metaImages(html, base) {
  const out = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[3] ?? m[4];
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (/^(og:image(:secure_url|:url)?|twitter:image(:src)?)$/.test(key) && attrs.content) {
      try { out.push(new URL(attrs.content.replace(/&amp;/g, '&'), base).href); } catch {}
    }
  }
  return out;
}

async function readmeImages(githubUrl) {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(githubUrl || '');
  if (!m) return [];
  const base = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/HEAD/`;
  let md;
  try { md = await get(base + 'README.md', { asText: true }); } catch { return []; }
  const urls = [
    ...[...md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)].map((x) => x[1]),
    ...[...md.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((x) => x[1]),
  ];
  return urls
    .filter((u) => !/shields\.io|badge|\.svg(\?|$)/i.test(u))
    .map((u) => { try { return new URL(u, base).href; } catch { return null; } })
    .filter(Boolean);
}

function youtubeThumb(url) {
  const m = /(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/.exec(url || '');
  return m ? [`https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`, `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`] : [];
}

function sniff(buf) {
  const ascii = (a, b) => buf.toString('latin1', a, b);
  if (buf.length < 32) return null;
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (ascii(0, 4) === 'GIF8') return { type: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; } // fill byte
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { type: 'jpeg', w: 0, h: 0 };
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const chunk = ascii(12, 16);
    if (chunk === 'VP8 ') return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
      return { type: 'webp', w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8X') return { type: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    return { type: 'webp', w: 0, h: 0 };
  }
  if (ascii(4, 12) === 'ftypavif') return { type: 'avif', w: 0, h: 0 };
  return null;
}

async function candidatesFor(g) {
  const list = [];
  const push = (...urls) => urls.forEach((u) => u && !list.includes(u) && list.push(u));
  const cards = (g.imageCandidates || []).filter((u) => /opengraph\.githubassets\.com/.test(u));
  push(...(g.imageCandidates || []).filter((u) => !cards.includes(u)));
  // imagePages: extra pages (articles, store pages) whose og:image is a good cover for this game.
  for (const page of [...(g.imagePages || []), g.playUrl, g.links?.steam, g.links?.itch, g.links?.devlog]) {
    if (!page || /github\.com/.test(page)) continue;
    try { push(...metaImages(await get(page, { asText: true }), page)); } catch {}
  }
  push(...(await readmeImages(g.links?.github)));
  push(...youtubeThumb(g.links?.video));
  push(...cards);
  return list;
}

const good = (s) => s.w >= 600 && s.w / Math.max(1, s.h) >= 1.2 && s.w / Math.max(1, s.h) <= 2.6;

let changed = 0;
const missing = [];
for (const g of games) {
  if (only.length && !only.includes(g.id)) continue;
  if (g.image && !force && existsSync(join(ROOT, 'docs', g.image))) continue;

  const cands = await candidatesFor(g);
  let pick = null;
  let fallback = null;
  for (const url of cands.slice(0, 10)) {
    try {
      const buf = await get(url);
      const s = sniff(buf);
      if (!s || buf.length < 8000) continue;
      const entry = { url, buf, ...s };
      if (good(s) || s.type === 'avif') { pick = entry; break; }
      if (s.w >= 300 && (!fallback || s.w * s.h > fallback.w * fallback.h)) fallback = entry;
    } catch {}
  }
  pick ||= fallback;
  if (!pick) { missing.push(g.id); console.log(`--  ${g.id}: no usable image (${cands.length} candidates)`); continue; }

  let rel;
  if (pick.type === 'webp' || pick.type === 'avif') {
    rel = `media/${g.id}.${pick.type}`;
    writeFileSync(join(ROOT, 'docs', rel), pick.buf);
  } else {
    const raw = join(work, `${g.id}.${pick.type}`);
    writeFileSync(raw, pick.buf);
    rel = `media/${g.id}.jpg`;
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', RESIZE, '-In', raw, '-Out', join(ROOT, 'docs', rel)], { stdio: 'pipe' });
  }
  g.image = rel;
  g.imageSource = pick.url;
  changed++;
  console.log(`ok  ${g.id}: ${pick.type} ${pick.w}x${pick.h} <- ${pick.url}`);
}

rmSync(work, { recursive: true, force: true });
if (changed) writeFileSync(DATA, JSON.stringify(games, null, 2) + '\n', 'utf8');
console.log(`\n${changed} image(s) updated.${missing.length ? ' Still missing: ' + missing.join(', ') : ''}`);
