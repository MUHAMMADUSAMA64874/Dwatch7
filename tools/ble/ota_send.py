"""Push contacts to the watch via the OTA channel (CMD_CONTACT=4)."""
import asyncio
import time
from pathlib import Path

from bleak import BleakClient, BleakScanner

ADDR = "C2:FC:01:BC:D4:1F"
DATA_WRITE = "00002aad-0000-1000-8000-00805f9b34fb"
DATA_NOTIFY = "00002aac-0000-1000-8000-00805f9b34fb"
OTA_NOTIFY = "00002aa8-0000-1000-8000-00805f9b34fb"
OTA_WRITE = "00002aa9-0000-1000-8000-00805f9b34fb"

CONTACTS = [("John Doe", "+15551234567"), ("Jane", "555-0199")]
LOG = Path(__file__).parent / "ota_contact_log.txt"

def log(m=""):
    try: print(m)
    except UnicodeEncodeError: print(m.encode("ascii", "replace").decode())
    with open(LOG, "a", encoding="utf-8") as f: f.write(m + "\n")

def frame(b2, b3, payload=b"", ver=4):
    raw = bytes([0xDF, (len(payload)+5) >> 8, (len(payload)+5) & 0xFF, b2, ver, b3, len(payload) >> 8, len(payload) & 0xFF]) + payload
    return raw[:3] + bytes([sum(raw) & 0xFF]) + raw[3:]

def build_contact_file():
    import hashlib
    rows = []
    for name, num in CONTACTS:
        nb = name.encode(); ub = num.encode()
        rows.append((nb, ub))
    n = len(rows)
    table_len = n * 4 + 2
    payload = bytearray()
    for nb, ub in rows: payload.extend(nb); payload.extend(ub)
    blob = bytearray(table_len + len(payload))
    blob[0] = n
    offset = 0
    for i, (nb, ub) in enumerate(rows):
        if i == 0:
            blob[4] = len(nb); blob[5] = len(ub)
        else:
            blob[i*4+2] = offset & 0xFF; blob[i*4+3] = (offset >> 8) & 0xFF
            blob[i*4+4] = len(nb); blob[i*4+5] = len(ub)
        offset += len(nb) + len(ub)
    blob[table_len:] = payload
    md5 = hashlib.md5(bytes(blob)).digest()
    return md5 + bytes(blob)

def d5(cmd_id, key, sub, payload=b""):
    body = bytes([0xD5, cmd_id, key, sub, 0, 0, (len(payload) >> 8) & 0xFF, len(payload) & 0xFF]) + payload
    return body + bytes([sum(body) & 0xFF])

def crc8_update(crc, data):
    crc ^= data
    for _ in range(8):
        crc = ((crc << 1) ^ 0x31) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc

async def main():
    devices = await BleakScanner.discover(timeout=10)
    watch = next((d for d in devices if d.name and ("watch" in d.name.lower() or "d watch" in d.name.lower())), None) or devices[0]
    print("watch:", watch.name)
    async with BleakClient(watch.address, timeout=20) as client:
        mtu = client.mtu_size
        log(f"mtu={mtu}")
        ota_frame = asyncio.Queue()
        data_frame = asyncio.Queue()
        async def ota_handler(s, d):
            d = bytes(d)
            log(f"OTA NOTIFY: {d.hex()}")
            await ota_frame.put(d)
        async def data_handler(s, d):
            d = bytes(d)
            log(f"DATA NOTIFY: {d.hex()}")
            await data_frame.put(d)
        await client.start_notify(OTA_NOTIFY, lambda s, d: asyncio.create_task(ota_handler(s, d)))
        await client.start_notify(DATA_NOTIFY, lambda s, d: asyncio.create_task(data_handler(s, d)))
        # features handshake to bump deviceVersion to 4
        await client.write_gatt_char(DATA_WRITE, frame(0, 0, b"\x00"), response=False)
        await asyncio.sleep(1.0)
        data = build_contact_file()
        log(f"contact file size={len(data)} md5+blob preview={data[:20].hex()}")
        # startOTA(mainId=4, secondId=1, sub=1, devMtu-3, fileLen)
        i2 = mtu - 3
        start = d5(4, 1, 1, bytes([(i2 >> 8) & 0xFF, i2 & 0xFF]) + len(data).to_bytes(4, "big"))
        log(f">> startOTA: {start.hex()}")
        await client.write_gatt_char(OTA_WRITE, start, response=True)
        try:
            p = await asyncio.wait_for(ota_frame.get(), timeout=6)
        except asyncio.TimeoutError:
            log("no params reply from watch"); return
        log(f"params reply: {p.hex()}")
        if p[3] != 0x81:
            log("unexpected: params marker != 0x81"); return
        dev_mtu = (p[8] << 8) | p[9]
        interval = (p[10] << 8) | p[11]
        group_pac_num = p[12]
        timeout_s = p[13] * 5
        log(f"dev_mtu={dev_mtu} interval={interval} group_pac_num={group_pac_num} timeout={timeout_s}s")
        # slice into packets of dev_mtu-1
        pkt_size = dev_mtu - 1
        pkts = [data[i:i+pkt_size] for i in range(0, len(data), pkt_size)]
        log(f"packets={len(pkts)} pkt_size={pkt_size}")
        idx = 0
        while idx < len(pkts):
            group = pkts[idx:idx+group_pac_num]
            xor = 0
            group_crc = 0
            for pk in group:
                for b in pk:
                    xor ^= b
                    group_crc = crc8_update(group_crc, b)
                wire = bytes([0xD6]) + pk
                await client.write_gatt_char(OTA_WRITE, wire, response=True)
                await asyncio.sleep(max(interval/1000.0, 0.01))
            # group CRC byte
            await client.write_gatt_char(OTA_WRITE, d5(4, 1, 2, bytes([group_crc & 0xFF])), response=True)
            log(f"group {idx//group_pac_num}: xor={xor:02x} fileCRC so far")
            try:
                r = await asyncio.wait_for(ota_frame.get(), timeout=8)
                log(f"OTA reply: {r.hex()}")
                if r[3] == 0x82 and r[5] == 0:
                    pass
                elif r[3] == 0x83:
                    log("finish reported early"); return
                elif r[3] == 0x82 and r[5] != 0:
                    log("error in group"); return
            except asyncio.TimeoutError:
                log("no reply after group"); return
            idx += len(group)
        # file CRC
        file_crc = 0
        for b in data:
            file_crc = crc8_update(file_crc, b)
        await client.write_gatt_char(OTA_WRITE, d5(4, 1, 3, bytes([file_crc & 0xFF])), response=True)
        log(f">> fileCRC={file_crc:02x}")
        try:
            r = await asyncio.wait_for(ota_frame.get(), timeout=8)
            log(f"OTA reply: {r.hex()}")
        except asyncio.TimeoutError:
            log("no finish reply"); return
        if r[3] == 0x83 and r[5] == 0:
            log("CONTACT SYNC OK")
        else:
            log(f"unexpected finish: {r.hex()}")

asyncio.run(main())
