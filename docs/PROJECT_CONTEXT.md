# WristLab — Full Project Context

Use this as source material for a LinkedIn post, talk, or write-up. Every number below is from the verified protocol doc and the live hardware, not from marketing.

## One-liner

A $30 Chinese smartwatch had no SDK, no app store, no docs. Six months later it runs 20 browser games, a protocol lab, and live heart-rate / SpO2 / blood-pressure reads. No firmware was modified. No jailbreak. Just BLE, a media-key trick, and a lot of packet sniffing.

## The device

- Model: D Watch 7 (sold under a dozen names; the retail box reads "i7 PRO")
- SoC/radio: Freqchip Fr-BLE-1.0
- Firmware: 6.1.2, device version 0x04
- BLE MAC: C2:FC:01:BC:D4:1F
- MTU: 247 bytes
- Screen: 240x280 (per firmware; the retail box claims 320x320)
- Battery: standard GATT 0x180F / 0x2A19
- Three physical buttons: Prev / Play / Next
- A buzzer (marketed as a vibration motor)
- Optical heart-rate sensor
- Companion app: M2Wear 6.1.38, package `com.lianhezhuli.mtwear`
- No app store, no JavaScript runtime, no SDK, no public documentation

## The goal

Know everything the hardware says over Bluetooth, then build something it never intended: a web studio with playable games, a protocol lab, and the full story. Everything had to be built on what the hardware actually exposes.

## The method (six months, six phases)

1. Enumerate the GATT tree. A Python + Bleak script dumped every service and characteristic. Two vendor characteristics stood out: 0x2AAD accepted writes, 0x2AAC pushed notifications. Writing to the notify characteristic silently failed. First real clue.
2. Decompile the companion app. JADX opened M2Wear 6.1.38. The classes `NotifyWriteUtils`, `BleDataUtils`, and the protocol constant tables gave the exact frame layout, bind handshake, health decoders, and dial-code table. Source code became the hypothesis engine.
3. Capture real traffic. With the official app connected, every write and notification was logged while tapping through the UI. That produced real frames with real checksums and revealed the rule nobody documents: ACK every inbound DF frame or the watch goes silent.
4. Build an ACK-aware probe. The first sweep killed the link. Once the probe ACKed everything, commands became measurable: an answer, a reject, or silence. Silence turned out to be the only trustworthy signal.
5. Sweep the command space. 6,293 command/key pairs, 6,560 frames sent: 6,228 answered. Only command 0x05 went fully silent.
6. Verify on hardware. Every claim in the protocol doc was replayed against the physical watch. If it did not physically happen, it did not go in the docs.

Hierarchy used to resolve conflicts: live hardware beats decompiled source, decompiled source beats old notes.

## The protocol (verified)

Frame: `DF len_hi len_lo CHK cmdId devVer cmdKey dlen_hi dlen_lo payload...`
- `len = payload length + 5`
- `CHK = sum of every byte except index 3, & 0xFF`
- ACK: a 9-byte `FD` frame with no checksum
- Write to `00002AAD`, notify on `00002AAC`
- Bind: `0x08 / 0x00` with an 8-character payload; reply tells you accepted / already bound / rejected

Verified live:
- Vibration (motor): `CMD 0x06 / 0x00` on, `CMD 0x06 / 0x0F` off
- Heart rate: `CMD 0x06 / 0x04` trigger, `CMD 0x03 / 0x00` read
- SpO2: `CMD 0x06 / 0x06` trigger, `CMD 0x03 / 0x02` read
- Blood pressure: `CMD 0x06 / 0x05` trigger, `CMD 0x03 / 0x01` read
- Notifications: `CMD 0x0A / 0x00` (app, title, body)
- Time sync: `CMD 0x02 / 0x08` (four packed time bytes)
- Watch faces: `CMD 0x0B / 0x03` (24+ built-in dial codes)
- Wrist shake: `CMD 0x06 / 0x01` arm, `CMD 0x06 / 0x02` event

Everything is one-shot reads, not streams. Heart rate needs 20s, blood pressure ~25s.

## Dead ends (the honest part)

