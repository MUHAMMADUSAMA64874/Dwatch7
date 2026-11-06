# DWatch7 — MERGED Single Source of Truth
> Merged from: `PROJECT_SUMMARY.md` + `PROTOCOL_REFERENCE.md` (OLD, Sep 2026)
> + `new finding/` (`PROTOCOL.md`, `WATCH_SPEC.md`, `OTA.md`, `CONTEXT.md`, `HANDOFF.md`, `NEXT_TESTS.md`)
> Date merged: 2026-10-05

## 0. Hierarchy — what to trust
1. **`PROTOCOL.md`** = master verified protocol (live BLE + M2Wear 6.1.38 decompile). Wins on every conflict.
2. **`WATCH_SPEC.md`** = evidence-graded hardware spec (VERIFIED-LIVE / SOURCE-BACKED / SUPPORTED / UNKNOWN).
3. **`_unsupported/unverified_notes.md`** = list of everything in the OLD docs that was WRONG. Read before trusting any old note.
4. OLD `PROTOCOL_REFERENCE.md` / `PROJECT_SUMMARY.md` / root `index.html` = UI shell only; frames must be re-verified (wrong cmd-0x00 key table, wrong MAC, wrong len/checksum/ACK description).

## 1. Device (verified live — use this, not old MAC)
- Name `D Watch7`, MAC **`C2:FC:01:BC:D4:1F`** (old `5A:60:A4:30:28:60` was a different unit/random address)
- Freqchip `Fr-BLE-1.0`, fw `6.1.2`, `DEVICE_VERSION=0x04` (0x00 before features reply), MTU 247
- Battery 68% (older log) / 92% (2026-10-05 tier run) via standard `0x180F/0x2A19`
- Companion app M2Wear 6.1.38 `com.lianhezhuli.mtwear`

## 2. GATT map (verified)
| Service | Char | Props | Purpose |
|---|---|---|---|
| `000018AC` | `00002AAD` | write / write-no-rsp | **command TX — always write here** |
| `000018AC` | `00002AAC` | notify | **command RX** (writing here silently fails) |
| `0000180F` | `00002A19` | read/notify | battery % |
| `0000180A` | `2A29/2A24/2A25/2A26/2A27` | read | Freqchip / Fr-BLE-1.0 / 1.0.0.0-LE / 6.1.2 / 1.0.0 |
| `000018A8` | `00002AA9` / `00002AA8` | write / notify | OTA channel (present, never flashed in this project) |
| `0000FE00` | `FF01/FF02/FF00` | w/n/r | vendor, no responses observed |
| `00003802`/`00003803` | `00004A02`/`00004A03` | notify | pay / bus-code — **absent on this unit** |

## 3. Frame format (corrected — old docs were off by one)
```
DF len_hi len_lo CHECKSUM cmdId devVer cmdKey payLen_hi payLen_lo payload...
FD 00 06 CHECKSUM cmdId devVer cmdKey 00 01 status   (watch->app status, 10 B)
FD 00 06 cmdId ver cmdKey 00 01 status              (app->watch ACK, 9 B, NO checksum byte)
```
- `len = payload length + 5` (old docs said "bytes after header" — wrong)
- `CHECKSUM = sum of all bytes except index 3, & 0xFF`
- `devVer = 0x00` until features reply, then `0x04`
- Reassemble split notifications until `len+4` bytes; **ACK every inbound DF** or watch goes silent
- Generic reject (95x observed, always identical): `FD 00 06 16 04 04 00 00 0A 01` — always reports cmd `0x04`/key `0`, so it is link-level and can NEVER be charged to a probed pair

## 4. What works 100% (confirmed live)
- BLE connect + bind `CMD 0x08 key 0` (payload `01`=bound, `02`=accepted, `03`=rejected) + battery
- **Vibration motor**: `CMD 0x06 key 0x00` on / `key 0x0F` off, ACK `0xFD`, physically vibrates. Patterns: pulse 90 ms (near-miss), turbo 380 ms (boost), crash double-thump 220+320 ms, heartbeat 100/100/100 ms
- **Wrist-shake trigger**: arm with `CMD 0x06 key 0x01`, shake fires `CMD 0x06 key 0x02` → ACK with payload `01`, re-arm after 250 ms / every 15 s keepalive
- **HR/BP/SpO2 reporting (CONFIRMED with payloads)**: triggers `(6,4/5/6)` payload `01` → DF records HR 72/88 bpm, BP 112/72 + 121/71, SpO2 97/95/95%; unsolicited `(3,1)`/`(3,2)` 12 B pushes; decode per `BleDataUtils.handleHealthData` (frame bytes 9–10 packed date, 11–12 count BE, 8-B records from offset 13; HR/SpO2 at +7, BP hi/lo at +6/+7). See `health_decode.py`. Not medical-grade
- Sync/today `(1,0/1)`, settings blob `(2,6)` 47 B, sports `(4,0/13/21)`, notification push `(0x0A key 0)` accepted, dial switching `(11,3)` 24+ codes + custom dial `(11,4→5)` readback `800300140014ffff040102`, battery cmds `(17,0/2/4)`, timezone/clock, NFC/ChatGPT/nav/menstrual/reminder/QR opcodes ACK
- 3D game + telemetry engine (Three.js 60 FPS), keyboard `A/D/arrows` steer, `W/Up` boost, pointer-drag steer fallback

