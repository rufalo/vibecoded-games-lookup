<img src="assets/icon.svg" width="64" height="64" alt="">

# Vibecoded games lookup

A private field guide to notable **vibe-coded games**: games where AI wrote most of the code. For each game it covers what the game is, what's impressive, how the developer used AI, how the art and audio were made, the tech, traction and lessons learned, with sources.

**Open it:** https://rufalo.github.io/vibecoded-games-lookup/

## What's in it

- **Games**: 37 researched games (Nov 2026).
  - Search, plus category tabs: Shooters & FPS, Strategy & building, MMOs & open worlds and more.
  - Filters: art pipeline, AI tool, players, availability, build approach, engine and game jam.
  - Card view or comparison-table view.
- **Game pages**:
  - Summary, highlights, and how it was vibe-coded (tools, models, % AI code, build time, workflow tricks).
  - Art & audio pipeline, tech, and traction (self-reported numbers are flagged).
  - Story, reception, lessons, sources and similar games.
- **Insights**: charts computed live from the data, plus:
  - 12 cross-game patterns (art pipelines, specs as AI memory, agent swarms, netcode, money, data quality and more).
  - A timeline of how the tooling evolved, and Vibe Jam 2025 vs 2026.
- **Radar**: 17 candidate games spotted during research but not yet added.

## How it runs

| Piece | What it does |
|---|---|
| `docs/` | The website: static HTML/CSS/JS with no build step. All content lives in `docs/data/*.json`. |
| GitHub Pages | Publishes `docs/` from the `main` branch. Every push to `main` redeploys. |
| `scripts/serve.mjs` | Zero-dependency local preview server for `docs/` on `127.0.0.1:8210`. |

Handy commands (PowerShell, from the repo root):

```powershell
powershell -File scripts\start-server.ps1        # local preview at http://127.0.0.1:8210/
powershell -File scripts\stop-server.ps1         # stop the preview server
node scripts\validate.mjs                        # check the data files
```

## Adding games

Ask Claude, e.g. *"add Undersphere and Null Range to the guide"*. The workflow and data schema are in [CLAUDE.md](CLAUDE.md). Changes go live about a minute after they are pushed to `main`.

Created in [T3 Code](https://t3.codes).
