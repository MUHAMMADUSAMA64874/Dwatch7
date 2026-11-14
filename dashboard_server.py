"""
D WATCH 7 - UNIFIED LAB & DASHBOARD SERVER
===========================================
Single-entry backend combining:
  1. HTTP Web Server (Port 8080): serves the studio shell, games, docs and themes.
  2. WebSocket Bridge (Port 8780): drives the dashboard and every game.
  3. Windows SMTC Media Controls Listener:
     - Catches watch Music screen buttons (Previous, Play/Pause, Next) over "D Watch7-Audio".
     - Broadcasts button events to all connected games and dashboard in real-time.
     - Configurable keyboard simulation profiles.
  4. Native Bleak BLE Bridge (C2:FC:01:BC:D4:1F):
     - Auto-connects and auto-reconnects in background.
     - Battery monitoring (GATT 0x2A19).
     - Push notifications to watch screen (CMD 0x0A key 0).
     - Dial / watch face switching (CMD 0x0B key 3).
     - Optical Heart Rate & Health sensor trigger/poll (CMD 0x06 key 4 / CMD 0x03 key 0).
     - Automatic DF frame acknowledgement.
"""

import argparse
import asyncio
import ctypes
import http.server
import json
import os
import struct
import sys
import threading
import time
import wave
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

try:
    from bleak import BleakClient, BleakScanner
    BLE_AVAILABLE = True
except Exception as _ble_err:  # pragma: no cover - optional dependency
    BleakClient = BleakScanner = None
    BLE_AVAILABLE = False
    _BLE_IMPORT_ERROR = _ble_err

try:
    from winrt.windows.foundation import Uri
    from winrt.windows.media import (
        MediaPlaybackStatus,
        MediaPlaybackType,
        SystemMediaTransportControlsButton as Btn,
    )
    from winrt.windows.media.core import MediaSource
    from winrt.windows.media.playback import MediaPlayer
    MEDIA_AVAILABLE = True
except Exception as _media_err:  # pragma: no cover - Windows-only optional dependency
    Uri = None
    MediaPlaybackStatus = MediaPlaybackType = None
    Btn = None
    MediaSource = MediaPlayer = None
    MEDIA_AVAILABLE = False
    _MEDIA_IMPORT_ERROR = _media_err

try:
    import websockets
except ImportError:
    websockets = None

# --- Configuration ---
WATCH_MAC = "C2:FC:01:BC:D4:1F"
CHAR_WR = "00002aad-0000-1000-8000-00805f9b34fb"
CHAR_NT = "00002aac-0000-1000-8000-00805f9b34fb"
CHAR_BAT = "00002a19-0000-1000-8000-00805f9b34fb"
DEV_VER = 0x04

HTTP_PORT = 8080
WS_PORT = 8780
# The studio exposes the BLE bridge with no auth, so listen on loopback only.
# Pass --host 0.0.0.0 to share it on the LAN.
BIND_HOST = "127.0.0.1"

BUTTONS = {}
if MEDIA_AVAILABLE:
    BUTTONS = {
        Btn.PREVIOUS: "left",
        Btn.NEXT: "right",
        Btn.PLAY: "action",
        Btn.PAUSE: "action",
    }

KEY_PROFILES = {
    "bp":     {"left": ("space", 50), "action": ("space", 50), "right": ("space", 50)},
    "dodge":  {"left": ("left", 40), "action": ("space", 50), "right": ("right", 40)},
    "racing": {"left": ("a", 60), "action": ("w", 150), "right": ("d", 60)},
    "arrows": {"left": ("left", 40), "action": ("up", 40), "right": ("right", 40)},
    "none":   {},
}

VK = {
    "left": 0x25, "up": 0x26, "right": 0x27, "down": 0x28,
    "space": 0x20, "enter": 0x0D, "esc": 0x1B,
}
for _c in "abcdefghijklmnopqrstuvwxyz0123456789":
    VK[_c] = ord(_c.upper())
EXTENDED_KEYS = {"left", "up", "right", "down"}

# --- Shared State ---
ROOT_DIR = Path(__file__).parent
active_profile = "dodge"
keyboard_emulation_enabled = True
watch_button_triggers_bp = True
async_loop = None
ws_clients = set()

