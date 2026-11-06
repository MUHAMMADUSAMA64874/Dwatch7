# DWatch 7 V2 — MASTER PROTOCOL (verified)

> Everything in this file is either (a) confirmed by live BLE traffic against the
> D Watch7, or (b) read directly out of the decompiled M2Wear 6.1.38 sources.
> Anything guessed or previously unverified lives in `_unsupported/unverified_notes.md`.

**Device (live):** D Watch7 · `C2:FC:01:BC:D4:1F` · Freqchip `Fr-BLE-1.0` fw `6.1.2` · MTU 247 · DEVICE_VERSION `0x04`

---

## 1. GATT map

| Service | Char | Props | Purpose |
|---|---|---|---|
| `000018AC` | `00002AAD` | write / write-no-rsp | **command TX** |
| `000018AC` | `00002AAC` | notify | **command RX** |
| `000018F`  | `00002A19` | read / notify | battery % |
| `0000180A` | `2A29/2A24/2A25/2A26/2A27` | read | Freqchip / Fr-BLE-1.0 / 1.0.0.0-LE / 6.1.2 / 1.0.0 |
| `000018A8` | `00002AA9` | write | **OTA TX** |
| `000018A8` | `00002AA8` | notify | **OTA RX** |
| `0000FE00` | `FF01` / `FF02` / `FF00` | w / n / r | vendor, no responses observed |
| `00003802` | `00004A02` | notify | ZFB/Alipay pay (absent on this unit) |
| `00003803` | `00004A03` | notify | bus-code / AliAuth (**absent on this unit**) |

Writing to `2AAC` fails silently — always write commands to `2AAD`.

---

## 2. Command frame (verified on the wire)

```
DF  len_hi len_lo  CHECKSUM  cmdId  deviceVer  cmdKey  payLen_hi payLen_lo  payload...
```
* `0xDF` = header. `0xFD` = status/ACK frame, identical layout.
* `len` = **payload length + 5**
* `CHECKSUM` = sum of every other byte in the final frame, `& 0xFF`
  (TX: app sums the frame *before* inserting the checksum byte — same result)
* `deviceVer` = `0x00` until the features reply arrives, then `0x04`
* Frames may be split across BLE notifications. Reassemble until
  `len + 4` bytes collected (app: `receiveBytes` of size `len+4`).
* If the reassembled DF frame passes the checksum, **reply with an ACK**
  — otherwise the watch goes silent. Two variants exist and they are NOT
  the same frame:
  * **TX (what the app / our tools send)** — 9 bytes, **no checksum byte**
    (byte 3 holds cmdId): `FD 00 06 cmdId ver cmdKey 00 01 status`
    (app source `AckPackageConfigUtils.configAck`; implemented in
    `sweep.ack_frame()`; live-verified — controls pass after it).
  * **RX (watch → app status)** — 10 bytes, standard checksum at byte 3,
    `payLen = 00 01`: `FD 00 06 CHECKSUM cmdId ver cmdKey 00 01 status`
    (see §2 ACK / status frame below).

### Verified frames (deviceVer = 4)

| Purpose | TX bytes |
|---|---|
| getProductId | `df 00 06 ff 14 04 00 00 01 01` |
| getDeviceFeatures | `df 00 06 ea 00 04 00 00 01 00` |
| getDeviceInfo | `df 00 05 db f3 04 00 00 00` |
| getDeviceNameVersion | `df 00 05 fd 02 04 17 00 00` |
| sendSystemTime | `df 00 09 xx 02 04 08 00 04 <4B packed time>` |
| getSettingInfo | `df 00 06 f3 02 04 06 00 01 01` |
| syncData / getTodayData | `df 00 06 ec 01 04 00 00 01 01` / `df 00 06 ed 01 04 01 00 01 01` |
| requestBattery (no reply) | `df 00 06 fb 11 04 00 00 01 00` |
| bindDevice | `df 00 0d a4 08 04 00 00 08 <8-char code>` |
| setWatchFace | `df 00 07 xx 0b 04 03 00 02 <2B code>` |
| getCustomizeFaceInfo | `df 00 06 fa 0b 04 04 00 01 01` |
| setCustomWatchFace | `df 00 0f xx 0b 04 05 00 0b <11B>` |
| push notification | `df 00 4c f1 0a 04 00 00 47 <payload>` |

