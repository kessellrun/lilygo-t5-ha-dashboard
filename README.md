# LilyGo T5 4.7" E-Paper Touch `[H716]` — Home Assistant Smart Dashboard (1S LiPo Edition)

A complete, modular **ESPHome + Home Assistant** multi-tab capacitive touch dashboard engineered specifically for the **LilyGo T5 4.7-Inch E-Paper Touch Non-Soldered Female Pin `[H716]`** (`ESP32-S3-WROOM-1-N16R8`, `16MB` Flash, `8MB` Octal PSRAM, `ED047TC1` `960×540` 16-grayscale E-Ink display, `GT911` capacitive touch, `PCF8563` RTC) running on a **1S 3.7V LiPo battery**.

Includes a **zero-dependency interactive HTML5 960×540 Hardware & Touch Simulator** (`simulator/index.html`) so you can test all 4 tabs, click GT911 touch hitboxes, drag the live 1S LiPo voltage slider (`3.20V–4.25V`), and inspect Home Assistant API calls in your browser before flashing your board.

---

## Start Here: Documentation & Beginner Guides

New to programming ESP32 boards or setting up Home Assistant packages? Start with our step-by-step beginner guide:

1. **[Complete Beginner's Step-by-Step Installation & Setup Guide (`docs/STEP_BY_STEP_SETUP_GUIDE.md`)](docs/STEP_BY_STEP_SETUP_GUIDE.md)**
   - **Missing Items Checklist:** Choosing the right 1S `3.7V` LiPo pouch battery (`JST 2.0mm PH`), performing the **10-second Red/Black wire polarity check**, and downloading the 3 required `.ttf` font files.
   - **Home Assistant Setup:** Installing the File Editor add-on, loading `homeassistant/packages/lilygo_t5_dashboard.yaml`, and configuring the 5-day compact weather serializer.
   - **First-Time USB-C Flashing:** Installing the ESPHome add-on, putting the ESP32-S3 into Bootloader mode (`BOOT` + `RST`), and flashing via Chrome/Edge (`web.esphome.io`).
   - **Enabling Touch Control Permissions:** Checking *"Allow the device to perform Home Assistant actions"* in Home Assistant so tapping the screen toggles your lights, locks, and thermostat.
2. **[Hardware Pinout, 40-Pin Female Header & LiPo Battery Guide (`docs/LIPO_HARDWARE_GUIDE.md`)](docs/LIPO_HARDWARE_GUIDE.md)**
   - Complete internal ESP32-S3 GPIO map for the `[H716]` board, safe pins on the 40-pin non-soldered female socket, optional `BME280`/`SHT4x` wiring, and 1S LiPo runtime math.
3. **[Open-Source References & Architectural Lineage (`docs/OPEN_SOURCE_REFERENCES.md`)](docs/OPEN_SOURCE_REFERENCES.md)**
   - How this firmware unifies `hbast/lilygo_t5_47_plus`, `nickolay/esphome-lilygo-t547plus`, `Xinyuan-LilyGO/LilyGo-EPD47`, `tolnai/esphome-dashboard-lilygo-t5`, `kotope/esphome_eink_dashboard`, and `rktdno/esphome-lilygo-t5-epaper-s3-pro`.

---

## Key Features

### 1. 4-Tab Interactive Capacitive Touch UI (`960×540` 16-Grayscale)
- **Persistent Top Status Bar (`y: 0..56`):** Live time (`12h AM/PM` or `24h`) and date (backed by the onboard `PCF8563` RTC), Wi-Fi RSSI bars, active Power Profile pill, 1S LiPo battery gauge (`SoC % + Voltage + Charging icon`), plus quick-tap **`[REFRESH]`** (anti-ghosting clean cycle) and **`[SLEEP / MODE]`** buttons.
- **Tab 0 — `CONTROLS` (Smart Home Touch Grid):** 2×3 grid of large capacitive touch cards (`Living Room Light`, `Kitchen Pendant`, `Office Switch`, `Front Door Lock`, `Garage Door Cover`, `Goodnight Scene`) that directly call Home Assistant services and trigger fast e-paper updates.
- **Tab 1 — `WEATHER` (Current Conditions & 5-Day Forecast):** Hero current weather card (`Temp`, `Feels Like`, `Humidity`, `Wind`, `UV Index`, `Pressure`) paired with a 5-day daily forecast (`Day | Icon | High/Low | Range Bar`) powered by Home Assistant's `weather.get_forecasts` action.
- **Tab 2 — `CLIMATE` (Multi-Room Matrix & Interactive HVAC Controller):** 2×2 room temperature/humidity matrix with comfort badges alongside an interactive Thermostat panel featuring **`[-]`** and **`[+]`** touch target-temperature buttons and indoor `CO2 (ppm)` / `AQI` gauges.
- **Tab 3 — `LIPO & POWER` (1S LiPo Telemetry & Diagnostics):** Visual 11-point LiPo discharge curve (`3.30V–4.20V`), estimated battery runtime across all 3 power profiles, wakeup cause (`GPIO16 Touch Interrupt`, `15m Timer`, `Cold Boot`), refresh counter, and interactive power-profile selector cards.

### 2. Purpose-Built 1S LiPo Power Management (`esphome/packages/lipo_power_manager.yaml`)
- **Calibrated `GPIO14` Voltage & 11-Point SoC Curve:** Reads the onboard `2:1` voltage divider on `GPIO14` (`12dB` attenuation, sliding-window filter) and maps cell voltage through an 11-point piecewise linear lookup (`4.20V=100%` to `3.30V=0%`).
- **3 Selectable Power Profiles:**
  1. **`Adaptive Hybrid (Recommended)`:** Instant touch response during active hours (`SoC > 35%`), automatically dropping into **Touch-Armed Deep Sleep** (`GPIO16` `EXT0` wake + `15-minute` timer wake) after inactivity, during Quiet Hours (`23:00–06:00`), or when battery drops below `35%`.
  2. **`Always Online (Modem Sleep)`:** Keeps Wi-Fi connected in `LIGHT` power-save mode (`epd_poweroff()` between renders) for sub-second push updates when plugged into USB-C or on a large desk battery.
  3. **`Max Battery (Deep Sleep + Touch Wake)`:** Sleeps at `~180 µA` between 15-minute updates while keeping the `GT911` interrupt (`GPIO16`) armed so a single finger tap wakes the screen in `< 1.5 seconds`.
- **Critical Low-Battery Hibernate Protection (`< 3.32V`):** Renders a persistent low-battery lock screen (`CHARGE VIA USB-C`), calls `epd_poweroff()` to protect the ED047TC1 panel, and enters indefinite deep sleep before the LiPo protection circuit trips.

---

## Interactive Browser Simulator (`simulator/index.html`)

Want to explore the dashboard and test touch coordinates right now without hardware?
1. Open **`simulator/index.html`** directly in any web browser (Chrome, Edge, Firefox, or Safari—no local server or build step needed).
2. Click the bottom tabs (`CONTROLS`, `WEATHER`, `CLIMATE`, `LIPO & POWER`), tap the 6 smart home cards, adjust the HVAC setpoint with `[-]` / `[+]`, and watch the live **ESPHome <-> Home Assistant API Event Console**.
3. Use the **Hardware Control Panel** on the side to:
   - Drag the **1S LiPo Voltage Slider (`3.20V` to `4.25V`)** and test the `< 3.32V` Critical Hibernate lock screen.
   - Toggle **USB-C Charging**, **Imperial (`°F`/`mph`/`12h`) vs. Metric (`°C`/`km/h`/`24h`)**, and the **GT911 Touch Hitbox & Coordinate Overlay**.
   - Simulate **Touch-Armed Deep Sleep & `GPIO16` EXT0 Wakeup**.

---

## Repository Structure

```text
lilygo-t5-ha-dashboard/
├── README.md                                   # Project overview & quick start
├── docs/
│   ├── STEP_BY_STEP_SETUP_GUIDE.md             # Beginner's hardware & HA installation guide
│   ├── LIPO_HARDWARE_GUIDE.md                  # H716 pinout, 40-pin female header & LiPo math
│   └── OPEN_SOURCE_REFERENCES.md               # Architectural lineage & driver references
├── esphome/
│   ├── lilygo-t5-h716-dashboard.yaml           # Main ESPHome configuration & substitutions
│   ├── secrets.yaml.example                    # Template for Wi-Fi, static IP & API keys
│   ├── fonts/
│   │   └── README.md                           # Font download links & MDI icon glyph table
│   ├── include/
│   │   └── epd_dashboard_ui.h                  # C++ 960x540 16-grayscale 4-tab UI renderer
│   └── packages/
│       ├── hardware_h716.yaml                  # ESP32-S3, Octal PSRAM, ED047TC1, GT911, PCF8563
│       ├── lipo_power_manager.yaml             # GPIO14 ADC, 11-pt SoC, Hybrid Deep Sleep engine
│       ├── ha_entities.yaml                    # Home Assistant sensors, switches & climate sync
│       └── touch_navigation.yaml               # GT911 960x540 touch hitboxes & HA service calls
├── homeassistant/
│   └── packages/
│       └── lilygo_t5_dashboard.yaml            # HA helpers, 5-day weather serializer & alerts
├── simulator/
│   ├── index.html                              # Interactive 960x540 E-Paper & LiPo simulator
│   ├── simulator.css                           # Bezel styling, e-ink flash animations & controls
│   └── simulator.js                            # Canvas renderer, GT911 hitboxes & HA API log
└── scripts/
    └── validate_project.py                     # Automated YAML, C++ ID, and hitbox verifier
```