ble_client = None
ble_connected = False
last_battery = None
last_hr_bpm = None
last_spo2 = None
last_bp = (None, None)
last_button_time = 0.0
last_button = None
stats = {
    "presses": 0,
    "notifications": 0,
    "dial_switches": 0,
    "bp_requests": 0,
    "hr_requests": 0,
    "start_time": time.time(),
}

# Rate limiting
WS_MSG_RATE_LIMIT = 20  # max messages per second per client
ws_msg_counts = {}  # client -> [timestamps]

# Circuit breaker for BLE
ble_failure_count = 0
ble_last_failure = 0.0
BLE_MAX_FAILURES = 5
BLE_RESET_WINDOW = 60.0  # seconds


def log(prefix: str, msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [{prefix}] {msg}", flush=True)


# --- Frame Helpers ---
def build_df_frame(cmd: int, key: int, payload: bytes = b"", ver: int = DEV_VER) -> bytes:
    p_len = len(payload)
    flen = 5 + p_len
    raw = bytearray([0xDF, (flen >> 8) & 0xFF, flen & 0xFF, cmd, ver, key, (p_len >> 8) & 0xFF, p_len & 0xFF])
    raw.extend(payload)
    checksum = sum(raw) & 0xFF
    return bytes([raw[0], raw[1], raw[2], checksum]) + bytes(raw[3:])


def build_ack_frame(cmd: int, ver: int, key: int, status: int = 0) -> bytes:
    raw = bytearray([0xFD, 0x00, 0x06, 0x00, cmd, ver, key, 0x00, 0x01, status])
    raw[3] = sum(b for i, b in enumerate(raw) if i != 3) & 0xFF
    return bytes(raw)


def build_notification_frame(nid: int, app: str, title: str, content: str) -> bytes:
    b_app = app.encode("utf-8")
    b_title = title.encode("utf-8")
    b_content = content.encode("utf-8")
    ts = int(time.time())
    buf = bytearray(20 + len(b_app) + len(b_title) + len(b_content))
    buf[0] = (nid >> 8) & 0xFF
    buf[1] = nid & 0xFF
    buf[2] = (ts >> 24) & 0xFF
    buf[3] = (ts >> 16) & 0xFF
    buf[4] = (ts >> 8) & 0xFF
    buf[5] = ts & 0xFF
    na = len(b_app)
    nt = len(b_title)
    nc = len(b_content)
    buf[6] = na
    buf[7:7 + na] = b_app
    buf[7 + na] = nt
    buf[8 + na:8 + na + nt] = b_title
    buf[8 + na + nt] = (nc >> 8) & 0xFF
    buf[9 + na + nt] = nc & 0xFF
    buf[10 + na + nt:10 + na + nt + nc] = b_content
    total = 10 + na + nt + nc
    return build_df_frame(0x0A, 0x00, bytes(buf[:total]))


def decode_hr_payload(data: bytearray):
    try:
        if len(data) < 13 or data[0] != 0xDF or data[4] != 0x03:
            return None
        subtype = data[6]
        if subtype not in (0, 1, 2):
            return None
        count = (data[11] << 8) | data[12]
        if count <= 0 or len(data) < 13 + count * 8:
            return None
        res = {"subtype": subtype, "bpm": None, "spo2": None, "bp_high": None, "bp_low": None}
        for n in range(count):
            offset = 13 + n * 8
            b7 = data[offset + 7]
            b6 = data[offset + 6]
            if subtype == 0 and b7 >= 30:
                res["bpm"] = b7
            elif subtype == 2 and b7 <= 100:
                res["spo2"] = b7
            elif subtype == 1 and b6 >= 50 and 30 <= b7 <= 200:
                res["bp_high"], res["bp_low"] = b6, b7
        return res
    except Exception:
        return None


# --- Native Keyboard Simulation ---
def simulate_key(name: str, hold_ms: int):
    vk = VK.get(name.lower())
    if vk is None:
        return
    flags = 1 if name.lower() in EXTENDED_KEYS else 0
    scan = ctypes.windll.user32.MapVirtualKeyW(vk, 0)
    ctypes.windll.user32.keybd_event(vk, scan, flags, 0)
    time.sleep(max(hold_ms, 20) / 1000.0)
    ctypes.windll.user32.keybd_event(vk, scan, flags | 2, 0)


# --- WebSocket Broadcast ---
async def broadcast_ws(payload: dict) -> None:
    if not ws_clients:
        return
    msg = json.dumps(payload)
    dead = set()
    for client in list(ws_clients):
        try:
            await client.send(msg)
        except Exception:
            dead.add(client)
    for c in dead:
        ws_clients.discard(c)


# --- Media Controls (SMTC) ---
def handle_button_press(button: str):
    global last_button_time, last_button
    now = time.monotonic()
    if now - last_button_time < 0.05:  # Debounce accidental doubles
        return
    last_button_time = now
    last_button = button
    stats["presses"] += 1

    log("SMTC", f"Watch Button: {button.upper()}")

    # Determine if this watch button press should trigger BP measurement
    trigger_bp_now = (watch_button_triggers_bp or active_profile == "bp") and ble_connected

    if trigger_bp_now:
        log("BP", f"Watch button '{button.upper()}' pressed -> starting Blood Pressure optical sensor on watch & 3D simulator!")
        if async_loop and async_loop.is_running():
            asyncio.run_coroutine_threadsafe(request_blood_pressure(), async_loop)

    # Simulate keyboard key if enabled (skip when in BP mode)
    if keyboard_emulation_enabled and active_profile != "bp":
        mapping = KEY_PROFILES.get(active_profile, {}).get(button)
        if mapping:
            threading.Thread(target=simulate_key, args=mapping, daemon=True).start()

    # Broadcast to all web clients
    if async_loop and async_loop.is_running():
        asyncio.run_coroutine_threadsafe(
            broadcast_ws({
                "type": "button",
                "button": button,
                "source": "watch",
                "trigger_bp": trigger_bp_now,
                "ble_connected": ble_connected,
                "timestamp": time.time(),
            }),
            async_loop,
        )


def start_media_listener():
    if not MEDIA_AVAILABLE:
        log("SMTC", f"Windows media controls unavailable (winrt not installed). Wrist buttons disabled. ({_MEDIA_IMPORT_ERROR})")
        return None
    here = os.path.dirname(os.path.abspath(__file__))
    silence_path = os.path.join(here, "logs", "silence.wav")
    os.makedirs(os.path.dirname(silence_path), exist_ok=True)
    if not os.path.exists(silence_path):
        with wave.open(silence_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(8000)
            w.writeframes(struct.pack("<h", 0) * 8000 * 5)

    player = MediaPlayer()
    player.command_manager.is_enabled = False
    player.source = MediaSource.create_from_uri(Uri("file:///" + silence_path.replace("\\", "/")))
    player.is_looping_enabled = True
    player.volume = 0.0

    smtc = player.system_media_transport_controls
    smtc.is_enabled = True
    for attr in ("is_play_enabled", "is_pause_enabled", "is_next_enabled", "is_previous_enabled"):
        setattr(smtc, attr, True)

    updater = smtc.display_updater
    updater.type = MediaPlaybackType.MUSIC
    updater.music_properties.title = "D Watch7 Lab"
    updater.music_properties.artist = "Universal Controller"
    updater.update()

    def on_button_pressed(_smtc, args):
        btn = BUTTONS.get(args.button)
        if btn:
            handle_button_press(btn)
        smtc.playback_status = MediaPlaybackStatus.PLAYING

    smtc.add_button_pressed(on_button_pressed)
    player.play()
    smtc.playback_status = MediaPlaybackStatus.PLAYING
    log("SMTC", "Registered as active Windows Media Player ('D Watch7 Lab')")
    return player


# --- BLE Worker ---
async def switch_dial(code: str) -> bool:
    global ble_client, ble_connected
    if not ble_connected or not ble_client:
        return False
    try:
        raw_code = bytes.fromhex(code.strip())
        frame = build_df_frame(0x0B, 0x03, raw_code)
        await ble_client.write_gatt_char(CHAR_WR, frame, response=False)
        stats["dial_switches"] += 1
        log("BLE", f"Applied watch face dial: {code}")
        await broadcast_ws({"type": "dial_applied", "code": code})
        return True
    except Exception as e:
        log("BLE", f"Dial switch failed: {e}")
        return False


async def send_raw_frame(cmd: int, key: int, payload: bytes, ver: int = DEV_VER) -> bool:
    """Write an arbitrary DF frame, for the Protocol Lab raw console."""
    global ble_client, ble_connected
    if not BLE_AVAILABLE:
        await broadcast_ws({"type": "error", "message": "Bleak is not installed on this machine."})
        return False
    if not ble_connected or not ble_client:
        await broadcast_ws({"type": "error", "message": "Watch is not connected."})
        return False
    try:
        frame = build_df_frame(cmd, key, payload, ver)
        await ble_client.write_gatt_char(CHAR_WR, frame, response=False)
        stats["raw_frames"] = stats.get("raw_frames", 0) + 1
        log("RAW", f"TX {frame.hex(' ').upper()}")
        await broadcast_ws({
            "type": "raw_tx",
            "hex": frame.hex(" ").upper(),
            "cmd": cmd,
            "key": key,
        })
        return True
    except Exception as e:
        log("RAW", f"Frame failed: {e}")
        await broadcast_ws({"type": "error", "message": f"Raw frame failed: {e}"})
        return False


def build_time_payload(dt: datetime = None) -> bytes:
    """Four packed bytes: year-2000, month, day, hour, minute, second."""
    dt = dt or datetime.now()
    year = dt.year - 2000
    month, day = dt.month, dt.day
    hour, minute, second = dt.hour, dt.minute, dt.second
    return bytes([
        ((year << 2) | (month >> 2)) & 0xFF,
        (((month & 0x03) << 6) | (day << 1) | (hour >> 4)) & 0xFF,
        (((hour & 0x0F) << 4) | (minute >> 2)) & 0xFF,
        (((minute & 0x03) << 6) | second) & 0xFF,
    ])


async def sync_time() -> bool:
    global ble_client, ble_connected
    if not ble_connected or not ble_client:
        await broadcast_ws({"type": "error", "message": "Watch is not connected; time sync skipped."})
        return False
    try:
        payload = build_time_payload()
        frame = build_df_frame(0x02, 0x08, payload)
        await ble_client.write_gatt_char(CHAR_WR, frame, response=False)
        log("BLE", f"Time sync sent: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ({payload.hex()})")
        await broadcast_ws({"type": "time_synced", "payload": payload.hex(),
                            "time": datetime.now().isoformat(timespec="seconds")})
        return True
    except Exception as e:
        log("BLE", f"Time sync failed: {e}")
        await broadcast_ws({"type": "error", "message": f"Time sync failed: {e}"})
        return False


async def push_notification(app_name: str, title: str, content: str) -> bool:
    global ble_client, ble_connected
    if not ble_connected or not ble_client:
        return False
    try:
        frame = build_notification_frame(1, app_name, title, content)
        await ble_client.write_gatt_char(CHAR_WR, frame, response=False)
        stats["notifications"] += 1
        log("BLE", f"Pushed notification: '{title}' - '{content}'")
        await broadcast_ws({"type": "notification_sent", "title": title, "content": content})
        return True
    except Exception as e:
        log("BLE", f"Push notification failed: {e}")
        return False


async def request_heart_rate() -> bool:
    global ble_client, ble_connected, stats
    stats["hr_requests"] = stats.get("hr_requests", 0) + 1
    # Broadcast to dashboard that optical sensor has started (beeping lights ON)
    await broadcast_ws({
        "type": "sensor_state",
        "sensor": "hr",
        "measuring": True,
        "duration_sec": 20,
        "message": "Heart Rate measurement active (CMD 0x06 key 0x04)",
    })
    if not ble_connected or not ble_client:
        return False
    try:
        trig = build_df_frame(0x06, 0x04, bytes([0x01]))
        await ble_client.write_gatt_char(CHAR_WR, trig, response=False)
        log("BLE", "Triggered optical heart-rate sensor (CMD 0x06 key 0x04)")
        await asyncio.sleep(0.4)
        read_f = build_df_frame(0x03, 0x00, bytes([0x01]))
        await ble_client.write_gatt_char(CHAR_WR, read_f, response=False)
        return True
    except Exception as e:
        log("BLE", f"Heart rate trigger failed: {e}")
        return False


async def request_blood_pressure() -> bool:
    global ble_client, ble_connected, stats
    stats["bp_requests"] = stats.get("bp_requests", 0) + 1
    # Broadcast to dashboard that BP optical sensor is active (beeping lights ON)
    await broadcast_ws({
        "type": "sensor_state",
        "sensor": "bp",
        "measuring": True,
        "duration_sec": 25,
        "message": "Blood Pressure measurement active (CMD 0x06 key 0x05)",
    })
    if not ble_connected or not ble_client:
        return False
    try:
        # TenMeter protocol from M2Wear: CMD 0x06 key 0x05 sends BP request
        trig = build_df_frame(0x06, 0x05, bytes([0x01]))
        await ble_client.write_gatt_char(CHAR_WR, trig, response=False)
        log("BLE", "Triggered optical blood-pressure sensor (CMD 0x06 key 0x05)")
        await asyncio.sleep(0.4)
        # TenMeter protocol: CMD 0x03 key 0x01 queries BP dataset
        read_f = build_df_frame(0x03, 0x01, bytes([0x01]))
        await ble_client.write_gatt_char(CHAR_WR, read_f, response=False)
        return True
    except Exception as e:
        log("BLE", f"Blood pressure trigger failed: {e}")
        return False


def on_ble_notification(_sender, data: bytearray):
    global ble_client, last_hr_bpm, last_spo2, last_bp
    if len(data) < 7:
        return

    # Always ACK any inbound DF frame so the watch never stops talking
    if data[0] == 0xDF and ble_client and ble_client.is_connected:
        ack_f = build_ack_frame(data[4], data[5], data[6])
        asyncio.create_task(ble_client.write_gatt_char(CHAR_WR, ack_f, response=False))
        try:
            asyncio.create_task(broadcast_ws({
                "type": "raw_rx",
                "hex": bytes(data).hex(" ").upper(),
                "cmd": data[4],
                "key": data[6],
            }))
        except Exception:
            pass

    # Detect watch screen touch / shutter button press (CMD 0x07 key 0x02)
    if data[0] == 0xDF and data[4] == 0x07 and data[6] == 0x02:
        log("BLE", "Watch Screen Button / Shutter Pressed (CMD 0x07 key 0x02)")
        if ble_client and ble_client.is_connected:
            asyncio.create_task(ble_client.write_gatt_char(CHAR_WR, build_df_frame(0x06, 0x02), response=False))
        asyncio.create_task(broadcast_ws({
            "type": "button",
            "button": "action",
            "source": "watch_screen",
            "trigger_bp": True,
            "ble_connected": True,
            "timestamp": time.time(),
        }))
        if watch_button_triggers_bp or active_profile == "bp":
            asyncio.create_task(request_blood_pressure())

    # Detect watch-initiated BP command frame (CMD 0x06 key 0x05)
    if data[0] in (0xDF, 0xFD) and data[4] == 0x06 and data[6] == 0x05:
        log("BLE", "Watch Blood Pressure command active on device (CMD 0x06 key 0x05)")
        asyncio.create_task(broadcast_ws({
            "type": "sensor_state",
            "sensor": "bp",
            "measuring": True,
            "duration_sec": 25,
            "source": "watch_device",
            "message": "Watch Blood Pressure measurement active on device",
        }))

    # Detect unsolicited BP/HR started directly on the watch screen
    if data[0] == 0xDF and data[4] == 0x03:
        subtype = data[6] if len(data) > 6 else 0
        sensor_type = "bp" if subtype == 1 else "hr"
        asyncio.create_task(broadcast_ws({
            "type": "sensor_state",
            "sensor": sensor_type,
            "measuring": True,
            "duration_sec": 25,
            "source": "watch_device",
            "message": f"Watch {sensor_type.upper()} optical sensor active on wrist",
        }))

    # Health decoding
    if data[0] == 0xDF and data[4] == 0x03 and data[6] in (0, 1, 2) and len(data) >= 13:
        hr = decode_hr_payload(data)
        if hr and (hr["bpm"] or hr["spo2"] or hr["bp_high"]):
            now_str = datetime.now().strftime("%H:%M:%S")
            if hr["bpm"]:
                last_hr_bpm = hr["bpm"]
            if hr["spo2"]:
                last_spo2 = hr["spo2"]
            if hr["bp_high"]:
                last_bp = (hr["bp_high"], hr["bp_low"])
            log("HEALTH", f"BPM={hr['bpm']} SpO2={hr['spo2']}% BP={hr['bp_high']}/{hr['bp_low']}")
            asyncio.create_task(broadcast_ws({
                "type": "heartrate",
                "bpm": hr["bpm"],
                "spo2": hr["spo2"],
                "bp_high": hr["bp_high"],
                "bp_low": hr["bp_low"],
                "time": now_str,
            }))
            # Reading captured -> measurement complete
            asyncio.create_task(broadcast_ws({
                "type": "sensor_state",
                "sensor": "bp" if hr["bp_high"] else "hr",
                "measuring": False,
                "bp_high": hr["bp_high"],
                "bp_low": hr["bp_low"],
                "bpm": hr["bpm"],
                "spo2": hr["spo2"],
                "time": now_str,
            }))


async def _maintain_link(client) -> None:
    """Bind, subscribe and hold the link open after a client is connected."""
    global ble_client, ble_connected, last_battery
    ble_client = client
    ble_connected = True
    log("BLE", "[+] Connected to D Watch7!")

    # Subscribe to notifications
    await client.start_notify(CHAR_NT, on_ble_notification)

    # Bind handshake
    bind_f = build_df_frame(0x08, 0x00, b"12345678")
    await client.write_gatt_char(CHAR_WR, bind_f, response=False)
    await asyncio.sleep(0.3)

    # Read battery
    try:
        bat_bytes = await client.read_gatt_char(CHAR_BAT)
        last_battery = bat_bytes[0]
        log("BLE", f"Battery: {last_battery}%")
    except Exception:
        last_battery = 85

    await broadcast_ws({
        "type": "status",
        "connected": True,
        "battery": last_battery,
    })

    # Maintain connection
    while client.is_connected:
        await asyncio.sleep(8.0)
        try:
            b = await client.read_gatt_char(CHAR_BAT)
            if b[0] != last_battery:
                last_battery = b[0]
                await broadcast_ws({"type": "battery", "level": last_battery})
        except Exception:
            pass


async def ble_worker_loop():
    global ble_client, ble_connected, last_battery, ble_failure_count, ble_last_failure
    if not BLE_AVAILABLE:
        log("BLE", f"Bleak is not installed; running the studio without a watch bridge. ({_BLE_IMPORT_ERROR})")
        await broadcast_ws({"type": "status", "connected": False})
        return
    log("BLE", f"Background worker initialized. Target: {WATCH_MAC}")

    while True:
        try:
            # Circuit breaker check
            now = time.time()
            if ble_failure_count >= BLE_MAX_FAILURES:
                if now - ble_last_failure < BLE_RESET_WINDOW:
                    log("BLE", f"Circuit breaker open ({ble_failure_count} failures), waiting {BLE_RESET_WINDOW}s...")
                    await asyncio.sleep(BLE_RESET_WINDOW)
                    ble_failure_count = 0
                else:
                    ble_failure_count = 0  # Reset after window

            device = await BleakScanner.find_device_by_address(WATCH_MAC, timeout=5.0)
            if not device:
                # The watch may be paired but not currently advertising. Fall back
                # to a direct connect on the known MAC; Windows resolves the
                # paired-device record so the link still comes up.
                try:
                    log("BLE", f"Not advertising yet; trying direct connect on {WATCH_MAC}...")
                    async with BleakClient(WATCH_MAC, timeout=20.0) as client:
                        await _maintain_link(client)
                    continue
                except Exception:
                    pass

                ble_connected = False
                await broadcast_ws({"type": "status", "connected": False})
                await asyncio.sleep(4.0)
                continue

            log("BLE", f"Found {device.name} ({WATCH_MAC}). Connecting...")
            async with BleakClient(device, timeout=25.0) as client:
                await _maintain_link(client)
                # Reset failure count on successful connection
                ble_failure_count = 0

        except Exception as e:
            ble_connected = False
            ble_failure_count += 1
            ble_last_failure = time.time()
            log("BLE", f"Link dropped: {e}. Reconnecting in 4s... (failures: {ble_failure_count})")
            await broadcast_ws({"type": "status", "connected": False})
            await asyncio.sleep(4.0)


# --- WebSocket Handler ---
async def ws_handler(websocket) -> None:
    global active_profile, keyboard_emulation_enabled, watch_button_triggers_bp, ws_msg_counts
    ws_clients.add(websocket)
    ws_msg_counts[websocket] = []
    try:
        # Initial greeting with state
        await websocket.send(json.dumps({
            "type": "status",
            "connected": ble_connected,
            "battery": last_battery,
            "profile": active_profile,
            "keyboard_emulation": keyboard_emulation_enabled,
            "watch_button_triggers_bp": watch_button_triggers_bp,
            "stats": stats,
            "heartrate": last_hr_bpm,
            "spo2": last_spo2,
            "bp": last_bp,
            "last_button": last_button,
        }))

        async for raw_msg in websocket:
            # Rate limiting
            now = time.time()
            ws_msg_counts[websocket] = [t for t in ws_msg_counts[websocket] if now - t < 1.0]
            if len(ws_msg_counts[websocket]) >= WS_MSG_RATE_LIMIT:
                await websocket.send(json.dumps({"type": "error", "message": "Rate limit exceeded"}))
                continue
            ws_msg_counts[websocket].append(now)

            try:
                msg = json.loads(raw_msg)
                if not isinstance(msg, dict):
                    raise ValueError("Message must be an object")
                mtype = msg.get("type")
                if not isinstance(mtype, str):
                    raise ValueError("Missing or invalid 'type'")

                elif mtype == "set_dial":
                    code = msg.get("code", "0001")
                    asyncio.create_task(switch_dial(code))

                elif mtype == "notification":
                    app = msg.get("app", "Lab Control")
                    title = msg.get("title", "Hello Watch")
                    content = msg.get("content", "Test notification from Dashboard!")
                    asyncio.create_task(push_notification(app, title, content))

                elif mtype in ("hr_request", "hr_trigger"):
                    asyncio.create_task(request_heart_rate())

                elif mtype in ("bp_request", "bp_trigger", "blood_pressure"):
                    asyncio.create_task(request_blood_pressure())

                elif mtype == "sync_time":
                    asyncio.create_task(sync_time())

                elif mtype == "raw_frame":
                    try:
                        def _num(v, fallback):
                            if isinstance(v, str):
                                return int(v, 16) if v.strip() else fallback
                            return int(v)
                        cmd = _num(msg.get("cmd", 0x06), 0x06)
                        key = _num(msg.get("key", 0x00), 0x00)
                        ver = _num(msg.get("ver", DEV_VER), DEV_VER)
                        if not all(0 <= n <= 0xFF for n in (cmd, key, ver)):
                            raise ValueError("cmd/key/ver out of range")
                        ph = str(msg.get("payload", "")).replace(" ", "").replace("0x", "")
                        if len(ph) % 2:
                            raise ValueError("payload has an odd number of hex digits")
                        payload = bytes.fromhex(ph)
                        if len(payload) > 240:
                            raise ValueError("payload too long")
                        asyncio.create_task(send_raw_frame(cmd, key, payload, ver))
                    except Exception as e:
                        await broadcast_ws({"type": "error", "message": f"Invalid raw frame: {e}"})

                elif mtype == "set_profile":
                    active_profile = msg.get("profile", "dodge")
                    keyboard_emulation_enabled = msg.get("keyboard_emulation", True)
                    await broadcast_ws({
                        "type": "profile_changed",
                        "profile": active_profile,
                        "keyboard_emulation": keyboard_emulation_enabled,
                    })

                elif mtype == "simulate_button":
                    btn = msg.get("button")
                    if btn:
                        handle_button_press(btn)

                elif mtype == "set_button_action":
                    action = msg.get("action", "bp")
                    watch_button_triggers_bp = (action == "bp")
                    log("WS", f"Watch button action configured: {action} (triggers_bp={watch_button_triggers_bp})")
                    await broadcast_ws({
                        "type": "button_action_changed",
                        "action": action,
                        "watch_button_triggers_bp": watch_button_triggers_bp,
                    })

            except Exception as e:
                log("WS", f"Message parse error: {e}")
    finally:
        ws_clients.discard(websocket)
        ws_msg_counts.pop(websocket, None)


# --- HTTP Static Server ---
class DashboardHTTPServer(http.server.ThreadingHTTPServer):
    """Threaded server with a deep accept queue.

    The stdlib default backlog is 5. A browser opening a handful of parallel
    asset connections (and Playwright running several pages at once) can
    overflow it, producing intermittent ECONNREFUSED on app.js / registry.js.
    """

    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 256


class DashboardHTTPHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    # Drop idle keep-alive sockets so threads do not accumulate per tab.
    timeout = 30

    def handle(self):
        # Browsers close keep-alive sockets abruptly; that is not an error worth
        # a traceback in the console.
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError):
            pass

    def log_message(self, format, *args):
        # Silence routine asset requests
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://use.fontawesome.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.fontawesome.com; font-src 'self' https://fonts.gstatic.com https://use.fontawesome.com; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:8780 ws://localhost:8780; frame-src 'self'")
        super().end_headers()

    def translate_path(self, path):
        # Never serve dotfiles (.git, .env) or their encoded variants.
        clean = unquote(path.split("?", 1)[0])
        if any(seg.startswith(".") and seg not in (".", "..") for seg in clean.split("/")):
            return str(ROOT_DIR / "__forbidden__")
        return super().translate_path(path)

    def do_GET(self):
        # Route all requests to the correct path
        if self.path in ("/", "/index.html"):
            self.path = "/index.html"
        return super().do_GET()


def start_http_server(port: int = HTTP_PORT):
    os.chdir(str(ROOT_DIR))
    server = DashboardHTTPServer((BIND_HOST, port), DashboardHTTPHandler)
    log("HTTP", f"Dashboard server running at: http://127.0.0.1:{port}")
    server.serve_forever()


# --- Main Entry ---
async def async_main() -> None:
    global async_loop
    async_loop = asyncio.get_running_loop()

    # Start HTTP in daemon thread
    http_thread = threading.Thread(target=start_http_server, args=(HTTP_PORT,), daemon=True)
    http_thread.start()

    # Start Windows SMTC media keys listener; the studio still works without it
    try:
        media_player_ref = start_media_listener()
    except Exception as e:
        log("SMTC", f"Media listener failed to start: {e}")
        media_player_ref = None

    print("\n" + "=" * 65)
    print("  WRISTLAB — D WATCH 7 DECODED STUDIO")
    print(f"  Studio URL:     http://127.0.0.1:{HTTP_PORT}")
    print(f"  BLE Device:     {WATCH_MAC}")
    print(f"  Audio Remote:   D Watch7-Audio (AVRCP SMTC)")
    print("=" * 65 + "\n")

    if websockets is None:
        log("WS", "The 'websockets' package is missing. Serving HTTP without a live bridge.")
        log("WS", "Install it with: pip install -r requirements.txt")
        if BLE_AVAILABLE:
            await ble_worker_loop()
        else:
            await asyncio.Event().wait()
        return

    # Start the WebSocket bridge
    log("WS", f"WebSocket Bridge listening on ws://127.0.0.1:{WS_PORT}")
    ws_server = await websockets.serve(ws_handler, BIND_HOST, WS_PORT)

    # Run BLE worker alongside the WebSocket server
    await asyncio.gather(
        ble_worker_loop(),
        ws_server.wait_closed(),
    )


def main():
    global BIND_HOST
    parser = argparse.ArgumentParser(description="WristLab: D Watch 7 decoded studio")
    parser.add_argument("--host", default=BIND_HOST,
                        help="interface to bind (default 127.0.0.1; use 0.0.0.0 to expose it on the LAN)")
    BIND_HOST = parser.parse_args().host
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        print("\n[*] Exiting D Watch 7 Dashboard server.")


if __name__ == "__main__":
    main()
