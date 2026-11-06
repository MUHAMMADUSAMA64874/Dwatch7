"""
DWatch 7 V2 (M2Wear) - Hardware Probe & Test
Scans for the watch over BLE, connects, enumerates all GATT
services/characteristics, reads battery/device info, subscribes to
all notify/indicate channels for a listening window, and logs
everything to a timestamped file.
"""
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from bleak import BleakScanner, BleakClient

LOG_DIR = Path(__file__).parent
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOG_DIR / f"watch_test_log_{timestamp}.txt"
JSON_FILE = LOG_DIR / f"watch_probe_{timestamp}.json"

WATCH_NAME_HINTS = ["dwatch", "m2", "z8", "watch", "hw", "band", "smart", "fitness", "miband", "wear", "g7", "t8", "x6"]

log_lines = []
def log(msg: str = ""):
    print(msg)
    log_lines.append(msg)

def save_log():
    LOG_FILE.write_text("\n".join(log_lines), encoding="utf-8")
    print(f"\nLog saved to: {LOG_FILE}")

async def scan_devices(timeout: int = 10):
    log(f"Scanning for BLE devices for {timeout}s...")
    devices = await BleakScanner.discover(timeout=timeout)
    log(f"Found {len(devices)} device(s):\n")
    for i, d in enumerate(devices):
        name = d.name or "(unnamed)"
        rssi = getattr(d, "rssi", None)
        log(f"  [{i}] {name}  |  {d.address}  |  RSSI: {rssi if rssi is not None else '?'}")
    return devices

def pick_watch(devices):
    for d in devices:
        if d.name and any(h in d.name.lower() for h in WATCH_NAME_HINTS):
            return d
    return None

async def probe_device(device):
    log(f"\nConnecting to {device.name} ({device.address})...")
    result = {"address": device.address, "name": device.name, "services": []}
    notify_log = []
    try:
        async with BleakClient(device.address, timeout=20) as client:
            log(f"Connected: {client.is_connected}")
            try:
                result["mtu"] = client.mtu_size
                log(f"MTU: {client.mtu_size}")
            except Exception:
                pass

            try:
                batt = await client.read_gatt_char("00002a19-0000-1000-8000-00805f9b34fb")
                log(f"Battery Level: {batt[0]}%")
                result["battery"] = batt[0]
            except Exception:
                log("Battery Level: not readable")

            for uuid, label in [
                ("00002a29-0000-1000-8000-00805f9b34fb", "manufacturer"),
                ("00002a24-0000-1000-8000-00805f9b34fb", "model"),
                ("00002a26-0000-1000-8000-00805f9b34fb", "firmware"),
            ]:
                try:
                    val = await client.read_gatt_char(uuid)
                    text = bytes(val).decode(errors='ignore')
                    log(f"{label}: {text}")
                    result[label] = text
                except Exception:
                    pass

            log("\n--- GATT Services & Characteristics ---")
            subscribed = []
            for service in client.services:
                log(f"\nService: {service.uuid}  {service.description or ''}")
                svc = {"uuid": service.uuid, "description": service.description, "characteristics": []}
                for char in service.characteristics:
                    props = ",".join(char.properties)
                    log(f"  Char: {char.uuid}  props=[{props}]  {char.description or ''}")
                    c = {"uuid": char.uuid, "properties": list(char.properties), "description": char.description}
                    if "read" in char.properties:
                        try:
                            val = await client.read_gatt_char(char.uuid)
                            c["value_hex"] = bytes(val).hex()
                            c["value_str"] = bytes(val).decode(errors='ignore')
                            log(f"    value: {c['value_str']!r} (0x{c['value_hex']})")
                        except Exception as e:
                            c["read_error"] = str(e)
                            log(f"    read error: {e}")
                    if "notify" in char.properties or "indicate" in char.properties:
                        try:
                            def handler(_sender, data, u=char.uuid):
                                entry = {"uuid": u, "hex": bytes(data).hex(), "ts": datetime.now().strftime("%H:%M:%S.%f")[:-3]}
                                notify_log.append(entry)
                                log(f"  NOTIFY <- {u}: 0x{bytes(data).hex()}")
                            await client.start_notify(char.uuid, handler)
                            subscribed.append(char.uuid)
                            c["subscribed"] = True
                        except Exception as e:
                            log(f"    notify subscribe failed: {e}")
                    svc["characteristics"].append(c)
                result["services"].append(svc)

            log(f"\nListening for packets on {len(subscribed)} notify channel(s) for 8s... (press buttons on the watch now)")
            await asyncio.sleep(8)
            for u in subscribed:
                try:
                    await client.stop_notify(u)
                except Exception:
                    pass
            result["notify_packets"] = notify_log
            log("\n--- End of probe ---")
    except Exception as e:
        log(f"Connection failed: {e}")
        result["error"] = str(e)
    return result

async def main():
    log(f"=== DWatch Probe started {datetime.now()} ===\n")
    devices = await scan_devices()
    if not devices:
        log("No BLE devices found. Make sure Bluetooth is on, the watch is advertising (screen on, near PC), and the phone app is NOT connected.")
        save_log()
        return
    watch = pick_watch(devices)
    if watch is None:
        log("\nNo watch-like name detected. Pick by index:")
        try:
            idx = int(input("Enter index: "))
            watch = devices[idx]
        except Exception:
            log("Invalid selection. Exiting.")
            save_log()
            return
    else:
        log(f"\nAuto-detected watch: {watch.name} ({watch.address})")
    result = await probe_device(watch)
    JSON_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"\nJSON probe saved to: {JSON_FILE}")
    save_log()

if __name__ == "__main__":
    asyncio.run(main())
