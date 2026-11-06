# DECODED — How I decoded the D Watch 7 and built this studio

## The device
A cheap Chinese smartwatch, model D Watch7, paired with the companion app **M2Wear** (package `com.lianhezhuli.mtwear`). Its specs: Freqchip `Fr-BLE-1.0`, firmware `6.1.2`, BLE MAC **C2:FC:01:BC:D4:1F**, optical battery `0x2A19`, haptics via `CMD 0x06 key 0x00 / 0x0F`, three media keys (Prev / Play / Next) over Windows SMTC (AVRCP), and a sealed Bluetooth GATT with two vendor characteristics: write `00002AAD`, notify `00002AAC`.

## The puzzle
It had no SDK, no documentation, no app store, and the firmware refused any custom code. The goal: know everything the hardware says, then use what it leaks to build something it never intended — a web studio with 20 playable games, a protocol lab and a full story.

## The method
I worked backwards from the device, using four independent, cross‑checking sources:

1. **Enumerate the GATT tree** – a Python script connected to the watch, listed every service and characteristic. The only writable endpoint (`2AAD`) was the command port; writing to the notify channel (`2AAC`) silently failed. That was the first real clue.

2. **Decompile the companion APK** – JADX opened M2Wear 6.1.38. The classes `NotifyWriteUtils`, `BleDataUtils` and the protocol constant tables gave the exact frame layout, bind handshake, health decoding and the dial‑code table. Source code became the hypothesis engine.

3. **Capture real traffic** – with the official app connected, I logged every write and notification while tapping the UI. That gave real frames with real checksums, and revealed the rule nobody documents: **ACK every inbound DF frame or the watch goes silent**. Silence is the only trustworthy signal.

4. **Build an ACK‑aware probe** – the first sweep killed the link; once the probe ACKed everything, commands became measurable: an answer, a reject, or silence. The sweep of 6,293 command/key pairs yielded 6,228 answers. Command `0x05` went fully silent – it is a permanent trap.

5. **Verify on hardware** – every claim in the protocol doc was replayed against the physical watch. If it did not physically happen, it did not go in the docs.

The hierarchy matters: live hardware beats decompiled source, and decompiled source beats old notes. Every conflict was resolved in that order.

## The frame
Every command is a **DF frame with a 9-byte header** and a payload of `len - 5` bytes:

```
DF len_hi len_lo CHK cmdId devVer cmdKey dlen_hi dlen_lo payload...
```

`len = payload length + 5` (maximum payload 247 - 9 = 238). `CHK = sum of all bytes except index 3, & 0xFF`. The ACK uses `FD` and **has no checksum** – get it wrong and the watch stops talking.

Example real frame (time sync, captured 2026‑10‑05 20:54:37):

```
DF 00 09 E1 02 04 08 00 04 6A 8B 4D A5
```

(Checksum 0xE1 = sum of DF…payload). The payload is four packed time bytes (`year‑2000`, month, day, hour, minute, second). This matches the parser in `buildTimePayload()`.

## What works (verified live)

| Feature | Command | Notes |
|---|---|---|
| Vibration | `CMD 0x06 / 0x00 on`, `CMD 0x06 / 0x0F off` | Motor responds in ms, needs only bind |
| Heart‑rate query | `CMD 0x06 / 0x04 trigger`, `CMD 0x03 / 0x00 read` | One‑shot, not a stream |
| SpO₂ query | `CMD 0x06 / 0x06 trigger`, `CMD 0x03 / 0x02 read` | Same |
| Blood pressure | `CMD 0x06 / 0x05 trigger`, `CMD 0x03 / 0x01 read` | Same |
| Notifications | `CMD 0x0A / 0x00 app,title,body` | 20‑byte payload |
| Time sync | `CMD 0x02 / 0x08 packed time` | Four‑byte payload |
| Watch faces | `CMD 0x0B / 0x03 dial code` | 24+ built‑in codes |
| Wrist‑shake | `CMD 0x06 / 0x01 arm`, `CMD 0x06 / 0x02 event` | Nitro boost, game events |
| Bind | `CMD 0x08 / 0x00 payload` | Accepts/Bound/Rejected |

Battery over the standard `0x180F / 0x2A19`. Device information strings identify the Freqchip.

## What does not work (dead ends)

* **Tilt streaming (`CMD 0x28 / 0x01`)** – the command is ACKed but never yields any X/Y/Z data. The companion app’s feature parser needs a reply of at least 36 bytes before it enables motion sensing; our watch’s feature reply is only 18 bytes. The 60 Hz G‑sensor engine is simply not compiled into firmware 6.1.2.

* **Wallpaper container (`PAR`)** – opaque native blob, and `supportDiyOnlineWpaper=false` blocks pushes.

* **Command `0x05`** – goes silent and wedges the BLE link for 30–60 s. It is excluded from every game loop and documented as a trap.

