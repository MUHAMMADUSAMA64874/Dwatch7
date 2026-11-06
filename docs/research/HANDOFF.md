# D Watch7 / M2Wear Protocol Reverse-Engineering — Handoff Log

State as of the 2026-10-05 corrected-attribution session. Read this first to resume.

## Commands to continue

All commands run from `d:\Resources\dwatch fleage`
(Python: `C:\Users\CodenCoder\AppData\Local\Programs\Python\Python311\python.exe`,
`bleak` installed this session).

```powershell
# 1. Watch must be on and in range (BLE name: D Watch7, C2:FC:01:BC:D4:1F)

# 2. Reprobe of the CORRECTED 65-pair silent list. Started fresh because the
#    list changed (237 -> 65); old checkpoint saved as
#    discovery/reprobe_state.json.bak (sweep_state.json.bak likewise).
python reprobe.py 2>&1 | Out-File -FilePath reprobe_out.txt -Encoding utf8
#  progress: Get-Content reprobe_out.txt | Select-Object -Last 20
#  live log: Get-Content discovery\reprobe.log -Tail 10
#  stop:     Get-Process python | Stop-Process -Force   (checkpoint saved every 10 pairs)

# 3. Post-sweep tables (run; re-run only after new logs appear)
python analyze_sweep.py > analysis_out.txt 2>&1     # pair table
python no_reply.py > noreply_out.txt 2>&1           # rebuilds discovery/attribution.json

# 4. Offline self-test of the attribution/reject fixes (no hardware needed)
python selftest.py                                  # 14 checks, all passing

# 5. Ladder tiers — still NOT run, these capture real data payloads
python sweep.py --tier settings_read
python sweep.py --tier health
python sweep.py --tier misc
python sweep.py --tier identity
python sweep.py --tier bind
```

## Progress so far

| Stage | Result |
|---|---|
| `cmd_oracle.py` → `cmd_oracle.json` | 117 unique (cmd,key) pairs, key format `cmd_key_index` dict |
| Checksum rule | byte at index 3 = sum of all other bytes; verified vs 6 captured frames |
| `sweep.py` full blind sweep | 6,286/6,286 probes, 2,073 hit-slots, clean exit |
| `no_reply.py` (**corrected**) | replay of all logs: **6,293 pairs — 6,228 answered, 65 silent** → `discovery/attribution.json`. The old slot-attributed "237" was wrong |
| `reprobe.py` (previous, slot-based) | 56/237 marked, 36 revived, 20 "silent" — **superseded** |
| `reprobe.py` (**corrected**, 65-pair list) | **COMPLETE 65/65** · answered 2 · rejected 1 · **IGNORED 62** (denylist) |
| `reprobe.py --pairs 5/0,2/18,11/1` (**follow-up**, 2026-10-05) | **COMPLETE 3/3** · `(5,0)` IGNORED → denylist **63** · `(2,18)`+`(11,1)` answered → excluded |
| `sweep.py --tier identity/bind/settings_read/health/misc` | **ALL 5 OK** (identity took 2 attempts; rest 1st attempt). Real payloads: `(2,6)` 47B settings blob, unsolicited `(3,1)`/`(3,2)` 12B pushes, `(11,5)` custom-face reply `800300140014ffff040102` → `tier_*.txt`, `tiers_DONE.txt` |

### Key findings

- **Ack is useless as a filter** (96% ack). Only silence is informative.
- **All DF replies during the blind sweep were the cmd-0 features broadcast**
  (`01ff01020000d700e2`) — zero new data payloads found (the 5 ladder tiers
  are still the way to get real payloads).
- **Corrected silent list = 65 pairs**: cmd 5 keys 1–63, plus `(1,0)` and
  `(20,0)`. The old 237 came from slot-based attribution that dropped late
  replies; `(0,6)` and `(4,35)` were the proof — both show replies in the log
  yet were recorded silent.
- **cmd 5 is genuinely silent**: 18/18 probed keys drew no reply while the
  (3,0) controls passed immediately before each batch, and no log ever holds a
  cmd-5 reply. First confirmed command-level silence.
- **`(1,0)` and `(20,0)` are NOT silent** — both **revived** in the final
  reprobe (the watch answers them; their single earlier empty-payload send had
  just gone unanswered once).
- **`(5,33)` drew the generic reject** — link-level signal, deliberately NOT
  charged to the pair, so it is excluded from the denylist.
- **The denylist is final: 62 pairs = cmd 5 keys 1–32 and 34–63.** cmd 5 is
  also *link-perturbing*: every cmd-5 batch is followed by ~30–60 s of
  watch silence (control passes → batch → control dead → reconnect).