### ACK / status frame (watch → app)
```
FD 00 06 CHECKSUM cmdId deviceVer cmdKey 00 01 status
```
* 10 bytes. `CHECKSUM` follows the standard rule (sum of all other bytes,
  `& 0xFF`); the `payLen` pair is `00 01`, so the payload is the single
  `status` byte at index 9: `0x00` = success, non-zero = error.
* Seen success ACKs: productId(0x14,key 0), features(0x00,key 0), nameVersion(0x02,key 0x17),
  systemTime(0x02,key 8), settingInfo(0x02,key 6), sync(0x01,key 0), today(0x01,key 1),
  setWatchFace(0x0B,key 3), customFace(0x0B,key 5).
* **Reject frame** — byte-for-byte identical in all 95 observed occurrences:
  ```
  FD 00 06 16 04 04 00 00 0A 01
  ```
  * checksum byte `0x16` **is** standard-valid (sum of the other 9 bytes =
    0x116 → 0x16); the normal parser refuses it only because the `payLen`
    pair `00 0A` (= 10) overruns the 10-byte frame — `sweep.classify()`
    special-cases this exact frame.
  * it always reports cmdId `0x04` / deviceVer `0x04` / cmdKey `0x00`
    **regardless of what was probed**, so it can NEVER be attributed to a
    (cmd,key) pair — it is a link-level refusal, counted separately from
    silence. Trailing bytes are literal `00 0A 01` (code `0x0A`).
  * emitted for unsupported commands, during the dial-change cooldown, and
    as a generic refusal — e.g. 40 of the 70 reprobe occurrences followed a
    healthy cmd 3 / key 0 control (link-level noise, not pair-specific).

---

## 3. Features reply (cmdId 0x00, key 0) — live
```
df 00 0e b6 00 04 00 00 09 01 ff 01 02 00 00 d7 00 e2
```
payload (9 B) `01 ff 01 02 00 00 d7 00 e2` decodes as:

| Byte | Meaning | Value |
|---|---|---|
| 9 | haveGSensor | 1 |
| 10 | gSensorFun | 0xFF |
| 11 | haveHR | 1 |
| 12 | hrFun | 2 |
| 13 | haveGPS | 0 |
| 14 | gpsFun | 0 |
| 15 | flags: sedentary / 24h / carousel / **contacts** / platform=7 | 0xD7 |
| 16 | flags: OTA / QR / raise-to-wake / newMsgProto / alarm — **all 0** | 0x00 |
| 17 | watchface set(0x80) + customize(0x40) + push(0x20); ratio = `&0x1F` = **2** | 0xE2 |

Frame is only 18 B, so the app defaults apply: `is565Bmp=false`, `is8Bytes=false`,
`supportDiyOnlineWpaper=false`, `supportDiyRdefault=false`, `codeFormat=0`,
`supportOTA=false` — **this is why wallpaper/QR/OTA-image pushes are refused.**

---

## 4. Settings reply (cmdId 0x02, key 6) — live
```
df 00 34 1b 02 04 06 00 2f 01 00 00 00 00 02 00 00 00 00 03 00 00
df ff f8 20 00 00 40 10 52 80 1e 00 50 10 60 00 00 3c 01 e0 05 28 07
00 00 00 0f 2d 08 16 fe 08 01
```
`payLen = 0x2F`. Payload layout (offsets are into the full DF frame, per
`BleDataUtils.handleSettingInfo`):
* `[20]` handBright, `[21]` language
* `[22..25]` (or `[22..26]` when `language5Bytes`) supported-language bytes
* `[26]` realtimeSport, `[27]` realtimeHealth
* then a `(tag, value…)` record stream:
  `4`=sleep(start/end in minutes) · `5`=wearing · `6`=hrAutoTest · `7`=sedentary ·
  `8`=24h · `9`=carousel · `10`=notification bitmap (9 apps × 12 B) · …

