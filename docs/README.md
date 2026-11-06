# Documentation index

Everything here was verified against the physical D Watch7 unless a file says otherwise.
The hierarchy is deliberate: **live hardware beats decompiled source, and decompiled
source beats old notes.**

| File | Read it for |
|---|---|
| [`PROTOCOL.md`](PROTOCOL.md) | The master protocol: GATT map, DF/FD frame layout, command bytes, bind, notifications, dial codes. Start here. |
| [`WATCH_SPEC.md`](WATCH_SPEC.md) | Evidence-graded hardware spec (VERIFIED-LIVE / SOURCE-BACKED / SUPPORTED / UNKNOWN). |
| [`MERGED_PROTOCOL_AND_FINDINGS.md`](MERGED_PROTOCOL_AND_FINDINGS.md) | Single-page merge of the protocol and the research findings, including what was disproved. |
| [`OTA.md`](OTA.md) | The OTA / D5-D6 envelope, CRC-8, group and file checksums. Read-only research. |
| [`CONTEXT.md`](CONTEXT.md) | Historical snapshot of the original research workspace and tool list. |
| [`research/`](research/) | Raw hand-off notes, the user guide and the experiments that produced the protocol. |

## The short version

- Frame: `DF len_hi len_lo CHK cmdId devVer cmdKey dlen_hi dlen_lo payload…`
  with `len = payload + 5` and `CHK = sum of every other byte & 0xFF`.
- Write to `00002AAD`, notify on `00002AAC`. **ACK every inbound DF frame** or the
  watch stops talking.
- Haptics `CMD 0x06 / 0x00` on, `/ 0x0F` off. Time sync `CMD 0x02 / 0x08`.
- Optical sensors are one-shot reads, not streams.
- The accelerometer never streams on firmware 6.1.2 — wrist input comes from the media
  buttons over AVRCP/SMTC instead (Previous / Play / Next).

For the narrative version — how the watch was taken apart and why 20 games exist — read
[`../DECODED.md`](../DECODED.md). To run the studio, see [`../README.md`](../README.md).