- **The generic reject never echoes the probe** (always cmdId 0x04/key 0), so
  it can't be charged to a pair — "rejected" and "ignored" are separate
  outcomes and only "ignored" supports a denylist entry.
- Acks arrive **late** (up to ~3 probe slots). ALWAYS attribute by the
  frame's own embedded cmd/key, never by probe slot — `Session.probe()` /
  `matching()` in sweep.py / reprobe.py are the reference implementations.
- Watch occasionally drops off-air (~1 min) and comes back; connect retries
  handle it. **The watch does not answer probes on a fresh link** — a
  warm-up features request (`cmd 0 key 0`) is required first.

## Bugs found & fixed in this session

1. **Control mis-attribution**: stale `cmd=4 reject` frames from earlier
   probes landed in the control window → false "link dead" → 15 s
   reconnect thrash. Fixed with `matching()` (frame-identity check).
2. **No session warm-up after reconnect** → control failed immediately
   after every reconnect. Fixed with warm-up probe in `connect_with_retry()`.
3. **Control too fragile** (1 miss = reconnect). Fixed with in-place retry
   (`control_ok()`), plus longer backoff after 3 consecutive failures.
4. **No checkpoint resume** (this is what forcing the stop exposed): results
   were reset on every start and `probed` was never tracked, so restarting
   would have re-probed pairs 1–40 and conflated unprobed pairs with silent
   ones. Fixed: `load()`/`probed` flags added; old state reconstructed by
   `mark_probed.py` (parses reprobe0/1/2 TX tags from `discovery/reprobe.log`).
5. **Slot-based reply attribution (the big one)**: `probe()` read a frame
   buffer that was cleared on every write, so a reply landing in a later
   probe's slot was discarded — `(0,6)` and `(4,35)` answered on the wire yet
   were recorded silent, and the silent list was inflated 237. Fixed:
   append-only `Session.journal` with monotonic timestamps; every RX is
   attributed by the (cmd,key) it carries, bounded by `LATE_MAX`.
6. **Reject counted as silence**: the generic reject always reports
   cmdId 0x04/key 0, so `matching()` discarded it and both "rejected" and
   "ignored" were logged as "silent". Fixed: `is_reject()` + three-outcome
   model (answered / rejected / ignored); `control_ok()` accepts a reject as
   proof of link liveness.
7. **Two latent `probe()` crashes/holes found by `selftest.py`** (new offline
   test, 14 checks, no hardware): journal wrote undefined `b` instead of
   `buf` (NameError on every RX), and the wait loop compared `time.time()`
   against a monotonic deadline so it never ran — the collection window
   collapsed to `LATE_GRACE` and replies at 0.35–0.8 s were dropped. Both
   fixed; `LATE_MAX` now actually enforced.

## What's left, in order

1. **Let the current reprobe finish** (65 pairs × 3 attempts) → final
   answered/rejected/IGNORED split; the IGNORED list is the denylist.
   Watch for: does cmd 5 stay silent on all 63 keys, and does `(20,0)`
   revive like `(1,0)` did?
2. **Run the 5 ladder tiers** to collect real data payloads — the blind
   sweep produced none.
3. **`PROTOCOL.md` updated this session** — cmds 17/18/19/24/25/30/47/56
   (+method tables), cmd 2 keys → 66, reject-frame format incl. checksum
   analysis, ACK TX/RX variants, checksum rule, silence map (new §12).
   Still TODO: drop the final denylist list in after the reprobe finishes.

## Safety rules (still in force)

- Never send: `(2,0x2A)`, `(2,0x2B)`, `(2,0x09)–(2,0x0E)`
- Dial changes: cooldown ~8 per run
- Always ACK inbound DF frames

## Files

| File | Purpose |
|---|---|
| `reprobe.py` | silent-pair verifier — **the active script** (3-outcome model) |
| `sweep.py` | main sweeper, tiers, Session/probe framework (journal attribution) |
| `selftest.py` | **offline** 14-check test of attribution/reject logic — run after touching sweep.py |
| `no_reply.py` | log replayer → `discovery/attribution.json` (source of the 65-pair list) |
| `migrate_state.py` | one-off: adds outcome/rejects fields to the old checkpoint schema |
| `mark_probed.py` | one-off: reconstructs `probed` flags from log (done, superseded) |
| `analyze_sweep.py` / `noreply` tables | post-sweep tables |
| `cmd_oracle.py` → `cmd_oracle.json` | pair oracle |
| `discovery/attribution.json` | **corrected silent list — 65 pairs** |
| `discovery/reprobe_state.json` | **checkpoint — current 65-pair run** (`.bak` = old 237-pair version) |
| `discovery/sweep_state.json` | full sweep state (`.bak` backup) |
| `discovery/reprobe.log`, `reprobe_out.txt` | reprobe live log / stdout |