---

## 5. Custom dial (cmdId 0x0B) — live

| Key | Direction | Result |
|---|---|---|
| 1 | → | rejected (`0x0A`) |
| 3 | → | **setWatchFace**, 2-byte code. Every code except `0000` ACKs success |
| 4 | → | getCustomizeFaceInfo → 11 B DF reply |
| 5 | → | setCustomWatchFace |
| 9 | → | rejected (`0x0A`) |

Reply to key 4/5:
```
payload: 80 03 00 14 00 14 ff ff 04 01 02
faceCode=0x8003  timeX=0x0014(20)  timeY=0x0014(20)  color=0xFFFF
aboveTime=4  belowTime=1  bgUpdate=2
```
Layout (2-byte variant, `is8Bytes=false`): `faceCode[0:2] | timeX u16 BE |
timeY u16 BE | color u16 BE | aboveTime | belowTime | bgUpdate`.

**Anti-spam:** after ~8 successful `key 3` writes the watch starts returning the
`0x0A` reject and needs a ~5–10 min cooldown (one change per BLE session works).

Verified working face codes: `0001`–`0005`, `0100`, `0200`, `0300`,
`8000`–`8007`, `9001`, `9002`, `A001`, `A002`, `B001`, `C001`, `D001`, `E001`,
`F001`, `0008`, `0010`, `0101`, `0202`. (`0000` is rejected.)

---

## 6. Bind handshake — live
`df 00 0d a4 08 04 00 00 08 <8 ascii chars>` (cmdId 8, key 0).
Watch answers with a DF frame cmdId `0x08`, key 0, payload byte:
`01` = already bound · `02` = bind accepted · `03` = user rejected.
Sending it converts previously-rejected commands into proper FD success ACKs.

---

## 7. Notification push (cmdId 0x0A, key 0) — live, accepted
```
payload = id:u16 | epoch:u32 | lenApp:u8 | app | lenTitle:u8 | title |
          lenBody:u16 | body
```
Verified end-to-end (`push_msg.py`) — watch ACKs `0x0A/0` then `0x0A/1`.

---

## 8. Video / camera streaming (cmdId 0x2B = 43) — from source
`CameraNotifyWriteUtils.java`:
```
chunkSize = MTU - 5
each packet = [0x2B][0x03][...chunk...]      # NOT wrapped in a DF frame
written with response, 3 retries, then abort
```
Watch side (parsed in `NotifyWriteUtils`):
* key `0x02` → `picWidth u16, picHeight u16, rotate u8, frameCache u16`
* key `0x03` → "ready for next frame" request

Flow: send `cmd 0x2B key 1 payload 01` → watch replies key 2 (dims) → watch asks
for a frame with key 3 → send JPEG chunks → repeat. Stop with key 1 payload `00`.

---

