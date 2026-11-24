<img src="assets/icon.svg" width="64" height="64" alt="">

# Vibecoded games lookup

A private field guide to notable **vibe-coded games**: games where AI wrote most of the code. For each game it covers what the game is, what's impressive, how the developer used AI, how the art and audio were made, the tech, traction and lessons learned, with sources.

**Open it (tailnet only):** http://olipc.tail2a6a2b.ts.net:8210/

## What's in it

- **Games**: 27 researched games (Nov 2026).
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
- **Radar**: 27 candidate games spotted during research but not yet added.

## How it runs

| Piece | What it does |
|---|---|
| `docs/` | The website: static HTML/CSS/JS with no build step. All content lives in `docs/data/*.json`. |
| `scripts/serve.mjs` | Zero-dependency Node server for `docs/` on `127.0.0.1:8210`. |
| `tailscale serve --bg --http=8210 http://127.0.0.1:8210` | Publishes the server to the tailnet (persists across reboots). |
| Startup launcher | `scripts/install-autostart.ps1` put `vibecoded-games-lookup-server.vbs` in the Windows Startup folder, so the server starts at login. |

Handy commands (PowerShell, from the repo root):

```powershell
powershell -File scripts\start-server.ps1        # start the server if it isn't running
powershell -File scripts\stop-server.ps1         # stop it
powershell -File scripts\install-autostart.ps1 -Uninstall   # remove the login autostart
tailscale serve --http=8210 off                  # unpublish from the tailnet
node scripts\validate.mjs                        # check the data files
```

## Adding games

Ask Claude, e.g. *"add Undersphere and Null Range to the guide"*. The workflow and data schema are in [CLAUDE.md](CLAUDE.md). Data edits show up on the next page reload with no restart.

Created in [T3 Code](https://t3.codes).
