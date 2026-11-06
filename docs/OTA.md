# OTA Protocol Deep-Dive (M2Wear `com.lianhezhuli.mtwear`)

> Goal: understand firmware/watchface update so we never brick the unit.
> No stock update URL was used and no flashing was attempted.

## Which path our watch takes
- Device info: manufacturer `Freqchip`, model `Fr-BLE-1.0`, fw `6.1.2`
- Standard path UUIDs (from `BleConstants` + live probe):
  - OTA service `000018a8-0000-1000-8000-00805f9b34fb`
  - OTA notify char `00002aa8` (labeled CGM Feature)
  - OTA write char `00002aa9` (labeled Indoor Positioning Configuration)
- The `00001106/1107/1108` variant (`OTA_*_5610`) targets newer 5.6.10-ish chips
  (Cus5610CommandUtils); this DWatch uses the classic 18a8/2aa8/2aa9 path.
- Scan bytes `:56:78` = normal adv, `:56:10` = DFU-mode adv.

## Phone<->Watch OTA envelope (data frames, raw BLE)
```
D5(-43)  cmdId  key  sub  0  0  payLen_hi payLen_lo  payload...  sum8
```
- Incoming frames on 2aa8 are reassembled exactly like DF frames:
  total bytes = ((b[6]&0xFF)<<8 | b[7]&0xFF) + 9  (byte b[0]=D5 starts a frame)
- Errors arrive as a single byte `0xD6` (-42) → onOTAError
- `cmdId`/`key` echo the phone's request: OTA session uses `CMD_OTA=1`,
  `CMD_PAPER=2`, `CMD_LOG=3`, `CMD_CONTACT=4`, `CMD_WATCH_FACE=5`

### Handshake / flow (from OTAUtils + OTANotifyWriteUtils)
1. Phone enables notify on **18a8/2aa8**, requests MTU 247, then sends
   `startOTA(mainId, secondId, 1, peripheralMtu-3, fileLength)`:
   `D5 mainId secondId 1 0 0 00 06 <devMtu-3 hi lo (u16)> <fileLength u32 BE> sum8`
   (the 6 payload bytes are: 2 bytes "payload MTU hint" + 4 bytes file length)
2. Watch replies `D5 mainId secondId 0x81 0 0 len <devMtu hi lo u16 + sendInterval hi lo u16 + groupPacNum u8 + timeoutSec u8> sum8`
   with real observed values for D Watch7: **devMtu=129** (128-byte OTA packets regardless of BLE MTU!), **interval=20ms** (min delay between packets), **groupPacNum=32**, **timeout=100s**
3. Every group ACK from the phone is `D5 mainId secondId 2 0 0 00 01 <groupCRC8 u8> sum8`
4. Final checksum `D5 mainId secondId 3 0 0 00 01 <fileCRC8 u8> sum8`
3. Phone splits the file into packets of `getDeviceMtu()-1` bytes
   (default MTU 247 → ~246B packets), groups them `groupPacNum` per ACK round.
   Each packet is wrapped as a DATA frame: `D6(-42) ^ raw  (byte[0]=-42)`.
4. After each group the phone appends `getCRCBytes(mainId, secondId, 2, groupXor)`:
   `D5 mainId secondId 2 0 0 00 01 <xor> sum8`.
   The `xor` is the CRC-8 (poly 0x31, init 0) computed over all bytes of the
   current group (same CRC used per group across packets, byte-wise XORed then
   CRC'd — see sendData()).
5. After the last group: `getCRCBytes(mainId, secondId, 3, fileCRC)` where
   fileCRC is the running CRC-8 over the whole file (CRC-8 poly 0x31 init 0).
   The watch verifies and replies `[3]==0x83` (finish) or an error.
4. On success, unless mainId in {2,4,5} (paper/contact/watchface), the phone
   sends `rebootDevice(mainId, secondId)` → watch reboots into new firmware.

### CRC semantics (verified by `ota_send.py`)
- `fileCRC8` = CRC-8 (poly 0x31) over the ENTIRE file, sent once at sub=3.
- Group ack byte at sub=2 = CRC-8 over the bytes of the ACKED GROUP (not a plain XOR).
  App code (OTAUtils.sendData): for each byte both counters do `c = crc8_update(c, b)`,
  `i2` is reset per group, `fileCRC` runs continuously.
- Status 0xD6 byte (-42) from watch = immediate error.
  D5 replies with `[3] in {0x81,0x82,0x83}`: b[5]==0 means: 0x81 params accepted,
  0x82 next group ok → phone sends next group; 0x83 file accepted → finish.
  Any other b[5] = error code → onOTAError.

### CRC-8 (from OTAUtils.sendData)
```python
def crc8_update(crc, data):
    crc ^= data
    for _ in range(8):
        crc = ((crc << 1) ^ 0x31) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc
```
- Group CRC: per-packet XOR byte first (`i2 ^= b`), then 8-step LFSR per packet byte;
  the final `i2` is the group checksum byte sent as sub=2.
- File CRC: same CRC-8 over all bytes of the file, sent once at sub=3.

## Other protocol variants in the app
- `Cus5610CommandUtils` / `Cus5610OTAUtils` — same D5/D6 headers and group CRC;
  used when `Is565Bmp`/5610Type (5.6.10-class devices).
- `MultipleOTAUtils` — multi-bank; sends one bank (e.g. 4 images) at a time, same
  group ACK mechanics.
- The **5610** split is selected by `BleConstants.OTA_SERVICE_UUID_5610` when the
  features blob advertises `codeFormat==8` and Is565Bmp flags.

## Practical takeaways if we ever "own" the OTA channel
- We can push **watchface content raw** (CMD_PAPER=2 / PAPER_STANDBY=1, mainId=2,
  secondId=1..10) using exactly the same D5/CRC engine — much safer than firmware.
- Danger checklist before any real firmware flash:
  1. Only flash image another unit dumped from the same model/firmware.
  2. Verify `startOTA` advertised devMtu/group/timeout before sending a single
     packet — never force MTU.
  3. The watch reboots on `rebootDevice` (mainId∉{2,4,5}); a corrupted image
     with no recovery loader bricks it. Our FR801x has SWD test pins but not
     confirmed accessible → treat flashing as one-way.