## 9. G-sensor game streaming (cmdId 0x28 = 40) — from source
```java
setGamePrepare()        -> cmd 0x28 key 0  payload 00 00 00 00 64
setGameStatus(gid, 1)   -> cmd 0x28 key 0  payload gidHi gidLo 01 00 64   (start)
setGameStatus(gid, 4)   -> cmd 0x28 key 0  payload gidHi gidLo 04 00 64   (exit)
```
Watch→phone stream: cmdId `0x28` key `0x01`, payload
`gidHi gidLo count [Xhi Xlo Yhi Ylo Zhi Zlo] × count`.
Each axis is a **15-bit sign-magnitude** value: hi bit7 = sign, `hi & 0x7F` + lo = magnitude
(NOT two's complement). 4096 LSB/g.

---

## 10. OTA channel — see `OTA.md`
`D5`/`D6` envelope, `startOTA` → params → CRC-8(0x31) group/file checks → finish/reboot.
Live-verified params on this watch: **devMtu 129** (128 B packets), **interval 20 ms**,
**groupPacNum 32**, **timeout 100 s**.

---

## 11. Command id map (from `CommandUtils.java` constants)
| cmdId | Constant | Value |
|---|---|---|
| 1 | `SYNC_ID` | sync / today data |
| 2 | `SETTING_ID` | all settings keys |
| 3 | `HEALTH_DATA_ID` | HR/BP/SpO2/sleep/steps records |
| 4 | `SPORTS_DATA_ID` | sport records |
| 5 | `WEATHER_INFO_ID` | weather push |
| 6 | `CONTROL_DEVICE_ID` | find-watch, heartbeats |
| 7 | `CONTROL_APP_ID` | audio / media control |
| 8 | `BIND_DEVICE_ID` | bind / unbind |
| 9 | `DEVICE_VERSION` | — |
| 10 | `MSG_PUSH_ID` | notification push |
| 11 | `WATCH_FACE_ID` | dial control |
| 12 | `OTA_INFO_ID` | OTA info / product id |
| 13 | `QR_CODE_ID` | QR codes |
| 14 | `PHONE_CALL_ID` | call reminder |
| 17 | `BATTERY_ID` | battery request |
| 18 | `ACID_CODE_ID` | acid QR code (get / reset) |
| 19 | `EVENT_REMINDER_ID` | reminders |
| 24 | `NAVIGATION_ID` | nav / Ali IoT |
| 25 | `COMMAND_ID_MENSTRUAL` | menstrual |
| 30 | `CHATGPT_ID` | — |
| 32 | `COMMAND_ID_OTA_NEW` | OTA |
| 34 | `COMMAND_ID_DRINK_REMINDER` | drink water |
| 39 | `COMMAND_ID_REQUEST_FM_MTU` | MTU negotiation |
| 40 | `COMMAND_ID_SENSORY_GAME_INTERACTION` | g-sensor game |
| 43 | `COMMAND_ID_VIDEO_REALTIME_TRANS` | camera/video stream |
| 47 | — (`sendWechatActiveMac`, key 2) | WeChat service authorization |
| 56 | `COMMAND_ID_NFC` | NFC cards |
| 0xF3 | `COMMAND_ID_DEVICE_INFO` (−13) | device info string |

---

## 12. Blind sweep results & silence map (2026-10-05)

Method: `sweep.py` probed every source-unknown (cmd,key) pair, then `no_reply.py`
replayed all `discovery/*.log` files attributing each RX frame by **its own
embedded (cmd,key)** — never by probe slot (replies arrive up to ~3 probe slots
late; slot attribution had wrongly inflated the silent list to 237).

* **6,293 distinct pairs probed · 6,560 frames replayed · 95 generic rejects.**
* **6,228 / 6,293 pairs answered** — almost all with a bare status ACK, so an
  ACK is useless as a filter. Only *silence* is informative.
* **65 candidate pairs re-probed live** (2026-10-05, 3 attempts each, healthy
  (3,0) control before every pair → `reprobe.py`, 45 control-OK / 46 control-fail)
  plus a **3-pair follow-up run** for gaps the tiers exposed
  (`reprobe.py --pairs 5/0,2/18,11/1`, separate state file
  `discovery/reprobe_state_extra.json` so the 65-pair record is untouched):

  | Outcome | Pairs | Meaning |
  |---|---|---|
  | **answered** | `(1,0)` syncData, `(20,0)` | **revived** — both had been sent once with an empty payload and written off as silent; the watch answers them (the payload-less first send just went unanswered). *Not* silent commands |
  | **rejected** | `(5,33)` | a generic reject was in flight — link-level, cannot be charged to the pair → **not** a denylist candidate |
  | **IGNORED** | **63 pairs = cmd 5 keys 0–32 and 34–63** | true silence on every attempt with a live control → **the denylist** |

* **cmd 5 (`WEATHER_INFO_ID`) is unsupported by this firmware** — the only
  command-level silence found; **all 64 keys (0–63) are silent / perturbing**.
  Key 0 was confirmed in the 3-pair follow-up (3 attempts, live control,
  zero frames). Bonus observation: each cmd-5 batch is followed
  by the watch going **unresponsive for ~30–60 s** (the control that passed
  milliseconds earlier stops answering; it only recovers after a reconnect),
  which is why 46 controls failed. Treat cmd 5 as both silent *and* link-perturbing.

### Previously undocumented cmds (probed live, ACK-only — payloads pending tier runs)

| cmd | keys (oracle) | methods (decompile) |
|---|---|---|
| 17 `BATTERY_ID` | 0, 2, 4 | requestBattery · getPowerSavingMode · setPowerSavingMode |
| 18 `ACID_CODE_ID` | 0, 1 | getAcidQrCodeInfo · resetAcidQrCode |
| 19 `EVENT_REMINDER_ID` | 0, 1, 2, 3 | getSupportEventReminder · getEventReminder · sendEventReminder · sendDeleteEventReminder |
| 24 `NAVIGATION_ID` | 0, 1, 2, 3, 5 | sendAliIotStatus · sendLocation · sendNav · setExitNav · sendNavType |
| 25 `COMMAND_ID_MENSTRUAL` | 0, 1, 3, 5 | getMenstrual · setMenstrual · requestMenstrual · setMenstrualSwitch |
| 30 `CHATGPT_ID` | 8, 9, 16, 17 | sendChatGPTRecogStart · sendChatGPTRecogEnd · sendAddTodoData · sendDelTodoData |
| 47 | 2 | sendWechatActiveMac |
| 56 `COMMAND_ID_NFC` | 1, 2, 8, 11, 14 | requestNFCCardInfo · addNfcCard · setNFCBlankCardOpt · deleteNfcCard · sendNFCCardData |

### cmd 2 (settings) key range

Source oracle shows setting keys **0–66 (0x42)** — sparse, 41 distinct keys
(0–14, 16–20, 23, 32, 33, 35, 36, 43, 46, 48, 50–52, 54, 55, 57, 59–66).
Forbidden region `(2, 0x09)–(2, 0x0E)` and `(2, 0x2A)/(2, 0x2B)` stays excluded.

### Three-outcome model (denylist logic)

A probed pair ends in exactly one of: **answered** (a frame carrying its own
cmd/key arrived) · **rejected** (the generic reject was in flight — link-level
only, NOT attributable, so never charged to the pair) · **ignored** (true
silence). Only **ignored** justifies a denylist entry. The final re-probe run
completed **65/65** (see table above); per-pair outcomes live in
`discovery/reprobe_state.json`, follow-up outcomes in
`discovery/reprobe_state_extra.json`, source list in `discovery/attribution.json`.

### Ladder tier results (2026-10-05, all 5 tiers OK — real payloads captured)

| Tier | Result | Notable payloads |
|---|---|---|
| `identity` | OK (2 attempts) | Manufacturer `Freqchip`, model `Fr-BLE-1.0`, fw `6.1.2`, battery 92% (`tier_identity.txt`) |
| `bind` | OK | bind `(8,0)` + device-info `(243,0)` + heartbeat `(6,7)` + setting-retry `(2,6)` all ACK'd (`tier_bind.txt`) |
| `settings_read` | OK | **real DF payload**: `(2,6)` 47B settings blob; all keys 6–66 ACK'd; `(2,18)` drew the generic reject (`tier_settings_read.txt`) |
| `health` | OK | measure HR/BP/SpO2 + `(3,0/8/10)` + sports + battery + acid all ACK'd; **unsolicited** `(3,1)` 12B + `(3,2)` 12B pushes; `(5,0)` weather confirmed silent; ending reject is link-level (`tier_health.txt`) |
| `misc` | OK | OTA/QR/nav/menstrual/reminder/chatgpt/NFC/control-app/timezone + `(11,4)`→`(11,5)` custom-face reply `800300140014ffff040102`; `(11,1)` drew the generic reject, re-verified live as **answered** in the follow-up (`tier_misc.txt`) |

Follow-up verdicts (see table above): `(2,18)` and `(11,1)` — single-attempt
tier "silence" was **not real**; both answered their own (cmd,key) on all
3 live attempts → **excluded** from the denylist. `(5,0)` → **included**.