- Tilt streaming (`CMD 0x28 / 0x01`): acknowledged, but never yields X/Y/Z. The companion app's feature parser needs a reply of at least 36 bytes before enabling motion sensing; this watch's feature reply is only 18 bytes. The 60 Hz G-sensor engine is not compiled into firmware 6.1.2. No streaming.
- Wallpaper container (PAR): opaque native blob in `libabpartool.so`. `supportDiyOnlineWpaper=false`, so even a perfect decoder would be refused.
- Command 0x05: goes silent and wedges the BLE link for 30-60s. The only command family that behaved that way across the full sweep. Permanently denylisted.
- Video (`0x2B`) and firmware log (`0x24`): decoded from source, never exercised live. Documented as unverified, not sold as features.

## The breakthrough

The firmware would not run my code and the accelerometer would not stream. So the input had to come from somewhere else. It came from the Music screen.

The watch pairs as an audio remote over AVRCP. Press Previous / Play / Next and Windows receives a media command through System Media Transport Controls. I registered a silent looping media player, listened for those button events, and measured roughly 0.19s from thumb to browser.

Three physical buttons, low latency, zero firmware modification. The browser is the console, the Python bridge is the cartridge slot, the watch is the controller.

## What shipped (WristLab)

Five surfaces:
1. Dashboard: live instrument, BLE bridge status and battery, four optical vitals, one-shot heart-rate trace, wrist commands with real opcodes.
2. Arcade: 20 original games across arcade, action, puzzle, rhythm, strategy, all single HTML files on one shared canvas engine, registered in one metadata file.
3. Protocol Lab: real command console, haptic-free (see below), optical sensors, notifications, time sync, dial codes, raw DF frames, live event log.
4. The Decode: the full story page plus the technical documents.
5. Manage: settings, per-game stats, data export, reset, the three-step recipe for adding a game.

Architecture in one paragraph: `games/engine.js` is a dependency-free canvas runtime (fixed 960x600 stage, responsive scaling, WebAudio synth, particles, screen shake, unified input, localStorage high scores, WebSocket bridge to the watch). Every game is a single HTML file calling `WristGame.mount({...})`. `games/registry.js` is the only place the UI learns a game exists. `dashboard_server.py` serves the studio, bridges BLE through Bleak, ACKs frames, publishes state to every open tab on port 8780.

Adding a game is three steps: copy `games/template.html`, write `update(g, dt)` and `draw(g, ctx)`, add one object to `games/registry.js`.

## Two honest bits

1. The "vibration motor" is a buzzer. It blocks the BLE link for 30-60s after one command, so it cannot be used as a real-time output. I removed haptics from the product and documented the buzzer as not usable instead of faking it.
2. The ACK frame is 9 bytes with no checksum in the docs, 10 bytes with a checksum byte in the code. I left it alone until I can verify on hardware. Guessing on a $30 watch is how you brick it.

## Numbers

- 6 months of research
- 6,293 command/key pairs swept
- 6,560 frames sent
- 6,228 answers
- 1 hostile command family (0x05)
- ~0.19s thumb-to-browser latency via the media-key bridge
- 20 games on one engine
- 23 Playwright checks (SPA shell, arcade, theme, dotfile/CORS, every game's start-to-gameplay path)
- 0 firmware modifications, 0 jailbreaks

## What I learned

- Reverse engineering is mostly negative results. That is fine. The dead ends (no accelerometer, opaque wallpaper container, hostile command 0x05) defined the project more than the successes.
- Silence is the only trustworthy signal. An answer can be a reject; silence means the device did not understand.
- Read the decompiled source before guessing. The frame layout, bind handshake, health decoders, and dial table all came from JADX, not from probing.
- Live hardware beats decompiled source, and decompiled source beats old notes. Every conflict was resolved in that order.
- A locked-down device can still be useful if you find the one channel it does expose. Here it was AVRCP media keys, which cost nothing to use.
- Do not fake a feature. The buzzer is documented as not usable; the docs say so.

## Links

- Repo: https://github.com/MUHAMMADUSAMA64874/Dwatch7
- Protocol: `docs/PROTOCOL.md`
- Hardware spec (evidence-graded): `docs/WATCH_SPEC.md`
- Merged findings: `docs/MERGED_PROTOCOL_AND_FINDINGS.md`
- OTA notes: `docs/OTA.md`
- Full narrative: `DECODED.md`
- Video demo: [attach]

## Suggested post shape (if you want one)

Hook: "I bought a $30 Chinese smartwatch. It had no SDK. Six months later it runs 20 games."

Body: the six phases in 2-3 lines each, the breakthrough, the two honest bits.

Close: the repo link and the video. No fake-profound closer. End on the concrete thing: "Repo: ... Video: ..."
