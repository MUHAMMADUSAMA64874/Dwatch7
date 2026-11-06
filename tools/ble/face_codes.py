"""Try built-in dial codes via cmdId 11 key 3 (setWatchFace) and read back."""
import asyncio
from pathlib import Path

from bleak import BleakClient

ADDR = "C2:FC:01:BC:D4:1F"
WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"
LOG = Path(__file__).parent / "face_codes.txt"

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5) >> 8, (len(payload)+5) & 0xFF, b2, ver, b3, len(payload) >> 8, len(payload) & 0xFF]) + payload
    return raw[:3] + bytes([sum(raw) & 0xFF]) + raw[3:]

def log(m=""):
    try: print(m)
    except UnicodeEncodeError: print(m.encode("ascii", "replace").decode())
    with open(LOG, "a", encoding="utf-8") as f: f.write(m + "\n")

CODES = ["0000", "0001", "0002", "0003", "0004", "0005", "0100", "0200", "0300", "8000", "8001", "8002", "8003",
         "8004", "8005", "8006", "8007", "9001", "9002", "A001", "A002", "B001", "C001", "D001", "E001", "F001",
         "0008", "0010", "0101", "0202"]

async def main():
    client = None
    for i in range(6):
        try:
            client = BleakClient(ADDR, timeout=20); await client.connect(); break
        except Exception as e:
            client = None; await asyncio.sleep(4)
    if not client:
        log("no connect"); return
    async with client:
        seen = []
        async def h(s, d):
            d = bytes(d)
            if d and d[0] == 0xDF and len(d) > 8:
                cmd, ver, key = d[4], d[5], d[6]
                plen = (d[7] << 8) | d[8]
                pl = d[9:9+plen]
                seen.append((cmd, key, pl))
                log(f"DF cmd={cmd} key={key} payload={pl.hex()}")
                await client.write_gatt_char(WRITE, bytes([0xFD, 0, 6, cmd, ver, key, 0, 1, 0]), response=False)
            else:
                log(f"NOTIFY {d.hex()}")
        await client.start_notify(NOTIFY, lambda s, d: asyncio.create_task(h(s, d)))
        await client.write_gatt_char(WRITE, frame(0, 0, b"\x00"), response=False)
        await asyncio.sleep(1.2)
        for code in CODES:
            before = len(seen)
            log(f">> setWatchFace(11,3,{code})")
            await client.write_gatt_char(WRITE, frame(11, 3, bytes.fromhex(code)), response=False)
            await asyncio.sleep(1.6)
            new = seen[before:]
            if new:
                for cmd, key, pl in new:
                    if cmd == 11:
                        log(f"   -> DF cmd11 key{key} {pl.hex()}")
            else:
                log("   (no data frame)")

asyncio.run(main())