## 5. Core bottleneck — why tilt does nothing (from `NEXT_TESTS.md` §2)
- `CMD 0x28 key 0x00` (prepare `00 00 00 00 64`, start `gidHi gidLo 01 00 64`, exit `... 04 00 64`) is ACKed (`0xFD`) but **never yields a single `0x28 key 0x01` data frame** with X/Y/Z
- M2Wear `NotifyWriteUtils.java:614-628` requires reply `>=36 B` to set `isMotionSensingGame=true`; our features reply is only 18 B → even stock app sets it `false`
- Verdict: FW `6.1.2` has `0x28` in its table but the 60 Hz G-sensor streaming engine is **not compiled into this ROM**. Same class of problem as HR-streaming: sensor exists, chip supports it, firmware may not push it
- Blind sweep (6,293 pairs, 6,560 frames): **6,228 answered, only cmd 5 silent** — ACK≈96% so ACK is useless as filter, only silence is informative. Denylist = **cmd 5 keys 0–63** (WEATHER_INFO_ID unsupported + link-perturbing: each batch wedges link ~30–60 s). `(1,0)`/`(20,0)` revived (answered), `(5,33)` reject is link-level not pair-level, `(2,18)`/`(11,1)` answered on re-probe

## 6. `NEXT_TESTS.md` verdict → what was implemented (this repo)
**Heart-rate game: technically possible but unverified until probed.** Watch measures HR internally and Freqchip SDK supports HRP; unknown is whether FW pushes it live or only one-shot. Honest experiment:
1. Send HR query `CMD 0x03`/`0x06` — observe single vs stream (`hr_probe.py --target HR`)
2. Check GATT notify `0x2A37` (standard HR Measurement) — subscribe if present
3. Poll every 1–2 s if no stream (still usable as stress signal)
4. Log timestamped readings sitting → walking → jumping jacks; live/responsive = success

Because tilt-streaming is dead, the recommended build is the **Hybrid Controller**:
- Keyboard `A/D` = steering (precise), watch = haptics + shake-macro
- `shake (0x06/0x02)` → nitro boost + optional PC keystroke (Space/Shift)
- `crash` → strong double vibration, `near-miss` → quick pulse, `turbo` → long buzz, `low-HP` → heartbeat
- New: **HR loop** drives 5 bio-mechanics (implemented in `game_server.py` + `game.html` + `hub.html`):
  1. Stress-responsive world (glitch/desat/distort scales with BPM)
  2. Traffic density = HR (faster/denser with BPM)
  3. Adrenaline turbo (BPM>120 + nitro>20 → auto-boost)
  4. Cool-under-pressure scoring (fast + calm = bonus)
  5. Haptic biofeedback (BPM>threshold → heartbeat-synced vibration)

## 7. File map (consolidated root)
| File | Purpose | Status |
|---|---|---|
| `game_server.py` | HTTP (8000/8080/8088) + WS 8765 + BLE bridge: tilt 0x28 + shake-macro + haptics + **HR poll loop** | ✅ extended |
| `common/games/motorcycle-alt.html` | Cyber-Moto 3D game: keyboard+tilt steer, shake=nitro, haptics, **HR HUD + 5 bio-mechanics** | ✅ extended |
| `hub.html` | Shake-macro + haptic soundboard + **HR panel** | ✅ extended |
| `motion_sim.html` | 3D telemetry workbench (sliders/virtual + live) + HR readout | ✅ extended |
| `hr_probe.py` | **NEW** honest HR experiment: trigger/poll/log/decode | ✅ new |
| `health_decode.py` | HR/BP/SpO2 capture + decode reference | ✅ |
| `sweep.py`, `reprobe.py`, `selftest.py`, `no_reply.py` | sweep/attribution framework (journal attribution, 3-outcome model) | ✅ |
| `PROTOCOL.md`, `WATCH_SPEC.md`, `OTA.md`, `CONTEXT.md`, `HANDOFF.md` | verified docs | ✅ |
| `index.html` (root) | old Web-BLE controller — UI shell only, needs frame-table fix per §0 | ⚠️ legacy |
| `PROJECT_SUMMARY.md`, `PROTOCOL_REFERENCE.md` (root) | superseded by this file + `PROTOCOL.md` | ⚠️ archived |

Run:
```powershell
python hr_probe.py --target HR        # honest HR test (needs watch on + in range)
python game_server.py                 # then open http://127.0.0.1:8000/common/games/motorcycle-alt.html
# hub:  http://127.0.0.1:8000/hub.html
# sim:  http://127.0.0.1:8000/motion_sim.html
```
Safety: never send `(2,0x2A)/(2,0x2B)` (factory/unbind), `(2,0x09–0x0E)` reserved, `(8,0x01)` unbind, `(2,0x09)` restore-factory; dial changes ≤8/run then 5–10 min cooldown; always ACK inbound DF; treat cmd 5 as silent+perturbing (don't probe in game loop).