* **Video / firmware log (`0x2B`, `0x24`)** – decoded from source but never exercised live.

## The breakthrough
If the firmware will not run my code and the accelerometer will not stream, how do you make a game feel like it belongs on a wrist?

The answer was hiding in the Music screen. The watch pairs as an audio remote over AVRCP. When you press Previous / Play / Next, Windows receives a media command through **System Media Transport Controls**. I registered a silent looping media player, listened for those button events, and measured roughly **0.19 s** from thumb to browser.

`Previous → left. Play/Pause → action. Next → right.`

Three physical buttons, low latency, zero firmware modification. Combined with the vibration motor, that is a complete input/output loop: the watch sends the command, the game sends back a buzz.

## What I’m building now

**WristLab** is a studio, not a demo. It has five surfaces:

1. **Dashboard** – live watch, battery, heart rate, recent runs and one‑tap hardware actions.
2. **Arcade** – 20 original games across arcade, action, puzzle, rhythm and strategy, all registered in one metadata file.
3. **Protocol Lab** – real command console: haptic patterns, optical sensors, notifications, time sync, dial codes, raw DF frames and a live event log.
4. **The Decode** – this page, plus the full technical documents.
5. **Manage** – settings, per‑game stats, data export, reset, and the recipe for adding a game.

The architecture in one paragraph:

`games/engine.js` is a dependency‑free canvas runtime: fixed 960×600 stage, responsive scaling, WebAudio synth, particles, screen shake, unified input, localStorage high scores, and a WebSocket bridge to the watch. Every game is a single HTML file that calls `WristGame.mount({...})`. `games/registry.js` is the only place the UI learns a game exists. `dashboard_server.py` serves the studio, bridges BLE through Bleak, ACKs frames, and publishes state to every open tab on port 8780.

Adding a game is three steps:

1. Copy `games/template.html` → `games/my-game.html`.
2. Write `update(g, dt)` and `draw(g, ctx)` in that file.
3. Add one object to `games/registry.js`.

The arcade, search, filters, high scores, dashboard and manager pick it up automatically.

## Why 20 games instead of 7 prototypes?

The first generation of watch games were one‑off experiments with different input models and no shared score contract. Rebuilding them on one engine proved the abstraction: the same wrist buttons, the same haptics, the same lifecycle can support a snake game, a rhythm runner, a 2048 board and a turn‑based artillery duel. If the engine holds under 20 genres, it will hold under the next 20.

## What’s next (the open problems)

* **True HR streaming** – currently one‑shot. If firmware 6.1.2 can be coaxed into a live push, or if the standard `0x2A37` characteristic appears, games can react to stress in real time.

* **Wallpaper / PAR** – the native encoder is missing; custom dials stay blocked.

* **OTA, carefully** – documented but flashing a $30 watch is how you brick it. This stays read‑only until there is a recovery path.

* **More input** – wrist‑shake works as a discrete event. A game that uses it as a deliberate “boost” gesture is the next experiment.

* **Mobile** – the studio is responsive, but the bridge is a Windows process. A phone‑first companion is a different product decision.

## Safety rails

The bridge denylists factory‑reset and unbind commands, rate‑limits dial changes, ACKs every inbound frame, and never probes `0x05` in a game loop. The raw console is powerful; the rails are deliberate.

## How you can run this locally

1. Install Python 3.11 and pip.
2. Install optional Windows dependencies (bleak, websockets, pywinrt):

   ```powershell
   pip install -r requirements.txt
   ```

3. From the repository root run the dashboard server:

   ```powershell
   python dashboard_server.py
   ```

   This starts:
   * HTTP on `http://127.0.0.1:8080` (serves `index.html` and static assets)
   * WebSocket bridges on ports 8780 (primary) and 8765 (secondary)
   * Windows SMTC listener for watch media keys
   * Bleak BLE worker that auto‑connects to `C2:FC:01:BC:D4:1F`

4. In your browser navigate to `http://127.0.0.1:8080`. The studio loads with the dashboard. Connect the watch to your machine and power it on; after a few seconds the bridge links and haptics start working.

## Files in this repository

* `index.html` – SPA shell with hash router.
* `assets/app.js` – application logic (router, bridge, views).
* `assets/app.css` – full design system.
* `games/engine.js` – shared runtime.
* `games/registry.js` – metadata for all 20 games.
* `games/*.html` – 20 self-contained game files, one per game.
* `dashboard_server.py` – unified backend, BLE bridge, WebSocket servers.
* `docs/` – verified protocol, hardware spec, merged findings, OTA notes.
* `_archive/` – APK, decompiled source, logs, captures, legacy pages.
* `README.md` – quick-start guide.
* `DECODED.md` – this document.
* `start.bat` – one‑click launch script.
* `requirements.txt` – optional Python dependencies.

## License
MIT – reverse‑engineered, not redistributed firmware.

---

*If the watch never speaks, the protocol is quiet; you must listen to the silence. That is what I did.*