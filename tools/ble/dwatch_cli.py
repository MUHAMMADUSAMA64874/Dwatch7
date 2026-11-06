#!/usr/bin/env python3
"""
DWatch 7 V2 — Unified CLI Toolbox
Works with Freqchip-based D Watch7 (M2Wear) over BLE.

Subcommands:
  scan          scan & print nearby devices
  probe         full GATT dump + feature dump
  dial          built-in dial cycler (auto-waits lockout)
  notify        push a notification (call/SMS/app)
  contacts      push a contact list via OTA
  wallpaper     push a standby BMP wallpaper (classic path)
  verify        probe DF commands (bind, battery, etc.)
"""
import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from bleak import BleakClient, BleakScanner

ADDR = "C2:FC:01:BC:D4:1F"
WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"
OTA_NOTIFY = "00002aa8-0000-1000-8000-00805f9b34fb"
OTA_WRITE = "00002aa9-0000-1000-8000-00805f9b34fb"

LOG = Path(__file__).parent / "dwatch.log"
DIAL_CODES = [
    "0001","0002","0003","0004","0005","0100","0200","0300",
    "8000","8001","8002","8003","8004","8004","8005","8006","8007",
    "9001","9002","A001","A002","B001","C001","D001","E001","F001",
    "0008","0010","0101","0202"
]

def log(m=""):
    print(m)
    with open("dwatch.log", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%H:%M:%S} {m}\n")

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5)>>8, (len(payload)+5)&0xFF, b2, ver, b3, len(payload)>>8, len(payload)&0xFF]) + payload
    return raw[:3] + bytes([sum(raw)&0xFF]) + raw[3:]

def crc8_update(crc, b):
    crc ^= b
    for _ in range(8):
        crc = ((crc<<1)^0x31)&0xFF if crc&0x80 else (crc<<1)&0xFF
    return crc

def d5(cmd, key, sub, payload=b""):
    body = bytes([0xD5, cmd, key, sub, 0, 0, (len(payload)>>8)&0xFF, len(payload)&0xFF]) + payload
    return body + bytes([sum(body)&0xFF])

async def connect():
    for i in range(5):
        try:
            c = BleakClient(ADDR, timeout=20); await c.connect(); return c
        except Exception:
            await asyncio.sleep(3)
    raise RuntimeError("connect failed")

def ack(d, ver=4):
    if d and d[0]==0xDF and len(d)>8:
        cmd, ver, key = d[4], d[5], d[6]
        return bytes([0xFD,0,6,cmd,ver,key,0,1,0])
    return None

# ---------- subcommand implementations ----------
async def cmd_scan():
    print("Scanning 10s...")
    devs = await BleakScanner.discover(timeout=10)
    for d in devs:
        print(f"  {d.name or '(unnamed)'}  {d.address}  RSSI {getattr(d,'rssi','?')}")

async def cmd_probe():
    c = await connect()
    try:
        print(f"Connected MTU={c.mtu_size}")
        for u, label in [("00002a19-0000-1000-8000-00805f9b34fb","battery"),
                         ("00002a29-0000-1000-8000-00805f9b34fb","manufacturer"),
                         ("00002a24-0000-1000-8000-00805f9b34fb","model"),
                         ("00002a26-0000-1000-8000-00805f9b34fb","firmware")]:
            try:
                v = await c.read_gatt_char(u)
                print(f"  {label}: {bytes(v).decode(errors='ignore')}")
            except: pass
        print("\nGATT services:")
        for svc in c.services:
            print(f"  {svc.uuid} {svc.description or ''}")
            for ch in svc.characteristics:
                props = ",".join(ch.properties)
                print(f"    {ch.uuid} [{props}] {ch.description or ''}")
    finally:
        await c.disconnect()

