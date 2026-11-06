"""List the watch's built-in dial codes (cmdId 11, key 9) and switch dials."""
import asyncio
from pathlib import Path

from bleak import BleakClient

ADDR = "C2:FC:01:BC:D4:1F"
WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"
LOG = Path(__file__).parent / "face_list.txt"

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5) >> 8, (len(payload)+5) & 0xFF, b2, ver, b3, len(payload) >> 8, len(payload) & 0xFF]) + payload
    return raw[:3] + bytes([sum(raw) & 0xFF]) + raw[3:]

def log(m=""):
    try: print(m)
    except UnicodeEncodeError: print(m.encode("ascii", "replace").decode())
    with open(LOG, "a", encoding="utf-8") as f: f.write(m + "\n")

async def main():
    client = None
    for i in range(6):
        try:
            client = BleakClient(ADDR, timeout=20); await client.connect(); break
        except Exception as e:
            log(f"connect retry {i+1}: {e}"); client = None; await asyncio.sleep(5)
    if not client:
        log("no connect"); return
    async with client:
        frames = []
        async def h(s, d):
            d = bytes(d)
            if d and d[0] == 0xDF and len(d) > 8:
                cmd, ver, key = d[4], d[5], d[6]
                plen = (d[7] << 8) | d[8]
                pl = d[9:9+plen]
                log(f"DF cmdId={cmd} key={key} payLen={plen} payload={pl.hex()}")
                frames.append((cmd, key, pl))
                await client.write_gatt_char(WRITE, bytes([0xFD, 0, 6, cmd, ver, key, 0, 1, 0]), response=False)
            else:
                log(f"NOTIFY: {d.hex()}")
        await client.start_notify(NOTIFY, lambda s, d: asyncio.create_task(h(s, d)))
        await client.write_gatt_char(WRITE, frame(0, 0, b"\x00"), response=False)
        await asyncio.sleep(1.2)
        log(">> getFaceCodeList (11,9)")
        await client.write_gatt_char(WRITE, frame(11, 9, b"\x01"), response=False)
        await asyncio.sleep(2.5)
        codes = []
        for cmd, key, pl in frames:
            if cmd == 11 and key == 9:
                num = pl[0]
                cur = pl[1:3].hex()
                codes = [pl[3 + i*2: 5 + i*2].hex() for i in range(num)]
                log(f"num={num} current={cur} codes={codes}")
        if not codes:
            log("no dial codes returned"); return
        for c in codes:
            log(f">> setWatchFace -> {c}")
            await client.write_gatt_char(WRITE, frame(11, 3, bytes.fromhex(c)), response=False)
            await asyncio.sleep(2.0)
        # restore / customize: faceCode 0x8003 with new clock position + color
        custom = bytes([0x80, 0x03, 0x00, 0x40, 0x00, 0x60, 0x1F, 0xF8, 0x04, 0x01, 0x02])
        log(f">> setCustomWatchFace: {custom.hex()}")
        await client.write_gatt_char(WRITE, frame(11, 5, custom), response=False)
        await asyncio.sleep(2.5)
        log(">> query back (11,4)")
        await client.write_gatt_char(WRITE, frame(11, 4, b"\x01"), response=False)
        await asyncio.sleep(2.5)

asyncio.run(main())