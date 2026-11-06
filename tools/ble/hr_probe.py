"""DWatch7 honest heart-rate experiment (from `next test.md`).

Steps implemented:
  1. Send HR query CMD 0x03 / trigger 0x06 key 0x04 — observe single vs stream.
  2. Check for standard BLE Heart Rate Measurement (svc 0x180D / char 0x2A37) notify.
  3. Poll at intervals (default every 2 s) — usable stress signal even without streaming.
  4. Log every reading timestamped to console + file for sit -> walk -> jumping-jacks test.

Decode follows M2Wear BleDataUtils.handleHealthData (see health_decode.py):
  DF cmd 3 key 0/1/2, bytes 9-10 packed date, 11-12 count BE, 8-B records from
  offset 13, HR/SpO2 at +7, BP hi/lo at +6/+7. Values are watch-reported,
  NOT medical-grade.

Usage:
    python hr_probe.py --target HR
    python hr_probe.py --target all --poll 2 --duration 180
    python hr_probe.py --target HR --no-trigger   # poll-only, no (6,4) measure
"""
import argparse
import asyncio
import csv
from datetime import datetime
from pathlib import Path

from sweep import HERE, Session, ack_frame, DATA_W, resolve_addr

HR_SVC = "0000180d-0000-1000-8000-00805f9b34fb"
HR_CH = "00002a37-0000-1000-8000-00805f9b34fb"

TRIGGER_KEYS = {"HR": 4, "BP": 5, "SpO2": 6}
READ_KEYS = (0, 8, 10)


def decode_health(raw_hex):
    raw = bytes.fromhex(raw_hex)
    if len(raw) < 13 or raw[0] != 0xDF or raw[4] != 3:
        return None
    subtype = raw[6]
    if subtype not in (0, 1, 2):
        return None
    count = int.from_bytes(raw[11:13], "big")
    if len(raw) < 13 + count * 8:
        return {"subtype": subtype, "count": count, "error": "truncated"}
    records = []
    for n in range(count):
        b = raw[13 + n * 8:21 + n * 8]
        rec = {"time_raw": b[:4].hex(), "mode": b[4]}
        if subtype == 0:
            rec["hr_bpm"] = b[7] if b[7] >= 30 else None
        elif subtype == 1:
            rec["bp_high"] = b[6]
            rec["bp_low"] = b[7]
            if b[6] < 50 or not 30 <= b[7] <= 200:
                rec["invalid"] = True
        else:
            rec["spo2"] = b[7] if b[7] <= 100 else None
        records.append(rec)
    return {"subtype": subtype, "count": count, "records": records}


def extract_bpm(decoded):
    """Best-effort live BPM from a decoded (3,0) blob (latest valid record)."""
    if not decoded or decoded.get("subtype") != 0:
        return None
    vals = [r.get("hr_bpm") for r in decoded.get("records", [])]
    vals = [v for v in vals if isinstance(v, int)]
    return vals[-1] if vals else None


async def check_standard_hr(s: Session):
    """Step 2: look for standard HRP 0x180D/0x2A37 and try a notify subscribe."""
    try:
        svcs = await s.client.get_services()
        found = False
        for svc in svcs:
            if svc.uuid.lower() == HR_SVC:
                for ch in svc.characteristics:
                    if ch.uuid.lower() == HR_CH:
                        found = True
                        s.log("HRP", f"found standard HR 0x180D/0x2A37 props={ch.properties}")
                        try:
                            await s.client.start_notify(
                                HR_CH, lambda _s, d: s.log("HRP", f"notify {bytes(d).hex()}"))
                            s.log("HRP", "subscribed to 0x2A37 — live HR will print as HRP lines")
                            return True
                        except Exception as e:
                            s.log("HRP", f"subscribe failed: {e}")
        if not found:
            s.log("HRP", "no standard 0x180D/0x2A37 service — vendor CMD 0x03/0x06 path only")
        return found
    except Exception as e:
        s.log("HRP", f"service scan failed: {e}")
        return False


