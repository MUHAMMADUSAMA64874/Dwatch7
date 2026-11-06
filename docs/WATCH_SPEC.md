# D Watch7 — Hardware Spec

> Evidence-graded spec for the unit on the bench (`C2:FC:01:BC:D4:1F`).
> **VERIFIED-LIVE** = seen on BLE in this project · **SOURCE-BACKED** = M2Wear 6.1.38 sources · **INFERRED** = likely, not proven · **UNKNOWN** = watch never reports it over BLE.
> Raw evidence: `tier_identity.txt`, `tier_health.txt`, `tier_misc.txt`, `tier_settings_read.txt`, `tier_bind.txt`, `PROTOCOL.md`, `discovery/`.

---

## 1. Identity — VERIFIED-LIVE

| Item                                  | Value                                        | Source                  |
| ------------------------------------- | -------------------------------------------- | ----------------------- |
| Marketing name                        | `D Watch7`                                   | BLE adv name            |
| BLE MAC                               | `C2:FC:01:BC:D4:1F`                          | all tier logs           |
| Manufacturer (GATT `0x2A29`)          | `Freqchip`                                   | `tier_identity.txt:4`   |
| Model (GATT `0x2A24`)                 | `Fr-BLE-1.0`                                 | `tier_identity.txt:5`   |
| Serial (GATT `0x2A25`)                | `1.0.0.0-LE`                                 | `tier_identity.txt:6`   |
| HW rev (GATT `0x2A27`)                | `1.0.0`                                      | `tier_identity.txt:7`   |
| FW rev (GATT `0x2A26`)                | `6.1.2`                                      | `tier_identity.txt:8`   |
| SW rev (GATT `0x2A28`)                | raw `00 20 7F 01 20` — not ASCII, ignore     | `tier_identity.txt:9`   |
| Protocol `DEVICE_VERSION`             | `0x04` (after features reply; `0x00` before) | `PROTOCOL.md §2`        |
| Negotiated MTU                        | `247`                                        | every tier connect line |
| Battery at capture (2026-10-05 20:52) | **92%** via standard `0x180F/0x2A19`         | `tier_identity.txt:10`  |
| Companion app                         | M2Wear `6.1.38` (`com.lianhezhuli.mtwear`)   | decompile + bind tier   |

---

## 2. Chipset / platform

| Item                           | Value                                | Grade                |
| ------------------------------ | ------------------------------------ | -------------------- |
| Vendor                         | **Freqchip**                         | VERIFIED-LIVE (GATT) |
| Board string                   | `Fr-BLE-1.0`                         | VERIFIED-LIVE (GATT) |
| Exact SoC (e.g. FR800x/FR60xx) | **UNKNOWN** — watch never reports it | —                    |
| RAM / flash / CPU speed        | **UNKNOWN** — not exposed over BLE   | —                    |

Freqchip = low-power BLE SoC family for bands/watches. `Fr-BLE-1.0` is a board/BLE-module string, not the die — do not quote a part number without a teardown or vendor listing.

---

## 3. Radios / GATT interfaces — VERIFIED-LIVE

| Service  | Char               | Props                | Purpose                        | Status                             |
| -------- | ------------------ | -------------------- | ------------------------------ | ---------------------------------- |
| `0x18AC` | `0x2AAD`           | write / write-no-rsp | **command TX (phone → watch)** | live, all tiers                    |
| `0x18AC` | `0x2AAC`           | notify               | **command RX (watch → phone)** | live, all tiers                    |
| `0x180F` | `0x2A19`           | read / notify        | battery %                      | live, 92%                          |
| `0x180A` | `2A29/24/25/26/27` | read                 | device info (table above)      | live                               |
| `0x18A8` | `0x2AA9`           | write                | **OTA TX**                     | present, never exercised           |
| `0x18A8` | `0x2AA8`           | notify               | **OTA RX**                     | present, never exercised           |
| `0xFE00` | `FF01/FF02/FF00`   | w / n / r            | vendor channel                 | present, **no responses observed** |
| `0x3802` | `0x4A02`           | notify               | ZFB/Alipay pay                 | **absent on this unit**            |
| `0x3803` | `0x4A03`           | notify               | bus-code / AliAuth             | **absent on this unit**            |

