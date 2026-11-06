# D Watch7 — Complete User Guide

> Built from the live Bluetooth tests already in this folder (`WATCH_SPEC.md`, `PROTOCOL.md`, `tier_*.txt`, health logs) plus the M2Wear 6.1.38 app source. Items marked **Tested** were seen working on your unit. **Likely** = the watch accepts the command but nobody confirmed it on the screen. **Not on this unit** = tested and missing.

---

## 1. What watch is this?

| Item | Value |
|---|---|
| Name shown in Bluetooth | **D Watch7** |
| Bluetooth address (your unit) | `C2:FC:01:BC:D4:1F` |
| Chip maker | Freqchip (low-power Bluetooth chip used in budget smartwatches) |
| Board / model string | `Fr-BLE-1.0` |
| Hardware version | 1.0.0 |
| Firmware version | **6.1.2** |
| Companion app | **M2Wear** (Android package `com.lianhezhuli.mtwear`; also on iPhone App Store) |
| Connection | Bluetooth Low Energy (BLE) only — no Wi-Fi, no SIM |
| Last battery reading | 92% (5 Oct 2026) |

It's a budget Chinese smartwatch ("Apple Watch style" clone). Its maker doesn't publish a datasheet. Online searches turn up no official spec sheet for "D Watch7". Similar M2Wear watches list a ~1.75" screen and 5–7 days of battery, but **check your box or seller page** for screen size, battery size and water rating.

---

## 2. Hardware & capabilities

### Sensors and health

| Feature | Status | Notes |
|---|---|---|
| Step counter / motion sensor (accelerometer) | **Tested** | Daily steps synced to the app |
| Heart rate | **Tested** | Readings of 72 and 88 bpm captured |
| Blood pressure | **Tested** (estimate) | 112/72, 121/71 captured — **not medical-grade** |
| Blood oxygen (SpO2) | **Tested** (estimate) | 95–97% captured — **not medical-grade** |
| Sleep tracking | Likely | Sleep window setting exists |
| Sports modes | **Tested** | Start/query of workouts accepted |
| Vibration motor | Likely | "Find watch" makes it buzz |
| GPS | **Not on this unit** | Uses your phone's GPS instead |
| Temperature / barometer | **Not on this unit** | |
| ECG, compass, altimeter | Unknown — assume no | |

### Smart features

| Feature | Status | Notes |
|---|---|---|
| Phone notifications (WhatsApp, SMS, calls, etc.) | **Tested** | Up to ~9 app types toggled in the app |
| Contacts sync to watch | **Tested** | |
| Watch faces — built-in | **Tested** | 24+ faces work |
| Custom watch face (clock position + colour) | **Tested** | |
| Upload your own photo as wallpaper | **Not on this unit** | Firmware refuses it |
| Find my watch | **Tested** | |
| Sedentary (move) reminder | **Tested** | Supported flag set |
| 24-hour clock | **Tested** | |
| Brightness, language | **Tested** | |
| Navigation prompts (via phone) | Likely | |
| Menstrual cycle tracking | Likely | |
| Reminders | Likely | |
| AI voice assistant (ChatGPT) | Likely | Accepted but never heard working |
| NFC | Likely | No card read confirmed |
| Weather | Unreliable | This firmware rejects weather pushes |
| Raise-to-wake | Probably not | Flag reported as off |
| Payments (Alipay/bus card) | **Not on this unit** | |
| Firmware updates through app | Probably not | Watch reports OTA as off |

---

## 3. Before you connect

1. **Charge the watch** to at least 50% (magnetic/clip charger, about 1–2 hours to full).
2. **Install M2Wear** from Google Play or the App Store. Use the official store, not an APK site.
3. **Turn on Bluetooth and Location** on your phone (Android needs Location to find Bluetooth watches).
4. **Close anything else connected to the watch.** The watch talks to **one device at a time.** If a PC script from this folder (`watch_gui.py`, `watch_probe.py`, the web controller) is connected, the phone won't find it. Close those first.
5. If the watch was paired before, **remove it** from the phone's Bluetooth list ("Forget") and from the old app.

---

## 4. Step-by-step: connect by Bluetooth

> ⚠️ **Don't pair from the phone's Bluetooth settings menu.** Pair **inside the M2Wear app**. Pairing from system settings often leaves it "connected" but with no data.

1. Turn the watch on (hold the side button ~3 seconds).
2. Open **M2Wear** → create an account or skip/guest if offered → fill in your profile (height, weight, age, gender). This makes calorie and step distance numbers accurate.
3. Grant every permission it asks for:
   - **Nearby devices / Bluetooth** (Android 12+)
   - **Location** → "Allow all the time" or "While using"
   - **Notifications**
   - **Phone, Contacts, Call logs, SMS** (for call/SMS alerts and contact sync)