async def run(target="HR", poll=2.0, duration=180, do_trigger=True):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = HERE / f"hr_probe_{stamp}.log"
    csv_path = HERE / f"hr_probe_{stamp}.csv"
    s = Session(log_path, {})
    addr = await resolve_addr()
    s.log("SYS", f"connecting to {addr} (target={target} poll={poll}s dur={duration}s)")
    csv_f = csv_path.open("w", newline="", encoding="utf-8")
    csv_w = csv.writer(csv_f)
    csv_w.writerow(["wall_time", "label", "bpm", "spo2", "bp_high", "bp_low", "raw"])
    try:
        await s.connect()
        # Warm-up: features request required before watch answers on fresh link
        await s.probe(0, 0, b"\x00", wait=1, tag="warmup")
        await check_standard_hr(s)

        # Step 1: one-shot trigger vs stream test
        labels = [target] if target != "all" else ["HR", "BP", "SpO2"]
        if do_trigger:
            for lab in labels:
                key = TRIGGER_KEYS[lab]
                s.log("SYS", f"TRIGGER {lab}: (6,{key}) payload 01 — watch 3 s for stream")
                start = len(s.journal)
                await s.probe(6, key, b"\x01", wait=1, tag=f"trigger_{lab}")
                await asyncio.sleep(2.0)
                fresh = [j for j in s.journal[start:] if j["hdr"] == "DF" and j["cmd"] == 3]
                s.log("SYS", f"{lab}: {len(fresh)} DF(3,*) frames in trigger window "
                             f"({'STREAM?' if len(fresh) > 1 else 'single/quiet — use polling'})")
                for j in fresh:
                    dec = decode_health(j["raw"])
                    s.log("DATA", f"{lab} trigger: {dec} raw={j['raw']}")
                    await s.client.write_gatt_char(DATA_W, ack_frame(j["cmd"], j["ver"], j["key"]),
                                                   response=False)

        # Steps 3+4: poll loop with timestamps
        s.log("SYS", "entering poll loop — sit still, then walk, then jumping jacks")
        t0 = asyncio.get_running_loop().time()
        last_trigger = 0.0
        while asyncio.get_running_loop().time() - t0 < duration:
            now_wall = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            # Re-trigger HR measure at most every 30 s so poll reads stay fresh
            if do_trigger and target in ("HR", "all") and \
                    asyncio.get_running_loop().time() - last_trigger > 30:
                await s.probe(6, 4, b"\x01", wait=0.6, tag="retrigger_HR")
                last_trigger = asyncio.get_running_loop().time()
            for rk in READ_KEYS:
                replies, _ = await s.probe(3, rk, b"\x01", wait=0.6, tag=f"poll_3/{rk}")
                for fr in replies:
                    dec = decode_health(fr["raw"])
                    if dec is None:
                        continue
                    bpm = extract_bpm(dec)
                    spo2 = bp_h = bp_l = None
                    if dec.get("subtype") == 2:
                        recs = [r.get("spo2") for r in dec.get("records", []) if r.get("spo2")]
                        spo2 = recs[-1] if recs else None
                    if dec.get("subtype") == 1:
                        valid = [r for r in dec.get("records", []) if not r.get("invalid")]
                        if valid:
                            bp_h, bp_l = valid[-1].get("bp_high"), valid[-1].get("bp_low")
                    line = f"{now_wall} key={rk} {dec}"
                    s.log("HR" if bpm else "DATA", line)
                    print(f"[{now_wall}] BPM={bpm if bpm else '--'} "
                          f"SpO2={spo2 if spo2 else '--'} "
                          f"BP={bp_h}/{bp_l if bp_l else '--' if bp_h else '--'}", flush=True)
                    csv_w.writerow([now_wall, f"3/{rk}", bpm or "", spo2 or "",
                                     bp_h or "", bp_l or "", fr["raw"]])
                    csv_f.flush()
            await asyncio.sleep(max(0.5, poll))
        s.log("SYS", f"done — log={log_path} csv={csv_path}")
        print(f"[+] Done. CSV: {csv_path}", flush=True)
    finally:
        try:
            csv_f.close()
        except Exception:
            pass
        await s.disconnect()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=("all", "HR", "BP", "SpO2"), default="HR")
    ap.add_argument("--poll", type=float, default=2.0)
    ap.add_argument("--duration", type=int, default=180)
    ap.add_argument("--no-trigger", action="store_true")
    a = ap.parse_args()
    asyncio.run(run(a.target, a.poll, a.duration, not a.no_trigger))
