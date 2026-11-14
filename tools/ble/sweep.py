"""
Shared BLE utilities for D Watch 7 tools.
Extracted from dashboard_server.py for tool reusability.
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    from bleak import BleakClient, BleakScanner
    BLE_AVAILABLE = True
except Exception:
    BleakClient = BleakScanner = None
    BLE_AVAILABLE = False

WATCH_MAC = "C2:FC:01:BC:D4:1F"
DATA_W = "00002aad-0000-1000-8000-00805f9b34fb"
DATA_N = "00002aac-0000-1000-8000-00805f9b34fb"
DEV_VER = 0x04
HERE = Path(__file__).parent
KNOWN_ADDR = WATCH_MAC


def build_df_frame(cmd: int, key: int, payload: bytes = b"", ver: int = DEV_VER) -> bytes:
    """Build a DF frame with checksum."""
    p_len = len(payload)
    flen = 5 + p_len
    raw = bytearray([0xDF, (flen >> 8) & 0xFF, flen & 0xFF, cmd, ver, key, (p_len >> 8) & 0xFF, p_len & 0xFF])
    raw.extend(payload)
    checksum = sum(raw) & 0xFF
    return bytes([raw[0], raw[1], raw[2], checksum]) + bytes(raw[3:])


def build_ack_frame(cmd: int, ver: int, key: int, status: int = 0) -> bytes:
    """Build an FD ACK frame."""
    raw = bytearray([0xFD, 0x00, 0x06, 0x00, cmd, ver, key, 0x00, 0x01, status])
    raw[3] = sum(b for i, b in enumerate(raw) if i != 3) & 0xFF
    return bytes(raw)


def parse_frame(raw: bytes):
    """Parse a DF or FD frame. Returns (type, cmd, ver, key, payload) or None."""
    if len(raw) < 7:
        return None
    if raw[0] == 0xDF:
        if len(raw) < 9:
            return None
        flen = (raw[1] << 8) | raw[2]
        if len(raw) != flen + 4:
            return None
        checksum = sum(raw[3:]) & 0xFF
        if raw[3] != checksum:
            return ("DF", "bad_checksum", None, None, None)
        cmd, ver, key = raw[4], raw[5], raw[6]
        dlen = (raw[7] << 8) | raw[8]
        payload = raw[9:9 + dlen]
        return ("DF", cmd, ver, key, payload)
    elif raw[0] == 0xFD:
        if len(raw) < 10:
            return None
        cmd, ver, key = raw[4], raw[5], raw[6]
        status = raw[9]
        return ("FD", cmd, ver, key, bytes([status]))
    return None


async def resolve_addr() -> str:
    """Resolve the watch MAC address, trying direct connect if not advertising."""
    if not BLE_AVAILABLE:
        raise RuntimeError("Bleak not installed")
    
    # First try finding via scanner
    device = await BleakScanner.find_device_by_address(WATCH_MAC, timeout=5.0)
    if device:
        return device.address
    
    # Fall back to direct connect on known MAC
    return WATCH_MAC


class Session:
    """BLE session with logging and journal."""
    
    def __init__(self, log_path: Path, meta: dict):
        self.log_path = log_path
        self.meta = meta
        self.client: Optional[BleakClient] = None
        self.journal = []
        self._log_f = log_path.open("a", encoding="utf-8")
        
    def log(self, prefix: str, msg: str):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] [{prefix}] {msg}"
        print(line)
        self._log_f.write(line + "\n")
        self._log_f.flush()
        
    async def connect(self):
        addr = await resolve_addr()
        self.client = BleakClient(addr, timeout=20.0)
        await self.client.__aenter__()
        await self.client.start_notify(DATA_N, self._on_notify)
        self.log("SYS", f"Connected to {addr}")
        
    def _on_notify(self, _sender, data: bytearray):
        self.journal.append({
            "t": len(self.journal),
            "ts": datetime.now().isoformat(timespec="milliseconds"),
            "raw": bytes(data).hex().upper(),
            "hdr": "DF" if data and data[0] == 0xDF else "FD" if data and data[0] == 0xFD else "?",
        })
        parsed = parse_frame(bytes(data))
        if parsed:
            self.journal[-1]["cmd"] = parsed[1]
            self.journal[-1]["ver"] = parsed[2]
            self.journal[-1]["key"] = parsed[3]
        
    async def probe(self, cmd: int, key: int, payload: bytes, wait: float = 1.0, tag: str = ""):
        """Send a DF frame and collect replies."""
        if not self.client or not self.client.is_connected:
            raise RuntimeError("Not connected")
            
        frame = build_df_frame(cmd, key, payload)
        start_idx = len(self.journal)
        self.log(tag or "TX", f"cmd={cmd:02x} key={key:02x} payload={payload.hex()}")
        await self.client.write_gatt_char(DATA_W, frame, response=False)
        await asyncio.sleep(wait)
        
        replies = []
        for j in self.journal[start_idx:]:
            if j.get("cmd") is not None:
                replies.append(j)
        return replies, self.journal[start_idx:]
        
    async def disconnect(self):
        if self.client:
            try:
                await self.client.stop_notify(DATA_N)
            except Exception:
                pass
            await self.client.__aexit__(None, None, None)
        self._log_f.close()


async def scan_devices(timeout: int = 10):
    """Scan for BLE devices."""
    if not BLE_AVAILABLE:
        raise RuntimeError("Bleak not installed")
    return await BleakScanner.discover(timeout=timeout)