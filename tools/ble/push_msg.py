"""Push a notification to the watch like M2Wear does."""
import asyncio
import sys
import time
from pathlib import Path

from bleak import BleakClient, BleakScanner

ADDR = "C2:FC:01:BC:D4:1F"
WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5) >> 8, (len(payload)+5) & 0xFF, b2, ver, b3, len(payload) >> 8, len(payload) & 0xFF]) + payload
    return raw[:3] + bytes([sum(raw) & 0xFF]) + raw[3:]

def push_msg(nid, app, title, content):
    b_app = app.encode(); b_title = title.encode(); b_content = content.encode()
    ts = int(time.time())
    bArr = bytearray(20 + len(b_app) + len(b_title) + len(b_content))
    bArr[0] = (nid >> 8) & 0xFF; bArr[1] = nid & 0xFF
    bArr[2] = (ts >> 24) & 0xFF; bArr[3] = (ts >> 16) & 0xFF; bArr[4] = (ts >> 8) & 0xFF; bArr[5] = ts & 0xFF
    na = len(b_app); nt = len(b_title); nc = len(b_content)
    bArr[6] = na; bArr[7:7+na] = b_app
    bArr[7+na] = nt; bArr[8+na:8+na+nt] = b_title
    bArr[8+na+nt] = (nc >> 8) & 0xFF; bArr[9+na+nt] = nc & 0xFF
    bArr[10+na+nt:10+na+nt+nc] = b_content
    total = 10 + na + nt + nc
    return frame(10, 0, bytes(bArr[:total]))

async def main():
    devices = await BleakScanner.discover(timeout=10)
    watch = next((d for d in devices if d.name and ("watch" in d.name.lower() or "d watch" in d.name.lower())), None) or devices[0]
    print("watch:", watch.name, watch.address)
    async with BleakClient(watch.address, timeout=20) as client:
        await client.start_notify(NOTIFY, lambda s, d: print(f"NOTIFY: {bytes(d).hex()}"))
        # features handshake to set deviceVersion=4
        h = bytearray(); 
        feat = frame(0, 0, b"\x00")
        await client.write_gatt_char(WRITE, feat, response=False)
        await asyncio.sleep(1.5)
        cmd = push_msg(1, "M2Wear-Probe", "Hello", "This notification came from a Python script!")
        print(">> sendMsg:", cmd.hex())
        await client.write_gatt_char(WRITE, cmd, response=False)
        await asyncio.sleep(3)
        # delete the message (clears it)
        dele = frame(10, 1, b"\x00\x01")
        await client.write_gatt_char(WRITE, dele, response=False)
        await asyncio.sleep(1)
        print("done")

asyncio.run(main())
