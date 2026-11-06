# WristLab — D Watch 7 Decoded Studio

A reverse‑engineered playground for the Chinese D Watch7 smartwatch. It uses the hardware’s native BLE protocol, the vibration motor, the optical sensors and the media buttons to build a web studio with 20 playable games, a protocol lab and a full story.

## What you get

* **20 games** across arcade, action, puzzle, rhythm and strategy — all single HTML files on one shared canvas engine.
* **Live watch telemetry** — battery, heart rate, SpO₂ and blood pressure (one‑shot reads).
* **Protocol Lab** — a real command console: haptic patterns, sensor requests, notifications, time sync, dial codes, raw DF frames and an event log.
* **The full decode** — this page, plus the verified protocol, hardware spec, merged findings and OTA notes.
* **Studio controls** — settings, per‑game stats, data export and reset tools.

## Quick start

### Prerequisites

* Python 3.11 (or higher)
* Windows (Bleak and winrt are optional but required for the watch bridge). Linux/macOS users will need to replace the BLE layer.

Install the optional dependencies with pip:

```bash
pip install -r requirements.txt
```

### Run the studio

From the repository root run the dashboard server (one‑click script included):

```powershell
start.bat
```

or manually:

```bash
python dashboard_server.py
```

The server starts:

* HTTP on `http://127.0.0.1:8080` (serves `index.html` and static assets)
* WebSocket bridges on ports 8780 (primary) and 8765 (secondary)
* Windows SMTC listener for watch media keys
* Bleak BLE worker that auto‑connects to `C2:FC:01:BC:D4:1F`

### Open the dashboard

Navigate your browser to `http://127.0.0.1:8080`. The studio loads with the dashboard. Connect the watch to your machine and power it on; after a few seconds the bridge links and haptics start working.

Everything also works with no watch attached: the games fall back to keyboard/pointer input, and the lab shows a clearly-labelled offline state.

### Verify the build

The repository ships with a Playwright suite that uses your installed Chrome:

```bash
npm install
npx playwright test
```

21 checks cover the SPA shell, the 20-card arcade and every game's start-to-gameplay path (no runtime errors, no missing assets). The server must be running on port 8080.

## How it works

The D Watch7 cannot install third‑party apps, but it does expose a tiny, documented BLE protocol. The studio uses that protocol to:

* **Talk to the watch** – send vibration patterns, sensor requests, notifications and dial changes.
* **Listen to the watch** – read battery, heart rate, SpO₂, blood pressure, and watch button events via the media‑key bridge (Previous/Play/Next map to left/action/right).
* **Drive games** – every game runs in the browser, uses a shared canvas engine and shares high scores via localStorage. The same wrist buttons and haptics work in every game.

For the full technical story, see `DECODED.md`.

## Architecture

* `index.html` – SPA shell with hash router.
* `assets/app.js` – application logic (router, bridge, views).
* `assets/app.css` – full design system.
* `games/engine.js` – shared runtime (canvas, input, haptics, WebAudio).
* `games/registry.js` – metadata for all 20 games.
* `games/*.html` – one self-contained file per game.
* `dashboard_server.py` – unified backend, BLE bridge, WebSocket servers.
* `docs/` – verified protocol, hardware spec, merged findings, OTA notes.
* `_archive/` – APK, decompiled source, logs, captures, legacy pages.

## Adding a game

The studio ships with 20 games already. To add another one:

1. Copy the template:

   ```bash
   copy games/template.html games/my-game.html
   ```

2. Edit `my-game.html`. Write `update(g, dt)` and `draw(g, ctx)`. Use the engine’s canvas helpers, input (`g.keys`, `g.pointer`), haptics (`g.haptic()`), sound (`g.audio.sfx()`), particles, screen shake, and high‑score handling (`g.best`).

3. Register it in `games/registry.js`. The UI, search, filters, stats and manager pick it up automatically.

   The registry object includes: `id`, `title`, `tagline`, `category`, `accent`, `accent2`, `icon`, `featured`, `difficulty`, `controls`, `tips`, `desc` and `file`.

## Files in this repository

| Path | Purpose |
|---|---|
| `index.html` | SPA shell |
| `assets/app.js` | Application shell (router, bridge, views) |
| `assets/app.css` | Complete design system |
| `games/engine.js` | Dependency‑free canvas game runtime |
| `games/registry.js` | Single source of truth for the arcade |
| `games/*.html` | 20 game files |
| `dashboard_server.py` | HTTP, WebSocket and BLE bridge |
| `tests/` | Playwright suite: SPA shell + all 20 games |
| `docs/` | Verified protocol, hardware spec, merged findings (see `docs/README.md`) |
| `_archive/` | Archived research / legacy assets |
| `DECODED.md` | The full reverse‑engineering story |
| `README.md` | This quick‑start guide |
| `start.bat` | One‑click launch script |
| `requirements.txt` | Optional Python dependencies |

## License
MIT – reverse‑engineered, not redistributed firmware.

## Contact
OpenCode agent – built with speed, safety and full documentation.