> Always write commands to `2AAD` — writes to `2AAC` fail silently (`PROTOCOL.md §1`).
> OTA cmds `(12,0–3)` + `(32,1–2)` all ACK (`tier_misc.txt:4–11,65–69`), so the OTA bootloader path exists in firmware, but no OTA blob was pushed in this project.

<!--PART2-->

## 4. Power

- Battery reporting: standard BAS `0x180F` (GATT read) **plus** protocol cmds `(17,0/2/4)` all `status=0` (`tier_health.txt:27–35`, `tier_identity.txt:11`).
- Battery mAh / charger / endurance: **UNKNOWN** — not exposed over BLE. Check the box/listing.
- Power-saving mode cmds exist (`getPowerSavingMode` / `setPowerSavingMode`, cmd 17 oracle) but were not exercised beyond those three ACKs.

---

## 5. Sensors — proven vs. merely accepted

> ACK ≈ 96% on this watch, so a lone `FD status=0` only proves firmware _accepts_ the opcode, not that hardware sits behind it. `CONFIRMED` needs a data payload, an unsolicited push, or a GATT characteristic.

### 5.1 CONFIRMED (live data on the wire)

| Sensor / cluster                                   | Evidence                                                                                                                                                                                             | Log                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **HR/BP/SpO2 reporting** (hardware layout unknown) | App-equivalent requests `(6,4/5/6)` payload `01` produced decoded DF records: HR 72/88 bpm, BP 112/72 and 121/71, SpO2 97/95/95%. Watch-reported, not medical-grade.                                 | `health_capture_20261005_220231.log`; `health_capture_20261005_220612.log` |
| **Health-blob push engine**                        | Unsolicited `DF (3,1)` 12B `354500010001259f00007048` + `DF (3,2)` 12B `35450001000125a000000061` mid-session (these decode as BP 112/72 and SpO2 97%; `3545` does not prove shared sensor hardware) | `tier_health.txt:39,43`                                                    |
| **Activity / sports tracking**                     | `(4,0)`, `(4,13)`, `(4,21)` + health queries `(3,0/8/10)` ACK; sync-data `(1,0/1)` answered in reprobe (daily/step channel)                                                                          | `tier_health.txt:12–26`                                                    |
| **Battery fuel-gauge**                             | GATT `0x2A19` = 92%                                                                                                                                                                                  | `tier_identity.txt:10`                                                     |

**Decode (verified against M2Wear `BleDataUtils.handleHealthData`):** `DF` cmd 3 key 0/1/2 is HR/BP/SpO2. Full-frame bytes 9–10 are packed date, 11–12 record count (big-endian); each 8-byte record starts at frame offset 13, with 4-byte time, mode at +4, HR/SpO2 at +7 or BP high/low at +6/+7. The old 12-byte payloads hold one 8-byte record. A timestamp must be decoded separately before calling any record a current reading. Optical module count and medical accuracy remain unverified. See `health_decode.py`.

### 5.2 SUPPORTED (firmware accepts — hardware probable, payload not captured)

