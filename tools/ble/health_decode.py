'''Focused, non-medical BLE health capture for D Watch7.

Runs app-equivalent HR/BP/SpO2 requests separately and prints only structurally
valid history records. These values are not clinically validated.
'''
import asyncio
import argparse
from datetime import datetime
from sweep import (DATA_W, KNOWN_ADDR, Session, ack_frame, parse_frame,
                   resolve_addr, HERE)

# BleDataUtils.handleHealthData indexes the entire DF frame (not just payload).
def decode_health(raw_hex):
    raw = bytes.fromhex(raw_hex)
    parsed = parse_frame(raw)
    if not parsed or parsed[0] != "DF" or parsed[1] != 3 or len(raw) < 13:
        return None
    subtype = raw[6]
    if subtype not in (0, 1, 2):
        return None
    count = int.from_bytes(raw[11:13], "big")
    if len(raw) < 13 + count * 8:
        return {"subtype": subtype, "count": count, "error": "truncated record(s)"}
    records = []
    for n in range(count):
        b = raw[13 + n * 8:21 + n * 8]
        record = {"time_raw": b[:4].hex(), "mode": b[4]}
        if subtype == 0:
            record["hr_bpm"] = b[7] if b[7] >= 30 else None
        elif subtype == 1:
            record["bp_high"] = b[6]
            record["bp_low"] = b[7]
            if b[6] < 50 or not 30 <= b[7] <= 200:
                record["invalid"] = True
        else:
            record["spo2_percent"] = b[7] if b[7] <= 100 else None
        records.append(record)
    return {"subtype": subtype, "count": count, "records": records}

async def run(target="all"):
    log = HERE / f"health_capture_{datetime.now():%Y%m%d_%H%M%S}.log"
    s = Session(log, {})
    addr = await resolve_addr()
    s.log("SYS", f"connecting to {addr} (target {KNOWN_ADDR})")
    try:
        await s.connect()
        # A single known healthy read tests the link without altering settings.
        await s.probe(3, 0, b"\x01", wait=1, tag="control")
        for label, key in (("HR", 4), ("BP", 5), ("SpO2", 6)):
            if target != "all" and label != target:
                continue
            s.log("SYS", f"starting {label} with app payload 01; collecting 22 seconds")
            start = len(s.journal)
            await s.probe(6, key, b"\x01", wait=1, tag=f"start_{label}")
            # ACK DF as soon as received so the watch can continue its transfer.
            deadline = asyncio.get_running_loop().time() + 22
            processed = set()
            while asyncio.get_running_loop().time() < deadline:
                for j in s.journal[start:]:
                    if j["hdr"] == "DF" and j["t"] not in processed:
                        processed.add(j["t"])
                        decoded = decode_health(j["raw"])
                        if decoded is not None:
                            s.log("DATA", f"{label}: {decoded} raw={j['raw']}")
                        await s.client.write_gatt_char(
                            DATA_W, ack_frame(j["cmd"], j["ver"], j["key"]),
                            response=False)
                await asyncio.sleep(0.2)
            for read_key in (0, 8, 10):
                replies, _ = await s.probe(3, read_key, b"\x01", wait=1,
                                           tag=f"after_{label}")
                for j in replies:
                    decoded = decode_health(j["raw"])
                    if decoded is not None:
                        s.log("DATA", f"{label} read {read_key}: {decoded} raw={j['raw']}")
        s.log("SYS", f"capture complete; log={log}")
    finally:
        await s.disconnect()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=("all", "HR", "BP", "SpO2"), default="all")
    asyncio.run(run(parser.parse_args().target))
