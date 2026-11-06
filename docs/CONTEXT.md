# DWatch 7 V2 — Project Context

> **Historical snapshot (October 2026).** Paths below refer to the original research
> workspace. In this repository the same material lives under `_archive/` (decompiled
> source, APK, logs, captures) and `tools/ble/` (working probes). For the current
> architecture see `README.md` and `DECODED.md`.

## Goal
Fully reverse-engineer the Chinese **D Watch7** smartwatch (companion app **M2Wear**,
package `com.lianhezhuli.mtwear`) and build custom tooling on the existing hardware.

## Device (verified live)
`D Watch7` · `C2:FC:01:BC:D4:1F` · Freqchip `Fr-BLE-1.0` · fw `6.1.2` · MTU 247 ·
`DEVICE_VERSION = 0x04` · battery via `0x2A19`

## Documentation
| File | Contents |
|---|---|
| **`PROTOCOL.md`** | **Master verified protocol** — GATT map, DF/FD frame format, verified command bytes, features/settings/dial payloads, bind, notifications, video (0x2B), g-sensor (0x28), cmdId map |
| **`OTA.md`** | OTA/D5-D6 envelope, CRC-8(0x31), params, group/file CRC, reboot |
| `CONTEXT.md` | this file |
| `_unsupported/unverified_notes.md` | everything that was WRONG or unproven, with reasons — **read before trusting any old note** |
| `_unsupported/old_watch_data/` | archived old web-Bluetooth controller + old docs |

## Folder layout
```
PROTOCOL.md  OTA.md  CONTEXT.md     verified docs
*.py                              working tools (see below)
m2wear_src/                        jadx decompile of M2Wear 6.1.38 (verified source of truth)
m2wear_apk/                        raw extracted APK
tools/                             jadx-1.5.2, google-usb-driver, zadig.exe, emulator scripts
capture/                           wf4 / wf4_bf / f_c  (watchface PAR blobs pulled from phone)
logs/                              all captured BLE logs + probe JSON
_unsupported/                      rejected / unverified material
```

## Working tools (all verified against hardware)
| Script | Purpose | Status |
|---|---|---|
| `watch_probe.py` | full GATT dump | ✅ |
| `watch_gui.py` | live console: auto connect→init→deep sync, auto-ACK, hex TX, logs to `watch_gui_log.txt` | ✅ |
| `push_msg.py` | push a notification to the watch | ✅ accepted by watch |
| `ota_send.py` | contact sync over the OTA channel (CMD_CONTACT=4) | ✅ "CONTACT SYNC OK" |
| `face_codes.py` / `face_verify.py` / `face_set.py` | built-in dial switching (cmdId 11 key 3) — 24+ codes work | ✅ with ~5–10 min cooldown after ~8 changes |
| `face_custom.py` / `face_sessions.py` | custom dial (cmdId 11 key 5): clock position + colour | ✅ readback-verified, 1 change/session |
| `bind_probe.py` | bind handshake + battery/heartbeat probing | ✅ |
| `dwatch_cli.py` | combined CLI (`scan`/`probe`/`dial`/`notify`/`verify`) | ✅ |
| `cmd_scan.py`, `cmd_live.py`, `cmd_live2.py`, `demo_all.py` | early probes | ⚠️ superseded by the above |

## Confirmed behaviours
* Write commands to **`00002AAD`**, listen on **`00002AAC`**. Writing to `2AAC` silently fails.
* Always **ACK** a received DF frame (`FD 00 06 chk cmd ver key 00 01 00`) — otherwise the watch goes silent.
* `bindDevice(8,0,<8 chars>)` must be sent early; watch replies payload `01`=already bound, `02`=accepted, `03`=rejected.
* Frame length field = **payload + 5**; checksum = sum of all bytes except index 3.
* Features reply is only 18 bytes → app defaults apply: `is565Bmp=false`, `is8Bytes=false`,
  `supportDiyOnlineWpaper=false`, `supportOTA=false`.

## Still unsolved
* **PAR / wallpaper container** — `rawToPar` lives in native `libabpartool.so`; `capture/wf4`
  (base64→544 B) and `capture/wf4_bf` (8192 B) are still opaque. This watch also reports
  `supportDiyOnlineWpaper=false`, so wallpaper pushes are refused by the firmware anyway.
* **Video (cmdId 43) / firmware log (cmdId 36)** — decoded from source but never exercised live.
* Old claims that `cmd 0x05` / `0x0A key 0x07` "crash the watch" were never reproduced → treat as
  unverified (see `_unsupported/unverified_notes.md`).

## Environment
Windows · PowerShell · Python **3.11** at
`C:\Users\CodenCoder\AppData\Local\Programs\Python\Python311\python.exe` (`bleak`
installed 2026-10-05) · JDK 17 (OpenJDK 17.0.16) ·
Android SDK (adb) at `C:\Users\CodenCoder\AppData\Local\Android\Sdk\platform-tools`
· jadx 1.5.2 in `tools\`
· **project path: `d:\Resources\dwatch fleage`** (old `c:\Users\UsamaPC\Desktop\...`
paths in earlier notes are dead)

## Useful commands
```powershell
# scan / probe
python watch_probe.py
# live console
pythonw watch_gui.py            # log -> watch_gui_log.txt
# push a notification
python push_msg.py
# push contacts over OTA
python ota_send.py
# switch built-in dial
python face_verify.py 0002
# phone (Motorola one 5G UW, Android 11) - APK package name for run-as:
#   com.lianhezhuli.mtwear  (NOT com.lhzl.*)
C:\Users\CodenCoder\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
```