| Function                  | Command                      | Result                             | Note                                                                                  |
| ------------------------- | ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| HR / BP / SpO2 measure    | `(6,4/5/6)`                  | **DF results captured**            | `01` payload per app source; results and decode documented in §5.1 above              |
| Sports control            | `(4,0/13/21)`                | `status=0`                         | start/query-style opcodes per oracle                                                  |
| Settings blob             | `(2,6)`                      | **47B DF payload**                 | real settings dump incl. feature flags — parse pending                                |
| Custom-face readback      | `(11,4)` → `(11,5)`          | 11B reply `800300140014ffff040102` | display pipeline alive (not a sensor)                                                 |
| Find-watch (vibrator)     | `(6,0)`                      | `status=0`                         | implies a **vibration motor** — confirm by feel, nobody held it during the run        |
| Clock / RTC               | `(9,0/1)` + `(2,8)` set-time | `status=0`                         | RTC present (trivially true)                                                          |
| NFC                       | `(56,1/2/8/11)`              | all `status=0`                     | controller **likely** present — no card UID ever read back, stays SUPPORTED           |
| Voice/AI path             | `(30,8/9/16/17)` ChatGPT     | all `status=0`                     | suggests mic/speaker firmware path; no audio captured — needs a real voice round-trip |
| Nav / GPS relay           | `(24,0/1/2/3/5)`             | all `status=0`                     | **phone-relayed** GPS (`sendLocation`), no evidence of onboard GNSS                   |
| Menstrual / reminder / QR | `(25,…)` `(19,…)` `(18,…)`   | all `status=0`                     | pure firmware features, no sensor                                                     |

### 5.3 ABSENT on this unit

- **Env sensors behind cmd 5**: `WEATHER_INFO_ID` — all 64 keys silent incl. `(5,0)` triple-verified, and each batch wedges the link ~30–60 s. No barometer/thermometer there; weather is phone-pushed (and this fw even rejects the push). Denylist: `PROTOCOL.md §12`.
- **Payment / bus-code applets**: `0x3802`/`0x3803` never answer — absent or disabled.
- **Acid QR bytes**: `(18,0/1)` ACK but never return QR bytes in our runs (app path only).

### 5.4 UNKNOWN (never exposed over BLE)

Skin temp, ambient-light, compass/magnetometer, altimeter, ECG, mic/speaker part numbers, button count, IP rating, display size/resolution/touch type. Fill from vendor listing or teardown, grade as `VENDOR-CLAIMED`.

## 6. Actuators / I/O + firmware snapshot

| Part                    | Evidence                                                       | Grade                                 |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------- |
| Vibration motor         | `(6,0)` find + `(6,15)` stop-find `status=0`                   | SUPPORTED (confirm by feel)           |
| Display pipeline        | `(11,4)→(11,5)` live 11B reply; `(11,1)` answered in follow-up | CONFIRMED (pipeline, not panel specs) |
| Speaker / mic           | ChatGPT opcodes ACK                                            | SUPPORTED only                        |
| Buttons / crown / touch | nothing over BLE                                               | UNKNOWN                               |
| NFC coil                | `(56,…)` ACKs                                                  | SUPPORTED only                        |

Firmware: 64 cmds in oracle, ~6,293 pairs swept, only cmd 5 dead. Talking set: `0` features, `1` sync, `2` settings (keys → 66), `3` health, `4` sports, `6` measure/control, `7` app-control, `8` bind, `9` timezone, `11` faces, `12/32` OTA, `13` QR, `17` battery, `18` acid, `19` reminders, `24` nav, `25` menstrual, `30` chatgpt, `39` FM/MTU, `47` wechat-mac, `56` NFC, `243` device-info. Denylist: `PROTOCOL.md §12`.

---

## 7. What to add (and how)

1. **Decode `(3,1)/(3,2)` 12B pushes** — trigger `(6,4/5/6)`, then read `(3,0/8/10)` immediately; diff the blobs. Turns the optical cluster from CONFIRMED-present into CONFIRMED-decoded.
2. **Feel-test `(6,0)`** — one run with the watch in hand confirms the motor.
3. **NFC card read `(56,1)` with a card on the coil** — promotes NFC to CONFIRMED.
4. **Vendor/teardown fields** — display, SoC die, battery mAh, IP rating, sensor part numbers. Record source URL + date, grade `VENDOR-CLAIMED`.
5. Only promote SUPPORTED → CONFIRMED on a captured payload or physical observation, with the log line cited.