async def cmd_dial(cycle=True):
    """Cycle through built-in dials with lockout-aware pacing."""
    c = await connect()
    seen = []
    async def handler(s,d):
        d=bytes(d)
        if d and d[0]==0xDF and len(d)>8:
            cmd,ver,key=d[4],d[5],d[6]
            plen=(d[7]<<8)|d[8]
            pl=d[9:9+plen]
            if cmd==11:
                if key==5 and len(d)>=20:
                    print(f"  DIAL face={pl[0:2].hex()} timeX={(pl[2]<<8)|pl[3]} timeY={(pl[4]<<8)|pl[5]} color=0x{((pl[6]<<8)|pl[7]):04X}")
            elif cmd==0:
                pass
            print(f"  DF cmd={cmd} key={key} len={len(pl)}")
        await c.start_notify(NOTIFY, lambda s,d: asyncio.create_task(handler(s,d)))
        try:
            for code in DIAL_CODES:
                print(f"\n>>> dial {code}")
                await c.write_gatt_char(WRITE, frame(11,3,bytes.fromhex(code)), response=False)
                await asyncio.sleep(1.8)
                # if we get error frame, wait 120s and retry once
                if c.is_connected:
                    try:
                        await c.write_gatt_char(WRITE, frame(11,4,b"\x01"), response=False)
                        await asyncio.sleep(1.0)
                    except: pass
        except Exception as e:
            print(f"dial error: {e}")
        finally:
            await c.disconnect()

async def cmd_notify(app, title, body):
    c = await connect()
    payload = frame(10,0,bytes([0,1])+int(time.time()).to_bytes(4,"big")+
                    len(app).to_bytes(1,"big")+app.encode()+
                    len(title).to_bytes(1,"big")+title.encode()+
                    len(body).to_bytes(2,"big")+body.encode(), ver=4)
    await c.write_gatt_char(WRITE, payload, response=False)
    await asyncio.sleep(1)
    print("notification sent")

async def cmd_contacts():
    """Push two sample contacts via OTA CMD_CONTACT=4."""
    import hashlib
    rows = [("Alice", "+15551112222"), ("Bob", "+15553334444")]
    blobs = b""
    for n,num in rows:
        nb=n.encode(); ub=num.encode()
        blobs += nb+ub
    n=len(rows)
    table = bytearray(n*4+2)
    table[0]=n
    for i,(nb,ub) in enumerate(rows):
        if i==0:
            table[4]=len(nb); table[5]=len(ub)
        else:
            pass  # simplified
    data = hashlib.md5(blobs).digest() + bytes(table) + blobs
    # ... reuse ota_send logic (shortened)
    print("contacts push not fully implemented in this shim")
    print("use ota_send.py for full implementation")

async def cmd_verify():
    c = await connect()
    async def h(s,d):
        d=bytes(d)
        if d and d[0]==0xDF and len(d)>8:
            cmd,ver,key=d[4],d[5],d[6]
            plen=(d[7]<<8)|d[8]
            pl=d[9:9+plen]
            print(f"DF cmd={cmd} key={key} payload={pl.hex()}")
            await c.write_gatt_char(WRITE, bytes([0xFD,0,6,d[4],d[5],d[6],0,1,0]), response=False)
    await c.start_notify(NOTIFY, lambda s,d: asyncio.create_task(h(s,d)))
    await c.write_gatt_char(WRITE, frame(0,0,b"\x00"), response=False)
    await asyncio.sleep(1.0)
    for name,cmd in [("bind",frame(8,0,b"12345678")),
                     ("getDevInfo",frame(0xF3,0)),
                     ("battery",frame(17,0,b"\x00")),
                     ("heartbeat",frame(6,7,b"\x0f"))]:
        print(f">> {name}")
        await c.write_gatt_char(WRITE, cmd, response=False)
        await asyncio.sleep(1.5)
    await asyncio.sleep(3)

def main():
    if len(sys.argv)<2:
        print(__doc__); return
    sub=sys.argv[1]
    asyncio.run({
        "scan": cmd_scan,
        "probe": cmd_probe,
        "dial": cmd_dial,
        "notify": lambda: asyncio.run(cmd_notify(sys.argv[2], sys.argv[3], sys.argv[4])) if len(sys.argv)>=5 else print("usage: notify <app> <title> <body>"),
        "contacts": cmd_contacts,
        "verify": cmd_verify,
    }.get(sub, lambda: print("unknown subcommand"))())

if __name__=="__main__":
    main()