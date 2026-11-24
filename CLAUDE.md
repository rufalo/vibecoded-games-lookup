# Vibe-Coded Games field guide

A private website cataloguing notable vibe-coded games (games whose code was mostly written by AI). It is published on GitHub Pages at https://rufalo.github.io/vibecoded-games-lookup/ (repo `rufalo/vibecoded-games-lookup`, Pages source `main` → `/docs`). The owner will periodically ask for more games to be researched and added. The owner cares most about: FPS and strategy games, *how* the developer used AI, and *how the art was made* (code-drawn vs AI 2D vs AI 3D vs hand-made/Blender vs asset packs).

## Layout

- `docs/`: the website, served as-is (no build step).
  - `index.html`, `styles.css`, `app.js`: a vanilla-JS single-page app.
    - Hash routes: `#/` (filters in the query string, e.g. `#/?group=shooters&art=ai-2d`), `#/game/<id>`, `#/insights`, `#/radar`, `#/about`.
  - `data/games.json`: one object per game. **This is the source of truth.**
  - `data/taxonomy.json`: every tag, category and filter value, with labels and descriptions. Category tabs come from `genreGroups`.
  - `data/insights.json`: curated cross-game patterns, tooling eras and the Vibe Jam table. The charts on the Insights page compute themselves from `games.json`.
  - `data/radar.json`: candidate games not yet researched.
  - `media/<id>.jpg|webp`: cover images.
- `scripts/`:
  - `serve.mjs`: static server.
  - `validate.mjs`: data checks.
  - `fetch-images.mjs`: cover finder/downloader.
  - `resize-image.ps1`: re-encodes to ≤1280px JPEG.
  - `fetch-gallery.mjs` + `process-images.ps1`: build screenshot galleries (resize, thumbnail, near-duplicate hashing; WebP via WIC).
  - `screenshot.ps1`: headless-Edge page screenshots, with `-ColorScheme dark|light`.
  - `start-server.ps1`, `stop-server.ps1`: run the local preview server in the background.

## Hosting

- **Live site:** GitHub Pages serves `docs/` from `main`. Pushing to `main` redeploys in about a minute (check with `gh api repos/rufalo/vibecoded-games-lookup/pages/builds/latest --jq .status`). `docs/.nojekyll` disables Jekyll. All asset and data paths are relative, so the `/vibecoded-games-lookup/` subpath works.
- **Local preview:** `node scripts/serve.mjs` serves `docs/` on http://127.0.0.1:8210/ with no-cache + ETag, so data edits show on reload.
- After adding games: validate, then commit and push to `main`. The user chose Pages hosting, so pushing data updates is expected.

## Adding a game (the usual request)

1. **Research properly.** Read the creator's own write-up, devlog, repo, or HN/Reddit post first; press coverage second. X/Twitter rarely fetches, so try xcancel.com mirrors or articles quoting the posts. Capture:
   - what it is and what's impressive
   - AI tools and models, AI code share, build time, approach, workflow tricks
   - the art pipeline and art tools, and the audio
   - stack and multiplayer
   - traction (mark self-reported numbers), reception, lessons, sources

   For several games, parallel research subagents writing JSON in this schema worked well.
2. **Add the entry.** Append an object to `docs/data/games.json` in the schema below.
   - Use taxonomy values only. If something genuinely new is needed, add it to `taxonomy.json` with a label and description.
   - Set `addedOn` to today and `rank` to its place in editor's-pick order (renumber others when inserting). Set `pick: true` only for standouts.
   - Never invent facts: unknown → `null`/`"unknown"`; conflicting numbers → say so in the text.
3. **Images.**
   - Put direct image URLs in `imageCandidates` and/or article/store pages in `imagePages`, then run `node scripts/fetch-images.mjs <id>` (`--force` to replace).
   - For a live web game with no og:image: run `scripts/screenshot.ps1 -Url <playUrl> -Out <tmp.png>`, then `scripts/resize-image.ps1 -In <tmp.png> -Out docs/media/<id>.jpg`, and set `image` and `imageSource`.
   - **Look at the result.** og:images are sometimes unrelated stock art or a doc screenshot.
   - No image is fine: a generated cover is shown.
   - **Gallery (screenshots):** aim for 4–8 images that show what the game looks like. Put them in `galleryCandidates` and set `galleryAuto: false`, then run `node scripts/fetch-gallery.mjs --force <id>`. It writes `docs/media/gallery/<id>/NN.jpg` plus `NN-t.jpg` thumbnails and the `gallery` array. Candidate forms:
     - a direct image URL
     - `youtube:<videoId>`: three HD frames of a gameplay video
     - `screenshot:<playUrl>|<waitMs>`: a live headless capture
     - `readme:<githubRepoUrl>`: the images in that repo's README

     Good sources: Steam screenshots (`/api/appdetails`), repo READMEs, the creator's devlog, and gameplay videos (search YouTube). Without `galleryAuto: false`, the script discovers images itself; `--press` also scrapes the cited articles. **Always review a contact sheet**: scraped pages bring in stock photos, "related posts", other games and presenters' faces. Pin the keepers as candidates.