4. Go to **Device** (or "Me") → **Add device / Bind device**.
5. The app scans. Pick **D Watch7** (if several show, pick the one with the strongest signal, or match address ending `D4:1F`).
6. **Confirm on the watch** — tap the ✓ when it asks to pair or bind.
7. Android may show a system "Pair with D Watch7?" popup → **Pair**. iPhone: also tap **Allow** for "Share System Notifications".
8. Wait 10–30 seconds. The app syncs the time, battery and data. The watch's time should now match your phone.

**Connected!** You'll see battery % and today's steps in the app.

### If it won't connect
| Problem | Fix |
|---|---|
| Watch not in the list | Turn Location on, close PC tools, restart watch, keep it within 1 m |
| Connects then drops | Turn off battery saver for M2Wear (see section 6) |
| "Bind failed" | Forget the watch in phone Bluetooth settings, restart phone, retry inside app |
| Still stuck | Watch → Settings → **Reset/Restore factory** (erases watch data), then retry |

---

## 5. How to use each feature

### Watch faces
- **On the watch:** long-press the home screen → swipe → tap one.
- **In the app:** Device → **Watch face / Dial market** → pick a face → Install.
- **Custom face:** Device → Custom dial → choose clock position and colour. (Your own photo upload won't work on this firmware.)
- Tip: changing faces too fast (about 8 in a row) makes the watch refuse for 5–10 minutes. That's normal.

### Notifications
1. App → Device → **Message notifications** → turn on the apps you want (Calls, SMS, WhatsApp, Facebook, etc.).
2. Android: when prompted, enable **Notification access** for M2Wear.
3. iPhone: Settings → Bluetooth → ⓘ next to D Watch7 → enable **Share System Notifications**.
4. Test: send yourself a WhatsApp message — the watch should buzz.

### Health
- **Heart rate / blood pressure / SpO2:** open the matching tile on the watch and keep still for 30–60 s, or start it from the app's Health tab.
- **All-day heart rate:** Device → **Heart rate auto test** → On (uses more battery).
- **Sleep:** wear it to bed; the app shows sleep after the morning sync.
- **Steps & calories:** automatic. Set a daily goal in the app.
- Treat health readings as rough trends, not medical results.

### Workouts
- On the watch: open **Sports** → pick an activity (walk, run, cycle…) → start. Stop when done; it syncs to the app.
- Distance outdoors comes from step count (the watch has no GPS of its own).

### Reminders and tools
- **Sedentary reminder:** Device → Sedentary → set hours (e.g. 9:00–18:00, every 60 min).
- **Find watch:** App → Device → **Find device** → watch buzzes.
- **Contacts:** Device → **Frequent contacts** → add numbers.
- **Alarms / reminders:** Device → Alarm or Reminder, if your app version shows them.
- **Menstrual tracking:** Health → Female health.
- **Camera remote / music control:** Device → if shown, open it and press the button on the watch. (Not verified on this unit.)

### Settings
- **Time format:** Device → 24-hour toggle.
- **Brightness / screen-on time:** on the watch → Settings → Display.
- **Language:** follows the phone language after sync, or watch Settings → Language.
- **Units (km/miles):** App → Me → Units.

---

## 6. Keep it connected (important on Android)

Android phones often kill the app in the background, so notifications stop. Fix it once:

1. Settings → Apps → **M2Wear** → Battery → **Unrestricted** (or "Don't optimize").
2. Allow **Autostart / Run in background** (Xiaomi, Oppo, Vivo, Realme, Huawei, Infinix).
3. Lock M2Wear in Recent apps (pull down on its card or tap the lock icon).
4. Don't swipe M2Wear away from recent apps.

---

## 7. Battery tips

- Expect a few days to about a week per charge, depending on use.
- Biggest drains: all-day heart rate, high brightness, long screen-on time, lots of notifications.
- Power-saving mode exists in firmware — look for it in watch Settings.
- Charge before it hits 10%; don't leave it in a hot car.

---

## 8. Care & safety

- Water rating unknown for this unit: hand washing and rain are usually fine for this class of watch; **don't shower, swim or use a sauna with it** unless the box says IP68 / 5ATM.
- Wipe the sensor on the back weekly for accurate heart readings.
- Wear it one finger-width above the wrist bone, snug but comfortable.

---

## 9. Recommendations to get the most out of it

1. Turn on **notifications for just the 3–5 apps you care about** — less buzzing, better battery.
2. Turn on **sedentary reminder** and set a realistic **step goal** (start at 6,000).
3. Use **auto heart rate** only if you want trends; otherwise measure manually.
4. Sync the app **once a day** so health history isn't lost (the watch stores limited days).
5. Don't rely on it for **weather, GPS, payments or photo wallpapers** — this unit doesn't support them.
6. If you use the PC tools in this folder, **disconnect them before using the phone app** — only one can be connected.
