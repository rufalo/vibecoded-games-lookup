/* Vibe-Coded Games field guide: a dependency-free single-page app.
 * Data:   data/games.json, data/taxonomy.json, data/insights.json, data/radar.json
 * Routes: #/ (catalog; filters live in the query string, e.g. #/?group=shooters&art=ai-2d)
 *         #/game/<id>   #/insights   #/radar   #/about
 * All data strings are escaped before they touch innerHTML (they come from web research). */
(() => {
  'use strict';

  // ---------- utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const md = (v) => esc(v).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // tiny markdown: **bold**
  const paras = (text) => String(text || '').split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('vgl-' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('vgl-' + key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const ext = (url, html, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
  const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (d) => {
    if (!d) return 'Unknown';
    const [y, m, day] = String(d).split('-');
    if (!m) return y;
    return day ? `${MONTHS[+m - 1]} ${+day}, ${y}` : `${MONTHS[+m - 1]} ${y}`;
  };

  // ---------- icons (24px, stroke = currentColor) ----------
  const ICONS = {
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    plane: '<path d="M12 3c.9 0 1.4 1.2 1.4 2.6V9l7.6 4.4v2L13.4 13v4.3l2.6 2v1.7L12 20l-4 1v-1.7l2.6-2V13L3 15.4v-2L10.6 9V5.6C10.6 4.2 11.1 3 12 3z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    gamepad: '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 10v4M5 12h4M15 11h.01M18 13h.01"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/>',
    cube: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
    cubeSpark: '<path d="M11 3.5 3.5 7.5v9L11 20.5l7.5-4v-5"/><path d="M3.5 7.5 11 11.5l3-1.6M11 11.5v9M18.5 2v6M15.5 5h6"/>',
    brush: '<path d="M18.5 3.5a2.1 2.1 0 0 1 3 3L12 16l-3-3z"/><path d="M9 13.5c-2.4 0-4 1.6-4 3.8 0 1.2-.8 2-2 2.2 1.4 1.3 3.4 1.8 5.3 1.2 2-.6 3.2-2.4 3.2-4.2"/>',
    package: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.3l8.4 4.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.6 10.3 6 3h4l2 5 2-5h4l-2.6 7.3M12 12.5v5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4.5M10 4.5h4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    branch: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 8.2v7.6M18 10.2c0 4-6 3-11 6"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    store: '<path d="M4 9h16l-1.2-4.2A1 1 0 0 0 17.8 4H6.2a1 1 0 0 0-1 .8z"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M9.5 20v-6h5v6"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.help}</svg>`;
  const GROUP_ICONS = { shooters: 'crosshair', strategy: 'flag', vehicles: 'plane', worlds: 'globe', rpg: 'sword', casual: 'gamepad', adventure: 'compass' };
  const ART_ICONS = { 'code-generated': 'code', 'ai-2d': 'image', 'ai-3d': 'cube', 'hand-made': 'brush', 'asset-pack': 'package', 'ai-blender': 'cubeSpark', unknown: 'help' };

  // ---------- data ----------
  let DB = null;
  const L = {
    genre: (id) => DB.tax.genres[id] || id,
    group: (id) => DB.tax.genreGroups.find((g) => g.id === id)?.label || id,
    art: (id) => DB.tax.art[id]?.label || id,
    artShort: (id) => DB.tax.art[id]?.short || DB.tax.art[id]?.label || id,
    audio: (id) => DB.tax.audio[id]?.label || id,
    tool: (id) => DB.tax.tools[id]?.label || id,
    stack: (id) => DB.tax.stack[id]?.label || id,
    approach: (id) => DB.tax.approach[id]?.label || id,
    mp: (id) => DB.tax.multiplayer[id]?.label || id,
    status: (id) => DB.tax.status[id]?.label || id,
    platform: (id) => DB.tax.platforms[id] || id,
    event: (id) => DB.tax.events[id]?.label || id,
    place: (id) => DB.tax.places[id] || id,
    conf: (id) => DB.tax.confidence[id]?.label || id,
  };

  async function loadData() {
    const get = (f) => fetch(`data/${f}`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`data/${f}: HTTP ${r.status}`);
      return r.json();
    });
    const [games, tax, insights, radar] = await Promise.all(['games.json', 'taxonomy.json', 'insights.json', 'radar.json'].map(get));
    games.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const groupOf = {};
    for (const grp of tax.genreGroups) for (const genre of grp.genres) (groupOf[genre] ||= []).push(grp.id);
    for (const g of games) {
      g.genres ||= []; g.platforms ||= []; g.sources ||= []; g.highlights ||= []; g.lessons ||= [];
      g.vibeCoding ||= {}; g.vibeCoding.tools ||= []; g.vibeCoding.models ||= []; g.vibeCoding.workflow ||= [];
      g.art ||= {}; g.art.pipeline ||= ['unknown']; g.audio ||= {}; g.audio.pipeline ||= ['unknown'];
      g.tech ||= {}; g.tech.stack ||= []; g.traction ||= {}; g.creator ||= { name: 'Unknown' };
      g._groups = tax.genreGroups.map((grp) => grp.id).filter((id) => g.genres.some((x) => (groupOf[x] || []).includes(id)));
      g._year = g.released ? String(g.released).slice(0, 4) : null;
      g._search = [
        g.title, g.tagline, g.summary, g.creator.name, g.creator.handle, g.event?.name,
        ...g.genres.map((x) => tax.genres[x] || x),
        ...g.vibeCoding.tools.map((t) => tax.tools[t]?.label || t), ...g.vibeCoding.models,
        ...g.tech.stack.map((s) => tax.stack[s]?.label || s), ...(g.art.tools || []), g.art.style,
      ].filter(Boolean).join(' ').toLowerCase();
    }
    const updated = [insights.updated, ...games.map((g) => g.addedOn)].filter(Boolean).sort().pop();
    DB = { games, byId: Object.fromEntries(games.map((g) => [g.id, g])), tax, insights, radar, updated };
  }

  // ---------- catalog state, facets, sorting ----------
  const FACETS = [
    { key: 'group', label: 'Category', any: 'Any category', values: (g) => g._groups, name: (v) => L.group(v), options: () => DB.tax.genreGroups.map((x) => x.id) },
    { key: 'art', label: 'Art', any: 'Art: any', values: (g) => g.art.pipeline, name: (v) => L.art(v), options: () => Object.keys(DB.tax.art) },
    { key: 'tool', label: 'AI tool', any: 'AI tool: any', values: (g) => g.vibeCoding.tools, name: (v) => L.tool(v), options: () => Object.keys(DB.tax.tools), byCount: true },
    { key: 'mp', label: 'Players', any: 'Players: any', values: (g) => [g.multiplayer], name: (v) => L.mp(v), options: () => Object.keys(DB.tax.multiplayer) },
    { key: 'status', label: 'Availability', any: 'Availability: any', values: (g) => [g.status], name: (v) => L.status(v), options: () => Object.keys(DB.tax.status) },
    { key: 'approach', label: 'Build approach', any: 'Approach: any', values: (g) => (g.vibeCoding.approach ? [g.vibeCoding.approach] : []), name: (v) => L.approach(v), options: () => Object.keys(DB.tax.approach) },
    { key: 'stack', label: 'Engine / stack', any: 'Stack: any', values: (g) => g.tech.stack, name: (v) => L.stack(v), options: () => Object.keys(DB.tax.stack), byCount: true },
    { key: 'event', label: 'Jam', any: 'Jam: any', values: (g) => (g.event?.id ? [g.event.id] : []), name: (v) => L.event(v), options: () => Object.keys(DB.tax.events) },
  ];
  const SELECT_FACETS = FACETS.filter((f) => f.key !== 'group');
  const CONF_ORDER = { high: 0, medium: 1, low: 2 };
  const SORTS = {
    picks: { label: "Editor's picks", fn: (a, b) => a.rank - b.rank },
    newest: { label: 'Newest first', fn: (a, b) => (b.released || '').localeCompare(a.released || '') || a.rank - b.rank },
    oldest: { label: 'Oldest first', fn: (a, b) => (a.released || '9999').localeCompare(b.released || '9999') || a.rank - b.rank },
    title: { label: 'A–Z', fn: (a, b) => a.title.localeCompare(b.title) },
    documented: { label: 'Best documented', fn: (a, b) => (CONF_ORDER[a.confidence] ?? 3) - (CONF_ORDER[b.confidence] ?? 3) || a.rank - b.rank },
  };

  const state = {
    path: null,
    f: {},
    sort: SORTS[store.get('sort', 'picks')] ? store.get('sort', 'picks') : 'picks',
    view: store.get('view', 'grid') === 'table' ? 'table' : 'grid',
    catalogScroll: 0,
    lastCatalogQuery: '',
    shots: [],
  };

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const qi = raw.indexOf('?');
    let path = qi === -1 ? raw : raw.slice(0, qi);
    try { path = decodeURIComponent(path); } catch { /* keep raw path */ }
    return { path: path || '/', params: new URLSearchParams(qi === -1 ? '' : raw.slice(qi + 1)) };
  }

  function readFilters(params) {
    const f = { q: (params.get('q') || '').slice(0, 100) };
    for (const fc of FACETS) {
      const v = params.get(fc.key) || '';
      f[fc.key] = fc.options().includes(v) ? v : '';
    }
    return f;
  }

  function filtersToQuery(f) {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    for (const fc of FACETS) if (f[fc.key]) p.set(fc.key, f[fc.key]);
    const s = p.toString();
    return s ? '?' + s : '';
  }

  function matches(g, f) {
    if (f.q) {
      const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.every((t) => g._search.includes(t))) return false;
    }
    for (const fc of FACETS) if (f[fc.key] && !fc.values(g).includes(f[fc.key])) return false;
    return true;
  }

  // ---------- shared fragments ----------
  const genCover = (g) => `<div class="gen-cover" style="--h:${hue(g.id)}">${icon(GROUP_ICONS[g._groups[0]] || 'gamepad')}<strong>${esc(g.title)}</strong><small>${esc(L.status(g.status))} · no screenshot</small></div>`;
  const media = (g, eager = false) => (g.image
    ? `<img src="${esc(g.image)}" alt="${esc(g.title)} cover image"${eager ? '' : ' loading="lazy"'} decoding="async"${g.imagePosition ? ` style="object-position:${esc(g.imagePosition)}"` : ''}>`
    : genCover(g));
  const statusOb = (g) => `<span class="ob st-${esc(g.status)}"><span class="dot"></span>${esc(L.status(g.status))}</span>`;
  const isPodium = (g) => ['gold', 'silver', 'bronze'].includes(g.event?.place);
  const medalOb = (g) => (isPodium(g) ? `<span class="ob medal-${esc(g.event.place)}">${icon('medal')}${esc(L.place(g.event.place))} · ${esc(L.event(g.event.id))}</span>` : '');
  const confMeter = (c) => `<span class="conf c-${esc(c)}" title="${esc(L.conf(c))}"><i></i><i></i><i></i></span>`;
  const chipLink = (key, value, label, iconName) => `<a class="chip" href="#/?${key}=${encodeURIComponent(value)}">${iconName ? icon(iconName) : ''}${esc(label)}</a>`;

  function cardChips(g) {
    const out = [];
    const grp = g._groups[0];
    if (grp) out.push(`<span class="chip strong">${icon(GROUP_ICONS[grp])}${esc(L.group(grp))}</span>`);
    for (const p of g.art.pipeline.filter((x) => x !== 'unknown').slice(0, 2)) out.push(`<span class="chip">${icon(ART_ICONS[p])}${esc(L.artShort(p))}</span>`);
    const tools = g.vibeCoding.tools;
    if (tools.length) out.push(`<span class="chip">${icon('bot')}${esc(tools.slice(0, 2).map(L.tool).join(' + '))}${tools.length > 2 ? ` +${tools.length - 2}` : ''}</span>`);
    if (g.multiplayer === 'online' || g.multiplayer === 'mmo' || g.multiplayer === 'local') out.push(`<span class="chip">${icon('users')}${esc(L.mp(g.multiplayer))}</span>`);
    return out.join('');
  }

  function card(g) {
    return `<article class="card"><a class="card-link" href="#/game/${esc(g.id)}">
      <div class="media">${media(g)}<div class="overlay">${statusOb(g)}${g.pick ? `<span class="ob pick right">${icon('star', 'fill')}Pick</span>` : ''}</div>${isPodium(g) || g.gallery?.length ? `<div class="overlay-bottom">${medalOb(g)}${g.gallery?.length ? `<span class="ob right" title="${g.gallery.length} screenshots">${icon('image')}${g.gallery.length}</span>` : ''}</div>` : ''}</div>
      <div class="card-body">
        <div class="card-meta"><span>${esc(g._year || 'Undated')}</span><span aria-hidden="true">·</span><span>${esc(g.creator.name)}</span></div>
        <h3>${esc(g.title)}</h3>
        <p class="tagline">${esc(g.tagline)}</p>
        <div class="chips">${cardChips(g)}</div>
      </div></a></article>`;
  }

  function tableView(list) {
    const th = (label, sortKey) => {
      if (!sortKey) return `<th scope="col">${label}</th>`;
      const active = state.sort === sortKey || (sortKey === 'newest' && state.sort === 'oldest');
      const aria = active ? ` aria-sort="${state.sort === 'oldest' || state.sort === 'title' ? 'ascending' : 'descending'}"` : '';
      return `<th scope="col"${aria}><button type="button" data-sort-col="${sortKey}">${label}${active ? (state.sort === 'oldest' || state.sort === 'title' ? ' ↑' : ' ↓') : ''}</button></th>`;
    };
    const rows = list.map((g) => {
      const vc = g.vibeCoding;
      return `<tr data-href="#/game/${esc(g.id)}">
        <td><div class="t-game"><div class="t-thumb">${media(g)}</div><div><a href="#/game/${esc(g.id)}">${esc(g.title)}</a><small>${esc(g.creator.name)}</small></div></div></td>
        <td class="num">${esc(fmtDate(g.released))}</td>
        <td><div class="t-list">${g._groups.slice(0, 1).map((x) => `<span class="chip">${icon(GROUP_ICONS[x])}${esc(L.group(x))}</span>`).join('')}${g._groups.length > 1 ? `<span class="chip" title="${esc(g._groups.slice(1).map(L.group).join(', '))}">+${g._groups.length - 1}</span>` : ''}</div></td>
        <td><div class="t-list">${vc.tools.length ? vc.tools.map((t) => `<span class="chip">${esc(L.tool(t))}</span>`).join('') : '<span class="muted">Not disclosed</span>'}</div></td>
        <td>${esc(vc.approach ? L.approach(vc.approach) : '—')}</td>
        <td><div class="t-list">${g.art.pipeline.map((p) => `<span class="chip">${icon(ART_ICONS[p])}${esc(L.artShort(p))}</span>`).join('')}</div></td>
        <td>${esc(L.mp(g.multiplayer))}</td>
        <td><span class="badge st-${esc(g.status)}"><span class="dot"></span>${esc(L.status(g.status))}</span></td>
        <td>${confMeter(g.confidence)}</td>
      </tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data clickable"><thead><tr>
      ${th("Game", 'title')}${th('Released', 'newest')}${th('Category')}${th('AI tools')}${th('Approach')}${th('Art')}${th('Players')}${th('Availability')}${th('Docs', 'documented')}
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- catalog page ----------
  function renderCatalog(params) {
    state.f = readFilters(params);
    const v = params.get('view'); // optional deep link: #/?view=table
    if (v === 'grid' || v === 'table') { state.view = v; store.set('view', v); }
    const G = DB.games;
    const n = (pred) => G.filter(pred).length;
    main.innerHTML = `<div class="wrap">
      <section class="hero">
        <div>
          <div class="kicker">Field guide · updated ${esc(fmtDate(DB.updated))}</div>
          <h1>Games built by <span class="hl">vibe coding</span></h1>
          <p>${G.length} notable games where AI wrote most of the code: what they are, what's impressive, how the developers steered the AI, and how the art got made.</p>
        </div>
        <div class="hero-stats">
          <a class="hero-stat" href="#/?status=playable">${icon('play')}<div><b>${n((g) => g.status === 'playable')}</b><span>playable in your browser</span></div></a>
          <a class="hero-stat" href="#/?group=shooters">${icon('crosshair')}<div><b>${n((g) => g._groups.includes('shooters'))}</b><span>shooters &amp; FPS</span></div></a>
          <a class="hero-stat" href="#/?group=strategy">${icon('flag')}<div><b>${n((g) => g._groups.includes('strategy'))}</b><span>strategy &amp; building</span></div></a>
          <a class="hero-stat" href="#/insights">${icon('medal')}<div><b>${n(isPodium)}</b><span>game-jam podium finishes</span></div></a>
        </div>
      </section>
      <section class="filters" aria-label="Filter games">
        <div class="filter-row">
          <label class="search"><span class="sr-only">Search games</span>${icon('search')}<input id="q" type="search" placeholder="Search titles, creators, tools, models…" value="${esc(state.f.q)}" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></label>
          <div class="select"><label class="sr-only" for="sort">Sort games</label><select id="sort">${Object.entries(SORTS).map(([k, s]) => `<option value="${k}"${k === state.sort ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
          <div class="seg" role="group" aria-label="Layout">
            <button type="button" data-view="grid" aria-pressed="${state.view === 'grid'}" title="Cards">${icon('grid')}<span class="sr-only">Cards</span></button>
            <button type="button" data-view="table" aria-pressed="${state.view === 'table'}" title="Comparison table">${icon('list')}<span class="sr-only">Comparison table</span></button>
          </div>
        </div>
        <div class="filter-row"><div class="tabs" role="group" aria-label="Category">
          <button type="button" class="tab" data-group="">All <span class="n" data-count-group=""></span></button>
          ${DB.tax.genreGroups.map((grp) => `<button type="button" class="tab" data-group="${esc(grp.id)}">${icon(GROUP_ICONS[grp.id])}${esc(grp.label)} <span class="n" data-count-group="${esc(grp.id)}"></span></button>`).join('')}
        </div></div>
        <div class="filter-row facets">
          ${SELECT_FACETS.map((fc) => `<div class="select"><label class="sr-only" for="f-${fc.key}">${esc(fc.label)}</label><select id="f-${fc.key}" data-facet="${fc.key}"></select></div>`).join('')}
        </div>
      </section>
      <div class="results-bar" id="results-bar" aria-live="polite"></div>
      <div id="results"></div>
    </div>`;

    let timer;
    $('#q').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.f.q = e.target.value.trim(); updateCatalog(); }, 120);
    });
    $('#q').addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.value) { e.target.value = ''; state.f.q = ''; updateCatalog(); }
    });
    $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; store.set('sort', state.sort); updateCatalog(); });
    for (const sel of $$('select[data-facet]')) {
      sel.addEventListener('change', (e) => { state.f[e.target.dataset.facet] = e.target.value; updateCatalog(); });
    }
    updateCatalog();
  }

  function updateCatalog() {
    const f = state.f;
    const G = DB.games;
    const list = G.filter((g) => matches(g, f)).sort(SORTS[state.sort].fn);

    for (const el of $$('[data-count-group]')) {
      const id = el.dataset.countGroup;
      const count = G.filter((g) => matches(g, { ...f, group: id })).length;
      el.textContent = count;
      const btn = el.closest('button');
      btn.setAttribute('aria-pressed', String((f.group || '') === id));
      btn.disabled = count === 0 && (f.group || '') !== id;
    }

    for (const fc of SELECT_FACETS) {
      const sel = $(`#f-${fc.key}`);
      if (!sel) continue;
      let opts = fc.options()
        .map((v, i) => ({ v, i, total: G.filter((g) => fc.values(g).includes(v)).length, n: G.filter((g) => matches(g, { ...f, [fc.key]: v })).length }))
        .filter((o) => o.total > 0);
      if (fc.byCount) opts = opts.sort((a, b) => b.total - a.total || a.i - b.i);
      sel.innerHTML = `<option value="">${esc(fc.any)}</option>` + opts.map((o) =>
        `<option value="${esc(o.v)}"${o.n === 0 && f[fc.key] !== o.v ? ' disabled' : ''}>${esc(fc.name(o.v))} (${o.n})</option>`).join('');
      sel.value = f[fc.key] || '';
      sel.classList.toggle('active', !!f[fc.key]);
    }
    $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const sortSel = $('#sort');
    if (sortSel) sortSel.value = state.sort;

    const active = [];
    if (f.q) active.push({ key: 'q', label: `“${f.q}”` });
    for (const fc of FACETS) if (f[fc.key]) active.push({ key: fc.key, label: `${fc.label}: ${fc.name(f[fc.key])}` });
    $('#results-bar').innerHTML = `<span>Showing <b>${list.length}</b> of ${G.length} games</span>`
      + active.map((a) => `<button type="button" class="active-filter" data-remove="${esc(a.key)}" aria-label="Remove filter ${esc(a.label)}">${esc(a.label)} ${icon('x')}</button>`).join('')
      + (active.length > 1 ? '<button type="button" class="link-btn" data-clear>Clear all</button>' : '');

    $('#results').innerHTML = list.length
      ? (state.view === 'table' ? tableView(list) : `<div class="grid">${list.map(card).join('')}</div>`)
      : '<div class="empty">No games match these filters. <button type="button" class="link-btn" data-clear>Clear filters</button></div>';

    state.lastCatalogQuery = filtersToQuery(f);
    const target = '#/' + state.lastCatalogQuery;
    if (location.hash !== target) history.replaceState(null, '', target);
  }

  // ---------- game detail page ----------
  function creatorHtml(c) {
    const name = c.url ? ext(c.url, esc(c.name)) : esc(c.name);
    const handle = c.handle && c.handle !== c.name ? ` <span class="muted">${esc(c.handle)}</span>` : '';
    return name + handle;
  }

  function gameActions(g) {
    const seen = new Set();
    const btn = (url, label, iconName, cls = '') => {
      if (!url || seen.has(url)) return '';
      seen.add(url);
      return ext(url, `${icon(iconName)}${esc(label)}`, `btn ${cls}`.trim());
    };
    const s = DB.tax.status[g.status];
    const primaryIcon = { playable: 'play', steam: 'store', 'coming-soon': 'store', offline: 'external', 'source-only': 'branch' }[g.status] || 'external';
    const out = [];
    if (g.playUrl && s?.action) out.push(btn(g.playUrl, s.action, primaryIcon, g.status === 'offline' ? 'ghost' : 'primary'));
    const l = g.links || {};
    out.push(btn(l.steam, 'Steam page', 'store'), btn(l.itch, 'itch.io', 'gamepad'), btn(l.github, 'Source code', 'branch'),
      btn(l.video, 'Watch video', 'video'), btn(l.devlog, 'Dev write-up', 'doc'), btn(l.creatorPost, "Creator's post", 'message'));
    for (const x of g.extraLinks || []) out.push(btn(x.url, x.label, 'play', 'ghost'));
    return out.join('');
  }

  function similar(g, count = 4) {
    const shared = (a, b) => a.filter((x) => b.includes(x));
    return DB.games.filter((o) => o.id !== g.id).map((o) => {
      let score = 0;
      const why = [];
      const grp = shared(g._groups, o._groups);
      if (grp.length) { score += 3 * grp.length; why.push(L.group(grp[0])); }
      const art = shared(g.art.pipeline.filter((x) => x !== 'unknown'), o.art.pipeline);
      if (art.length) { score += 2 * art.length; why.push(L.art(art[0])); }
      const tools = shared(g.vibeCoding.tools, o.vibeCoding.tools);
      if (tools.length) { score += 1.5 * tools.length; why.push(tools.slice(0, 2).map(L.tool).join(' + ')); }
      if (g.vibeCoding.approach && g.vibeCoding.approach === o.vibeCoding.approach) { score += 1; why.push(L.approach(g.vibeCoding.approach)); }
      if (g.multiplayer === o.multiplayer && ['online', 'mmo', 'local'].includes(g.multiplayer)) { score += 1; why.push(L.mp(g.multiplayer)); }
      const engines = shared(g.tech.stack.filter((x) => DB.tax.stack[x]?.kind === 'Engine'), o.tech.stack);
      if (engines.length) { score += 1; why.push(L.stack(engines[0])); }
      if (g.event?.id && g.event.id === o.event?.id) { score += 1; why.push(L.event(g.event.id)); }
      return { o, score, why };
    }).sort((a, b) => b.score - a.score || a.o.rank - b.o.rank).slice(0, count);
  }

  function renderGame(id) {
    const g = DB.byId[id];
    if (!g) { renderNotFound(`No game with the id “${id}”.`); return; }
    document.title = `${g.title} · Vibe-Coded Games`;
    const idx = DB.games.indexOf(g);
    const prev = DB.games[idx - 1];
    const next = DB.games[idx + 1];
    const vc = g.vibeCoding;
    const tr = g.traction || {};
    let num = 0;
    const sec = (title, body) => `<section><h2><span class="num">${String(++num).padStart(2, '0')}</span>${esc(title)}</h2>${body}</section>`;
    const stat = (iconName, label, value) => `<div class="stat"><div class="label">${icon(iconName)}${esc(label)}</div><div class="value">${esc(value || 'Unknown')}</div></div>`;
    const approach = vc.approach ? `${L.approach(vc.approach)}. ${DB.tax.approach[vc.approach]?.description || ''}` : 'Unknown';

    const vibe = `
      <div class="sub">Coding tools</div>
      <div class="chips">${vc.tools.length ? vc.tools.map((t) => chipLink('tool', t, L.tool(t), 'bot')).join('') : '<span class="muted">Not disclosed</span>'}</div>
      ${vc.models.length ? `<div class="sub">Models</div><div class="chips">${vc.models.map((m) => `<span class="chip strong">${esc(m)}</span>`).join('')}</div>` : ''}
      <div class="sub">At a glance</div>
      <div class="stat-row">${stat('percent', 'AI-written code', vc.aiCodeShare)}${stat('clock', 'Build time', vc.buildTime)}${stat('route', 'Approach', approach)}</div>
      ${vc.workflow.length ? `<div class="sub">How they worked with the AI</div><ul>${vc.workflow.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;

    const art = `
      <div class="def-list">${g.art.pipeline.map((p) => `<div class="def">${icon(ART_ICONS[p])}<div><b>${esc(L.art(p))}</b><span>${esc(DB.tax.art[p]?.description || '')}</span></div></div>`).join('')}</div>
      ${g.art.style ? `<div class="sub">Visual style</div><p>${esc(g.art.style)}</p>` : ''}
      ${g.art.tools?.length ? `<div class="sub">Art tools</div><div class="chips">${g.art.tools.map((t) => `<span class="chip strong">${esc(t)}</span>`).join('')}</div>` : ''}
      ${g.art.notes ? `<div class="sub">How the visuals were made</div><p>${esc(g.art.notes)}</p>` : ''}
      <div class="sub">Audio</div>
      <div class="chips">${g.audio.pipeline.map((a) => `<span class="chip">${icon('music')}${esc(L.audio(a))}</span>`).join('')}${(g.audio.tools || []).map((t) => `<span class="chip strong">${esc(t)}</span>`).join('')}</div>
      ${g.audio.notes ? `<p style="margin-top:10px">${esc(g.audio.notes)}</p>` : ''}`;

    const tech = `
      <div class="chips">${g.tech.stack.length ? g.tech.stack.map((s) => chipLink('stack', s, L.stack(s), 'layers')).join('') : '<span class="muted">Not documented</span>'}</div>
      ${g.tech.notes ? `<p style="margin-top:12px">${esc(g.tech.notes)}</p>` : ''}`;

    const metrics = (tr.metrics || []).map((m) => `<div class="metric"><div class="value">${esc(m.value)}</div><div class="label">${esc(m.label)}</div>
      <div class="meta">${m.asOf ? `<span>${esc(fmtDate(m.asOf))}</span>` : ''}${m.selfReported ? `<span class="flag" title="Claimed by the creator, not independently verified">${icon('alert')}self-reported</span>` : ''}${m.source ? ext(m.source, 'source') : ''}</div></div>`).join('');
    const traction = `${metrics ? `<div class="metrics">${metrics}</div>` : '<p class="muted">No public numbers.</p>'}
      ${tr.monetization ? `<div class="sub">Money</div><p>${esc(tr.monetization)}</p>` : ''}
      ${tr.notes ? `<div class="sub">Notes</div><p>${esc(tr.notes)}</p>` : ''}`;

    const sources = `<ul class="sources">${g.sources.map((s) => `<li>${icon('link')}<span>${ext(s.url, esc(s.title || s.url))} <span class="host">${esc(host(s.url))}</span></span></li>`).join('')}</ul>
      ${g.imageSource ? `<p class="muted" style="margin-top:12px;font-size:13px">Cover image: ${esc(g.imageSource)}</p>` : ''}`;

    const fact = (label, html) => (html ? `<div><dt>${esc(label)}</dt><dd>${html}</dd></div>` : '');
    const ev = g.event ? `${DB.tax.events[g.event.id]?.url ? ext(DB.tax.events[g.event.id].url, esc(g.event.name || L.event(g.event.id))) : esc(g.event.name || L.event(g.event.id))}${g.event.result ? `<p>${esc(g.event.result)}</p>` : ''}` : '';
    const facts = `<dl class="facts">
      ${fact('Released', esc(fmtDate(g.released)))}
      ${fact('Creator', creatorHtml(g.creator))}
      ${fact('Category', g._groups.map((x) => chipLink('group', x, L.group(x), GROUP_ICONS[x])).join(''))}
      ${fact('Genres', g.genres.map((x) => `<span class="chip">${esc(L.genre(x))}</span>`).join(''))}
      ${fact('Format', esc([g.dimension && DB.tax.dimension[g.dimension], g.perspective && DB.tax.perspective[g.perspective]].filter(Boolean).join(' · ') || 'Unknown'))}
      ${fact('Players', chipLink('mp', g.multiplayer, L.mp(g.multiplayer), 'users'))}
      ${fact('Platforms', esc(g.platforms.map(L.platform).join(', ')))}
      ${fact('Game jam', ev)}
      ${fact('AI tools', vc.tools.map((t) => chipLink('tool', t, L.tool(t))).join('') || '<span class="muted">Not disclosed</span>')}
      ${fact('Approach', vc.approach ? chipLink('approach', vc.approach, L.approach(vc.approach), 'route') : '')}
      ${fact('Art', g.art.pipeline.map((p) => chipLink('art', p, L.artShort(p), ART_ICONS[p])).join(''))}
      ${fact('Engine & stack', g.tech.stack.map((s) => chipLink('stack', s, L.stack(s))).join(''))}
      ${fact('Documentation', `${confMeter(g.confidence)} ${esc(L.conf(g.confidence))}<p>${esc(DB.tax.confidence[g.confidence]?.description || '')}</p>`)}
      ${fact('In the guide since', esc(fmtDate(g.addedOn)))}
    </dl>`;

    // Screenshot viewer sequence: the cover first, then the gallery.
    state.shots = [
      ...(g.image ? [{ src: g.image, source: g.imageSource, origin: 'cover' }] : []),
      ...(g.gallery || []),
    ];
    const offset = g.image ? 1 : 0;
    const gallery = g.gallery?.length ? `<section class="gallery-sec" aria-label="Screenshots">
        <div class="section-title"><h2>Screenshots</h2><span class="count">${g.gallery.length + offset} images · click to enlarge</span></div>
        <div class="gallery">${g.gallery.map((x, i) => `<button type="button" class="shot" data-shot="${i + offset}" aria-label="Open screenshot ${i + 1 + offset} of ${g.gallery.length + offset}">
          <img src="${esc(x.thumb || x.src)}" alt="${esc(g.title)} screenshot ${i + 1}" loading="lazy" decoding="async"></button>`).join('')}</div>
      </section>` : '';
    const heroMedia = g.image
      ? `<button type="button" class="media shot-hero" data-shot="0" aria-label="Open cover image">${media(g, true)}${g.gallery?.length ? `<span class="ob hero-count">${icon('image')}${g.gallery.length + 1} images</span>` : ''}</button>`
      : `<div class="media">${media(g, true)}</div>`;

    const sims = similar(g).map(({ o, why }) => `<article class="card"><a class="card-link" href="#/game/${esc(o.id)}">
        <div class="media">${media(o)}<div class="overlay">${statusOb(o)}</div></div>
        <div class="card-body"><h3 style="font-size:16px">${esc(o.title)}</h3><div class="why">${why.slice(0, 3).map((w) => `<b>${esc(w)}</b>`).join(' · ')}</div></div>
      </a></article>`).join('');

    main.innerHTML = `<div class="wrap">
      <div class="crumbs">
        <a class="back" href="#/${esc(state.lastCatalogQuery)}">${icon('arrowLeft')}All games</a>
        <nav class="pager" aria-label="Browse games">
          ${prev ? `<a href="#/game/${esc(prev.id)}" title="Previous: ${esc(prev.title)}">${icon('arrowLeft')}<span>${esc(prev.title)}</span></a>` : ''}
          ${next ? `<a href="#/game/${esc(next.id)}" title="Next: ${esc(next.title)}"><span>${esc(next.title)}</span>${icon('arrowRight')}</a>` : ''}
        </nav>
      </div>
      <section class="detail-hero">
        ${heroMedia}
        <div>
          <div class="badges">
            <span class="badge st-${esc(g.status)}"><span class="dot"></span>${esc(L.status(g.status))}</span>
            ${isPodium(g) ? `<span class="badge">${icon('medal')}${esc(L.place(g.event.place))} · ${esc(L.event(g.event.id))}</span>` : ''}
            ${g.pick ? `<span class="badge">${icon('star')}Editor's pick</span>` : ''}
            <span class="badge">${confMeter(g.confidence)}${esc(L.conf(g.confidence))}</span>
          </div>
          <h1>${esc(g.title)}</h1>
          <p class="lede">${esc(g.tagline)}</p>
          <p class="byline">by <b>${creatorHtml(g.creator)}</b>${g.creator.background ? ` · ${esc(g.creator.background)}` : ''}</p>
          <div class="actions">${gameActions(g)}</div>
        </div>
      </section>
      ${gallery}
      <div class="detail-layout">
        <article class="detail-main">
          ${sec('What it is', `<p>${esc(g.summary)}</p>`)}
          ${g.highlights.length ? sec("What's impressive", `<ul class="highlights">${g.highlights.map((h) => `<li>${icon('sparkle')}${esc(h)}</li>`).join('')}</ul>`) : ''}
          ${sec('How it was vibe-coded', vibe)}
          ${sec('Art & audio', art)}
          ${sec('Tech', tech)}
          ${sec('Traction & money', traction)}
          ${g.story ? sec('The story', `<div class="story">${paras(g.story)}</div>`) : ''}
          ${g.reception ? sec('Reception', paras(g.reception)) : ''}
          ${g.lessons.length ? sec('Lessons & gotchas', `<ul>${g.lessons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`) : ''}
          ${sec('Sources', sources)}
        </article>
        <aside class="side" aria-label="Fact sheet"><h2>Fact sheet</h2>${facts}</aside>
      </div>
      <div class="section-title"><h2>Similar games</h2><span class="count">by shared category, art pipeline, tools and approach</span></div>
      <div class="similar-grid">${sims}</div>
    </div>`;
  }

  // ---------- insights page ----------
  function meterChart({ title, sub, facet, values, get, label, iconFor, limit = 8 }) {
    const N = DB.games.length;
    const rows = values
      .map((v) => { const gs = DB.games.filter((g) => get(g).includes(v)); return { v, gs, n: gs.length }; })
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const shown = rows.slice(0, limit);
    const rest = rows.slice(limit);
    const rowHtml = (r) => {
      const name = label(r.v);
      const attrs = `class="meter" data-tip-title="${esc(`${name}: ${r.n} of ${N} games`)}" data-tip="${esc(r.gs.map((g) => g.title).join('\n'))}" aria-label="${esc(`${name}: ${r.n} of ${N} games`)}"`;
      const inner = `<span class="meter-name">${icon(typeof iconFor === 'function' ? iconFor(r.v) : iconFor)}<span>${esc(name)}</span></span>
        <span class="meter-bar"><i style="width:${((r.n / N) * 100).toFixed(1)}%"></i></span><span class="meter-n">${r.n}</span>`;
      return facet ? `<a ${attrs} href="#/?${facet}=${encodeURIComponent(r.v)}">${inner}</a>` : `<div ${attrs} tabindex="0">${inner}</div>`;
    };
    return `<div class="chart-card"><h3>${esc(title)}</h3><div class="chart-sub">${esc(sub)}</div>
      <div class="meters">${shown.map(rowHtml).join('')}</div>
      ${rest.length ? `<div class="chart-foot">Also: ${esc(rest.map((r) => `${label(r.v)} (${r.n})`).join(', '))}</div>` : ''}</div>`;
  }

  function renderInsights() {
    document.title = 'Insights · Vibe-Coded Games';
    const G = DB.games;
    const N = G.length;
    const n = (pred) => G.filter(pred).length;
    const ins = DB.insights;
    const tax = DB.tax;
    const kpis = [
      { v: N, l: 'games in the guide', href: '#/' },
      { v: n((g) => g.status === 'playable'), l: 'playable in a browser', href: '#/?status=playable' },
      { v: n((g) => ['online', 'mmo', 'local'].includes(g.multiplayer)), l: 'have multiplayer' },
      { v: n((g) => g.art.pipeline.includes('code-generated')), l: 'draw art in code', href: '#/?art=code-generated' },
      { v: n((g) => g.status === 'steam' || g.status === 'coming-soon'), l: 'on Steam (or coming soon)' },
      { v: n(isPodium), l: 'jam podium finishes' },
    ];
    const charts = [
      meterChart({ title: 'How the art was made', sub: 'Games using each source of visuals (many use several)', facet: 'art', values: Object.keys(tax.art), get: (g) => g.art.pipeline, label: L.art, iconFor: (v) => ART_ICONS[v] }),
      meterChart({ title: 'AI coding tools', sub: 'Games that used each tool or assistant', facet: 'tool', values: Object.keys(tax.tools), get: (g) => g.vibeCoding.tools, label: L.tool, iconFor: 'bot' }),
      meterChart({ title: 'Engine or renderer', sub: 'What draws the game', facet: 'stack', values: Object.keys(tax.stack).filter((k) => tax.stack[k].kind === 'Engine' || tax.stack[k].kind === 'Graphics'), get: (g) => g.tech.stack, label: L.stack, iconFor: 'layers' }),
      meterChart({ title: 'How it was built', sub: 'The dominant way the creator worked with AI', facet: 'approach', values: Object.keys(tax.approach), get: (g) => [g.vibeCoding.approach], label: L.approach, iconFor: 'route' }),
      meterChart({ title: 'Categories', sub: 'Games per category (many span several)', facet: 'group', values: tax.genreGroups.map((x) => x.id), get: (g) => g._groups, label: L.group, iconFor: (v) => GROUP_ICONS[v] }),
      meterChart({ title: 'Audio', sub: 'Where the sound came from', values: Object.keys(tax.audio), get: (g) => g.audio.pipeline, label: L.audio, iconFor: 'music' }),
      meterChart({ title: 'Players', sub: 'Single-player vs multiplayer', facet: 'mp', values: Object.keys(tax.multiplayer), get: (g) => [g.multiplayer], label: L.mp, iconFor: 'users' }),
      meterChart({ title: 'Networking & backend', sub: 'Tech used by the online games', facet: 'stack', values: Object.keys(tax.stack).filter((k) => ['Networking', 'Backend', 'Hosting'].includes(tax.stack[k].kind)), get: (g) => g.tech.stack, label: L.stack, iconFor: 'layers' }),
    ];
    const gameChip = (id) => { const g = DB.byId[id]; return g ? `<a class="chip" href="#/game/${esc(g.id)}">${esc(g.title)}</a>` : ''; };
    const insightCards = (ins.insights || []).map((i) => `<article class="insight" id="insight-${esc(i.id)}">
        <div class="kicker">${esc(i.kicker)}</div><h3>${esc(i.title)}</h3><p class="lead">${esc(i.lead)}</p>
        <ul>${(i.points || []).map((p) => `<li>${md(p)}</li>`).join('')}</ul>
        ${i.games?.length ? `<div class="chips">${i.games.map(gameChip).join('')}</div>` : ''}
        ${i.sources?.length ? `<details><summary>Sources (${i.sources.length})</summary><ul>${i.sources.map((s) => `<li>${ext(s.url, esc(s.title))}</li>`).join('')}</ul></details>` : ''}
      </article>`).join('');
    const eras = (ins.eras || []).map((e) => `<div class="era"><div class="when">${esc(e.when)}</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>
        <div class="chips">${(e.games || []).map(gameChip).join('')}</div></div>`).join('');
    const j = ins.jams;
    const cell = (c) => { const g = DB.games.find((x) => x.title === c); return g ? `<a href="#/game/${esc(g.id)}">${esc(c)}</a>` : esc(c); };
    const jams = j ? `<div class="section-title"><h2>${esc(j.title)}</h2></div>
      <p class="muted" style="max-width:760px">${esc(j.note)}</p>
      <div class="table-wrap"><table class="data jam-table"><thead><tr>${j.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${j.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${j.specialAwards2026?.length ? `<div class="sub" style="margin-top:22px">Vibe Jam 2026 special awards ($1,000 each)</div>
        <div class="awards">${j.specialAwards2026.map((a) => `<div class="award"><small>${esc(a.award)}</small>${ext(a.url, esc(a.game))}</div>`).join('')}</div>` : ''}
      <details style="margin-top:12px"><summary class="muted">Jam data sources</summary><ul>${(j.sources || []).map((s) => `<li>${ext(s.url, esc(s.title))}</li>`).join('')}</ul></details>` : '';

    main.innerHTML = `<div class="wrap">
      <header class="page-head"><div class="kicker">Insights</div><h1>What ${N} vibe-coded games have in common</h1><p>${esc(ins.lede)}</p></header>
      <section class="kpis" aria-label="Key numbers">${kpis.map((k) => (k.href
        ? `<a class="kpi" href="${k.href}"><div class="kpi-value">${k.v}</div><div class="kpi-label">${esc(k.l)}</div></a>`
        : `<div class="kpi"><div class="kpi-value">${k.v}</div><div class="kpi-label">${esc(k.l)}</div></div>`)).join('')}</section>
      <div class="section-title"><h2>The guide by the numbers</h2><span class="count">bar = share of all ${N} games · hover a row to see which games · click to filter</span></div>
      <section class="charts">${charts.join('')}</section>
      <div class="section-title"><h2>Patterns</h2><span class="count">${(ins.insights || []).length} cross-game observations</span></div>
      <section class="insight-grid">${insightCards}</section>
      <div class="section-title"><h2>How the tooling evolved</h2></div>
      <section class="eras">${eras}</section>
      ${jams}
    </div>`;
  }

  // ---------- radar & about ----------
  function renderRadar() {
    document.title = 'Radar · Vibe-Coded Games';
    const r = DB.radar;
    const total = r.groups.reduce((s, grp) => s + grp.items.length, 0);
    main.innerHTML = `<div class="wrap">
      <header class="page-head"><div class="kicker">Radar · ${total} candidates</div><h1>Not in the guide yet</h1><p>${esc(r.intro)} Ask Claude something like “research Undersphere and add it to the guide”.</p></header>
      ${r.groups.map((grp) => `<section class="radar-group"><div class="section-title"><h2>${esc(grp.label)}</h2><span class="count">${grp.items.length}</span></div>
        <div class="radar-list">${grp.items.map((it) => `<div class="radar-item">${ext(it.url, `${esc(it.name)}${icon('external')}`, 'name')}<p>${esc(it.note)}</p>${it.status ? `<div class="status">${esc(it.status)}</div>` : ''}</div>`).join('')}</div></section>`).join('')}
    </div>`;
  }

  function renderAbout() {
    document.title = 'About · Vibe-Coded Games';
    const tax = DB.tax;
    const legend = (table, icons, key) => Object.entries(table).map(([id, v]) => `<div class="def">${icon(typeof icons === 'function' ? icons(id) : icons)}<div><b>${esc(v.label)}</b><span>${esc(v.description || '')}</span></div></div>`).join('');
    main.innerHTML = `<div class="wrap prose">
      <header class="page-head"><div class="kicker">About</div><h1>How this guide works</h1>
        <p>A private field guide to games built mostly by AI coding tools ("vibe coding"). Each entry covers what the game is, what's impressive, how the developer used AI, how the art and audio were made, the tech, traction and lessons, with sources.</p></header>
      <h2>Art pipelines</h2>
      <p>The art question is the most useful way to tell vibe-coded games apart. Every game is tagged with one or more of these:</p>
      <div class="legend">${legend(tax.art, (id) => ART_ICONS[id])}</div>
      <h2>Build approaches</h2>
      <div class="legend">${legend(tax.approach, 'route')}</div>
      <h2>How well documented?</h2>
      <p>Player counts and revenue figures in this space are often self-reported and drift as they're re-reported. Metrics marked <span class="flag">${icon('alert')}self-reported</span> come from the creator. Each game also carries a documentation level:</p>
      <div class="legend">${Object.entries(tax.confidence).map(([id, v]) => `<div class="def">${confMeter(id)}<div><b>${esc(v.label)}</b><span>${esc(v.description)}</span></div></div>`).join('')}</div>
      <h2>Adding games</h2>
      <p>Ask Claude, e.g. “add Undersphere and Null Range to the guide”. Everything is data-driven:</p>
      <ul>
        <li><code>docs/data/games.json</code>: one object per game (the schema is documented in <code>CLAUDE.md</code>).</li>
        <li><code>docs/data/taxonomy.json</code>: labels for every tag, category and filter.</li>
        <li><code>docs/data/insights.json</code> and <code>radar.json</code>: the Insights patterns and the Radar list.</li>
        <li><code>node scripts/fetch-images.mjs</code> downloads cover images; <code>node scripts/validate.mjs</code> checks the data.</li>
      </ul>
      <h2>Hosting</h2>
      <p>The site is static files in the repo's <code>docs/</code> folder, published by GitHub Pages. Pushing changes to <code>main</code> redeploys it in about a minute. For a local preview, run <code>node scripts/serve.mjs</code>.</p>
      <p class="muted">Research for the first ${DB.games.length} games was done on ${esc(fmtDate(DB.updated))} from creator write-ups, public repos, jam data and press coverage.</p>
    </div>`;
  }

  function renderNotFound(msg = 'That page does not exist.') {
    document.title = 'Not found · Vibe-Coded Games';
    main.innerHTML = `<div class="wrap"><div class="notice"><h2>Not found</h2><p>${esc(msg)}</p><a class="btn" href="#/">${icon('arrowLeft')}Back to all games</a></div></div>`;
  }

  // ---------- router ----------
  const main = $('#main');
  let firstRoute = true;

  function route() {
    if (!DB) return;
    const { path, params } = parseHash();
    const prev = state.path;
    if (prev === '/') state.catalogScroll = window.scrollY;
    state.path = path;
    hideTip();
    let m;
    if (path === '/') {
      document.title = 'Vibe-Coded Games';
      renderCatalog(params);
      const y = prev && prev.startsWith('/game/') ? state.catalogScroll : 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else if ((m = path.match(/^\/game\/([\w-]+)$/))) {
      renderGame(m[1]);
      window.scrollTo(0, 0);
      const shot = params.get('shot'); // deep link: #/game/<id>?shot=2 opens the viewer
      if (shot && state.shots.length) openShots(Number(shot) || 0);
    } else if (path === '/insights') { renderInsights(); window.scrollTo(0, 0); }
    else if (path === '/radar') { renderRadar(); window.scrollTo(0, 0); }
    else if (path === '/about') { renderAbout(); window.scrollTo(0, 0); }
    else renderNotFound();

    const section = path.startsWith('/game/') || path === '/' ? 'catalog' : path.slice(1);
    $$('[data-nav]').forEach((a) => (a.dataset.nav === section ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    if (!firstRoute) main.focus({ preventScroll: true });
    firstRoute = false;
  }

  // ---------- global events ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    const group = t.closest('[data-group]');
    if (group && state.path === '/') { state.f.group = group.dataset.group; updateCatalog(); return; }
    const view = t.closest('[data-view]');
    if (view) { state.view = view.dataset.view; store.set('view', state.view); updateCatalog(); return; }
    const remove = t.closest('[data-remove]');
    if (remove) {
      state.f[remove.dataset.remove] = '';
      if (remove.dataset.remove === 'q') { const q = $('#q'); if (q) q.value = ''; }
      updateCatalog();
      return;
    }
    if (t.closest('[data-clear]')) {
      state.f = readFilters(new URLSearchParams());
      const q = $('#q'); if (q) q.value = '';
      updateCatalog();
      return;
    }
    const sortCol = t.closest('[data-sort-col]');
    if (sortCol) {
      const k = sortCol.dataset.sortCol;
      state.sort = k === 'newest' && state.sort === 'newest' ? 'oldest' : k;
      store.set('sort', state.sort);
      updateCatalog();
      return;
    }
    const row = t.closest('tr[data-href]');
    if (row && !t.closest('a, button')) { location.hash = row.dataset.href; }
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === '/' && !typing && state.path === '/') { e.preventDefault(); $('#q')?.focus(); }
  });

  $('.theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
  });

  // Tooltip for chart rows: lists the games behind each bar (built with textContent).
  const tip = $('#tooltip');
  function showTip(el) {
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = el.dataset.tipTitle;
    tip.append(strong);
    const lines = (el.dataset.tip || '').split('\n').filter(Boolean);
    for (const line of lines.slice(0, 14)) { const s = document.createElement('span'); s.textContent = line; tip.append(s); }
    if (lines.length > 14) { const s = document.createElement('span'); s.textContent = `+${lines.length - 14} more`; tip.append(s); }
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + tr.height > window.innerHeight - 8) top = Math.max(8, r.top - tr.height - 8);
    const left = Math.min(Math.max(8, r.left + 24), window.innerWidth - tr.width - 8);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }
  function hideTip() { if (tip) tip.hidden = true; }
  document.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip-title]'); if (el) showTip(el); });
  document.addEventListener('pointerout', (e) => { const el = e.target.closest?.('[data-tip-title]'); if (el && !el.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip-title]'); if (el) showTip(el); });
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('[data-tip-title]')) hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });

  // ---------- screenshot viewer (lightbox) ----------
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Screenshot viewer');
  lb.innerHTML = `<button type="button" class="lb-btn lb-close" aria-label="Close (Esc)">${icon('x')}</button>
    <button type="button" class="lb-btn lb-prev" aria-label="Previous (←)">${icon('arrowLeft')}</button>
    <figure class="lb-fig"><img alt=""><figcaption></figcaption></figure>
    <button type="button" class="lb-btn lb-next" aria-label="Next (→)">${icon('arrowRight')}</button>`;
  document.body.append(lb);
  const lbImg = $('img', lb);
  const lbCap = $('figcaption', lb);
  let lbIndex = 0;
  let lbReturnFocus = null;

  function shotCredit(s) {
    const yt = /img\.youtube\.com\/vi\/([\w-]{11})\//.exec(s.source || '');
    if (yt) return { label: 'Frame from a YouTube video', url: `https://youtu.be/${yt[1]}` };
    if (s.origin === 'live') return { label: 'Live screenshot of the game', url: s.source };
    if (/steamstatic|steampowered/.test(s.source || '')) return { label: 'Steam store screenshot', url: null };
    if (s.origin === 'cover') return { label: 'Cover image', url: /^https?:/.test(s.source || '') ? s.source : null, text: s.source };
    return { label: host(s.source) || 'Source', url: s.source };
  }

  function showShot(i) {
    const shots = state.shots || [];
    if (!shots.length) return;
    lbIndex = (i + shots.length) % shots.length;
    const s = shots[lbIndex];
    lbImg.src = s.src;
    lbImg.alt = `Screenshot ${lbIndex + 1} of ${shots.length}`;
    const c = shotCredit(s);
    lbCap.replaceChildren();
    const count = document.createElement('b');
    count.textContent = `${lbIndex + 1} / ${shots.length}`;
    lbCap.append(count, document.createTextNode(' · '));
    if (c.url) {
      const a = document.createElement('a');
      a.href = c.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = c.label;
      lbCap.append(a);
    } else lbCap.append(document.createTextNode(c.text && c.text !== c.label ? `${c.label}: ${c.text}` : c.label));
    $$('.lb-prev, .lb-next', lb).forEach((b) => { b.hidden = shots.length < 2; });
    for (const d of [1, -1]) { const n = shots[(lbIndex + d + shots.length) % shots.length]; if (n) new Image().src = n.src; } // preload neighbours
  }
  function openShots(i) {
    lbReturnFocus = document.activeElement;
    lb.hidden = false;
    document.documentElement.classList.add('lb-open');
    showShot(i);
    $('.lb-close', lb).focus();
  }
  function closeShots() {
    if (lb.hidden) return;
    lb.hidden = true;
    document.documentElement.classList.remove('lb-open');
    lbImg.removeAttribute('src');
    lbReturnFocus?.focus?.({ preventScroll: true });
  }
  lb.addEventListener('click', (e) => {
    if (e.target.closest('.lb-close') || e.target === lb) closeShots();
    else if (e.target.closest('.lb-prev')) showShot(lbIndex - 1);
    else if (e.target.closest('.lb-next')) showShot(lbIndex + 1);
  });
  let touchX = null;
  lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) showShot(lbIndex + (dx < 0 ? 1 : -1));
  });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeShots(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showShot(lbIndex + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showShot(lbIndex - 1); }
    else if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $$('button:not([hidden]), a[href]', lb);
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('click', (e) => {
    const shot = e.target.closest('[data-shot]');
    if (shot) openShots(Number(shot.dataset.shot));
  });
  window.addEventListener('hashchange', closeShots);

  function showError(message) {
    let el = $('.error-banner');
    if (!el) { el = document.createElement('div'); el.className = 'error-banner'; el.setAttribute('role', 'alert'); document.body.append(el); }
    el.textContent = `Something went wrong: ${message}`;
  }
  window.addEventListener('error', (e) => showError(e.message || 'script error'));
  window.addEventListener('unhandledrejection', (e) => showError(e.reason?.message || String(e.reason)));
  window.addEventListener('hashchange', route);

  loadData().then(() => {
    $('#footer-stats').textContent = `${DB.games.length} games · updated ${fmtDate(DB.updated)} · hosted on GitHub Pages`;
    route();
  }).catch((err) => {
    main.innerHTML = `<div class="wrap"><div class="notice"><h2>Couldn't load the data</h2><p>${esc(err.message)}</p>
      <p>Serve the <code>docs/</code> folder over HTTP (e.g. <code>node scripts/serve.mjs</code>) rather than opening the file directly.</p></div></div>`;
  });
})();