4. **Validate.** `node scripts/validate.mjs` must report 0 errors.
5. **Update the curated files.** If the game strengthens or changes a pattern, update `insights.json` (its `games` lists and points). If it was on the radar, remove it from `radar.json`.
6. **Check the page.** Run `powershell -File scripts/screenshot.ps1 -Url "http://127.0.0.1:8210/#/game/<id>" -Out <png> -Width 1440 -Height 2200` and view it.

## games.json schema

```jsonc
{
  "id": "kebab-case-unique",
  "title": "Game title",
  "tagline": "One punchy sentence, <= 140 chars",
  "rank": 12,                       // editor's-pick order (1 = top)
  "pick": false,                    // star badge for standouts
  "status": "playable",             // taxonomy.status: playable | steam | coming-soon | source-only | offline | unknown
  "playUrl": "https://… or null",
  "links": { "steam": null, "itch": null, "github": null, "video": null, "devlog": null, "creatorPost": null },
  "extraLinks": [{ "label": "…", "url": "…" }],   // optional
  "image": "media/<id>.jpg",        // or null
  "imageSource": "where the image came from",
  "imagePosition": "bottom",        // optional CSS object-position
  "creator": { "name": "…", "handle": "@… or null", "url": "… or null", "background": "short" },
  "released": "YYYY | YYYY-MM | YYYY-MM-DD | null",
  "addedOn": "YYYY-MM-DD",
  "genres": ["fps"],                // taxonomy.genres
  "dimension": "3d",                // 2d | 3d | null
  "perspective": "first-person",    // taxonomy.perspective | null
  "multiplayer": "online",          // none | local | online | mmo | unknown
  "platforms": ["web"],             // taxonomy.platforms
  "event": { "id": "vibe-jam-2026", "place": "gold", "name": "Vibe Jam 2026", "result": "Gold ($25,000)" },  // or null
  "summary": "2–4 sentences",
  "highlights": ["what's cool/impressive"],
  "story": "paragraphs separated by a blank line",
  "vibeCoding": { "tools": ["claude-code"], "models": ["Claude Opus 4.7"], "aiCodeShare": "…", "buildTime": "…",
                  "approach": "jam-sprint", "workflow": ["techniques"] },
  "art": { "pipeline": ["ai-3d", "code-generated"], "style": "…", "tools": ["Tripo3D"], "notes": "…" },
  "audio": { "pipeline": ["ai-music"], "tools": ["Suno"], "notes": "…" },
  "tech": { "stack": ["threejs", "websockets"], "notes": "…" },
  "traction": { "metrics": [{ "label": "…", "value": "…", "asOf": "YYYY-MM", "selfReported": true, "source": "url" }],
                "monetization": "…", "notes": "…" },
  "reception": "… or null",
  "lessons": ["…"],
  "sources": [{ "title": "…", "url": "…" }],
  "confidence": "high",             // high | medium | low (how well documented)
  "imageCandidates": [], "imagePages": [],  // inputs for fetch-images.mjs (cover)
  "gallery": [{ "src": "media/gallery/<id>/01.jpg", "thumb": "media/gallery/<id>/01-t.jpg", "w": 1920, "h": 1080, "source": "url", "origin": "picked|steam|video|live|repo|creator" }],
  "galleryCandidates": ["youtube:…", "https://…jpg"], "galleryAuto": false   // inputs for fetch-gallery.mjs
}
```

## Conventions

- `app.js` escapes every data string before rendering. Only `insights.json` points support `**bold**`.
- Chart colours were validated with the dataviz skill's validator: meter fill `#64a01c` in dark mode, `#5f8f12` in light mode. Art pipelines are told apart by icon plus label, not colour (six identity colours fail the all-pairs check).
- Keep pages working at 390px wide. `screenshot.ps1` can't go below ~500px, so test phones by loading the site in a 390px iframe.
