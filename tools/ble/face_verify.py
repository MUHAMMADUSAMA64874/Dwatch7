"""Set one built-in dial code and read back the custom dial descriptor."""
import asyncio
import sys
from pathlib import Path

from bleak import BleakClient

ADDR = "C2:FC:01:BC:D4:1F"
WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"
LOG = Path(__file__).parent / "face_verify.txt"

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5) >> 8, (len(payload)+5) & 0xFF, b2, ver, b3, len(payload) >> 8, len(payload) & 0xFF]) + payload
    return raw[:3] + bytes([sum(raw) & 0xFF]) + raw[3:]

def log(m=""):
    try: print(m)
    except UnicodeEncodeError: print(m.encode("ascii", "replace").decode())
    with open(LOG, "a", encoding="utf-8") as f: f.write(m + "\n")

async def main():
    code = sys.argv[1] if len(sys.argv) > 1 else "0001"
    client = None
    for i in range(6):
        try:
            client = BleakClient(ADDR, timeout=20); await client.connect(); break
        except Exception:
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
                if cmd == 11 and key == 5 and len(pl) >= 11:
                    log(f"DIAL face={pl[0:2].hex()} timeX={(pl[2]<<8)|pl[3]} timeY={(pl[4]<<8)|pl[5]} color=0x{((pl[6]<<8)|pl[7]):04X} above={pl[8]} below={pl[9]} bg={pl[10]}")
                else:
                    log(f"DF cmd={cmd} key={key} {pl.hex()}")
                await client.write_gatt_char(WRITE, bytes([0xFD, 0, 6, cmd, ver, key, 0, 1, 0]), response=False)
            else:
                log(f"NOTIFY {d.hex()}")
        await client.start_notify(NOTIFY, lambda s, d: asyncio.create_task(h(s, d)))
        await client.write_gatt_char(WRITE, frame(0, 0, b"\x00"), response=False)
        await asyncio.sleep(1.2)
        log(f">> setWatchFace(11,3,{code})")
        await client.write_gatt_char(WRITE, frame(11, 3, bytes.fromhex(code)), response=False)
        await asyncio.sleep(2.5)
        log(">> getCustomizeFaceInfo(11,4)")
        await client.write_gatt_char(WRITE, frame(11, 4, b"\x01"), response=False)
        await asyncio.sleep(2.5)

asyncio.run(main())