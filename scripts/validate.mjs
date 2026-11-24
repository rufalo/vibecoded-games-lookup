#!/usr/bin/env node
// Validates docs/data/*.json: schema, taxonomy values, references and image files.
// Usage: node scripts/validate.mjs        (exit code 1 on errors; warnings don't fail)

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(fileURLToPath(new URL('../docs/', import.meta.url)));
const load = (f) => JSON.parse(readFileSync(join(SITE, 'data', f), 'utf8'));

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

let games, tax, insights, radar;
try {
  games = load('games.json');
  tax = load('taxonomy.json');
  insights = load('insights.json');
  radar = load('radar.json');
} catch (e) {
  console.error('Could not parse data files:', e.message);
  process.exit(1);
}

const isUrl = (u) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);
const inTax = (id, field, value, table, { nullable = false } = {}) => {
  if (value == null) { if (!nullable) err(id, `${field} is missing`); return; }
  if (!(value in table)) err(id, `${field} "${value}" is not in taxonomy.json`);
};
const listInTax = (id, field, list, table, { nonEmpty = false } = {}) => {
  if (!Array.isArray(list)) { err(id, `${field} must be an array`); return; }
  if (nonEmpty && !list.length) err(id, `${field} is empty`);
  for (const v of list) if (!(v in table)) err(id, `${field} value "${v}" is not in taxonomy.json`);
};

const grouped = new Set(tax.genreGroups.flatMap((g) => g.genres));
const ids = new Set();
const ranks = new Map();

if (!Array.isArray(games)) { console.error('games.json must be an array'); process.exit(1); }

for (const g of games) {
  const id = g.id || '(missing id)';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id || '')) err(id, 'id must be kebab-case');
  if (ids.has(g.id)) err(id, 'duplicate id');
  ids.add(g.id);

  for (const f of ['title', 'tagline', 'summary']) if (!g[f] || typeof g[f] !== 'string') err(id, `${f} is missing`);
  if (g.tagline && g.tagline.length > 160) warn(id, `tagline is ${g.tagline.length} chars (aim for <=140)`);
  if (!Number.isInteger(g.rank) || g.rank < 1) err(id, 'rank must be a positive integer');
  else if (ranks.has(g.rank)) warn(id, `rank ${g.rank} duplicates ${ranks.get(g.rank)}`);
  else ranks.set(g.rank, id);

  inTax(id, 'status', g.status, tax.status);
  if (g.playUrl != null && !isUrl(g.playUrl)) err(id, 'playUrl must be an http(s) URL or null');
  for (const [k, v] of Object.entries(g.links || {})) if (v != null && !isUrl(v)) err(id, `links.${k} is not a URL`);
  for (const l of g.extraLinks || []) if (!l.label || !isUrl(l.url)) err(id, 'extraLinks entries need {label, url}');

  if (g.released != null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(g.released)) err(id, `released "${g.released}" must be YYYY, YYYY-MM or YYYY-MM-DD`);
  listInTax(id, 'genres', g.genres, tax.genres, { nonEmpty: true });
  if (Array.isArray(g.genres) && !g.genres.some((x) => grouped.has(x))) warn(id, 'no genre maps to a genre group (it will only show under "All")');
  inTax(id, 'dimension', g.dimension, tax.dimension, { nullable: true });
  inTax(id, 'perspective', g.perspective, tax.perspective, { nullable: true });
  inTax(id, 'multiplayer', g.multiplayer, tax.multiplayer);
  listInTax(id, 'platforms', g.platforms, tax.platforms, { nonEmpty: true });

  if (g.event) {
    inTax(id, 'event.id', g.event.id, tax.events);
    inTax(id, 'event.place', g.event.place, tax.places, { nullable: true });
  }

  if (!g.creator?.name) err(id, 'creator.name is missing');
  if (!Array.isArray(g.highlights) || !g.highlights.length) warn(id, 'no highlights');

  const vc = g.vibeCoding || {};
  listInTax(id, 'vibeCoding.tools', vc.tools, tax.tools);
  inTax(id, 'vibeCoding.approach', vc.approach, tax.approach, { nullable: true });
  listInTax(id, 'art.pipeline', g.art?.pipeline, tax.art, { nonEmpty: true });
  listInTax(id, 'audio.pipeline', g.audio?.pipeline, tax.audio, { nonEmpty: true });
  listInTax(id, 'tech.stack', g.tech?.stack, tax.stack);

  for (const m of g.traction?.metrics || []) {
    if (!m.label || m.value == null) err(id, 'traction.metrics entries need label and value');
    if (m.source != null && !isUrl(m.source)) warn(id, `metric "${m.label}" source is not a URL`);
  }
  if (!Array.isArray(g.sources) || !g.sources.length) err(id, 'sources is empty');
  for (const s of g.sources || []) if (!isUrl(s.url)) err(id, `source "${s.title}" has an invalid url`);
  inTax(id, 'confidence', g.confidence, tax.confidence);

  if (g.gallery != null && !Array.isArray(g.gallery)) err(id, 'gallery must be an array');
  for (const [i, s] of (g.gallery || []).entries()) {
    for (const k of ['src', 'thumb']) if (!s[k] || !existsSync(join(SITE, s[k]))) err(id, `gallery[${i}].${k} file missing (${s[k]})`);
  }
  if ((g.gallery || []).length < 3) warn(id, `only ${(g.gallery || []).length} gallery image(s)`);

  if (g.image) {
    if (!existsSync(join(SITE, g.image))) err(id, `image file ${g.image} does not exist`);
  } else warn(id, 'no image (a generated cover will be shown)');
}

for (const i of insights.insights || []) {
  for (const gid of i.games || []) if (!ids.has(gid)) err(`insight:${i.id}`, `unknown game id "${gid}"`);
  for (const s of i.sources || []) if (!isUrl(s.url)) err(`insight:${i.id}`, `invalid source url for "${s.title}"`);
}
for (const e of insights.eras || []) for (const gid of e.games || []) if (!ids.has(gid)) err(`era:${e.when}`, `unknown game id "${gid}"`);

for (const grp of radar.groups || []) {
  for (const it of grp.items || []) {
    if (!it.name || !isUrl(it.url)) err(`radar:${grp.label}`, `item needs name and url (${it.name || '?'})`);
  }
}

for (const w of warnings) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\n${games.length} games, ${(insights.insights || []).length} insights, ${(radar.groups || []).reduce((n, g) => n + g.items.length, 0)} radar items: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
