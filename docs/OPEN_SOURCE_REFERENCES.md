# Open-Source References & Architectural Lineage

This project unifies the best hardware drivers, low-power e-paper refresh techniques, capacitive touch interactions, and Home Assistant UI patterns from six foundational open-source repositories in the LilyGo T5 E-Paper and ESPHome ecosystem.

---

## 1. Quick Reference Matrix of Foundational Projects

| Repository | Target MCU / Board | Primary Contribution to This Project |
| :--- | :--- | :--- |
| **[`hbast/lilygo_t5_47_plus`](https://github.com/hbast/lilygo_t5_47_plus)** | ESP32-S3 (`T5-4.7-Plus` / `[H716]`) | Native ESPHome external component wrapping `epdiy` / `LilyGo-EPD47` for the **ESP32-S3** 8-bit parallel I80 bus, Octal PSRAM framebuffer, and `epd_poweron()` / `epd_poweroff()` rail gating. |
| **[`nickolay/esphome-lilygo-t547plus`](https://github.com/nickolay/esphome-lilygo-t547plus)** | ESP32-S3 (`T5-4.7-Plus` / `[H716]`) | Drop-in alternative ESPHome display component for modern ESPHome releases (`2024.x–2026.x`), plus PCF8563 RTC + GT911 shared I2C (`GPIO17`/`GPIO18`) bus timing validation. |
| **[`Xinyuan-LilyGO/LilyGo-EPD47`](https://github.com/Xinyuan-LilyGO/LilyGo-EPD47)** (`esp32s3` branch) | ESP32 & ESP32-S3 (`ED047TC1` 960×540) | Official LilyGo hardware schematics, ED047TC1 16-grayscale LUT waveforms, TPS65185 / shift-register power sequence (`epd_poweroff()` before deep sleep to prevent dark border burn-in), and `GPIO14` 2:1 voltage divider calibration. |
| **[`tolnai/esphome-dashboard-lilygo-t5`](https://github.com/tolnai/esphome-dashboard-lilygo-t5)** | LilyGo T5 4.7" E-Paper | Clean multi-card visual hierarchy, Material Design Icons (`materialdesignicons-webfont.ttf`) glyph mapping, and Home Assistant weather/room card layout patterns for 960×540 e-ink. |
| **[`kotope/esphome_eink_dashboard`](https://github.com/kotope/esphome_eink_dashboard)** | ESPHome E-Paper Dashboards | Deep-sleep lifecycle orchestration, OTA "Stay Awake" helper lock (`input_boolean`), anti-ghosting full-refresh counter strategy, and battery discharge telemetry. |
| **[`rktdno/esphome-lilygo-t5-epaper-s3-pro`](https://github.com/rktdno/esphome-lilygo-t5-epaper-s3-pro)** | LilyGo T5 S3 Touch E-Paper | Capacitive GT911 touch hitbox architecture, multi-page/tab switching state machine in ESPHome globals, and immediate partial/fast refresh feedback on touch events. |

---

## 2. Understanding the LilyGo T5 4.7" Hardware Generations (Why `[H716]` Needs Specific Drivers)

A major trap for beginners searching online for "LilyGo T5 4.7 ESPHome YAML" is mixing up three distinct hardware revisions sold by LilyGo. Using an older ESP32 configuration on the `[H716]` board will fail to boot or fail to initialize the screen because the internal pinout and PSRAM mode changed completely:

| Feature | Legacy v1.0 / v2.3 (`T5-4.7`) | **Target Hardware: T5-4.7-Plus (`[H716]`)** | T5 E-Paper S3 Pro (`[H692]`) |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | Original ESP32-WROVER-E | **ESP32-S3-WROOM-1-N16R8** | ESP32-S3-WROOM-1 |
| **Flash / PSRAM** | 16MB Flash / 8MB **Quad** PSRAM | **16MB Flash / 8MB Octal (`80MHz`) PSRAM** | 16MB Flash / 8MB Octal PSRAM |
| **Display Panel** | 4.7" ED047TC1 (`960×540`) | **4.7" ED047TC1 (`960×540`, 16-Grayscale)** | 4.7" Ultra-Wide / Dual-IC |
| **Touch Controller** | Optional / Add-on shield | **Built-in GT911 (`I2C 0x5D/0x14`, `SDA=17`, `SCL=18`, `INT=16`)** | GT911 Capacitive Touch |
| **Onboard RTC** | None | **PCF8563 (`I2C 0x51` on `GPIO17`/`GPIO18`, `INT=21`)** | PCF8563 |
| **LiPo Voltage ADC** | `GPIO36` (`VP`) | **`GPIO14` (internal 100kΩ/100kΩ 2:1 divider)** | I2C Fuel Gauge / ADC |
| **Expansion Header** | 2.54mm male pins | **40-Pin Non-Soldered Female Header Socket (`[H716]`)** | Qwiic / Stemma QT |
| **ESPHome Platform** | `lilygo_t5_47` | **`lilygo_t5_47_plus` (`hbast` / `nickolay`)** | Custom SPI/I80 |

---

## 3. Detailed Breakdown of Each Referenced Open-Source Project

### 3.1 `hbast/lilygo_t5_47_plus` & `nickolay/esphome-lilygo-t547plus`
- **Repositories:**
  - `https://github.com/hbast/lilygo_t5_47_plus`
  - `https://github.com/nickolay/esphome-lilygo-t547plus`
- **Problem Solved:** The mainline ESPHome `lilygo_t5_47` component was written for the older ESP32-WROVER chip using `I2S0` parallel DMA, which no longer exists on the **ESP32-S3** (the ESP32-S3 replaces I2S parallel mode with the dedicated `LCD_CAM` peripheral).
- **How We Use It in `esphome/packages/hardware_h716.yaml`:**
  - Configured via `external_components:` pointing to `github://hbast/lilygo_t5_47_plus` (with a one-line drop-in fallback comment for `github://nickolay/esphome-lilygo-t547plus`).
  - Allocates the 960×540 4-bit grayscale framebuffer inside the ESP32-S3's **8MB Octal PSRAM** (`mode: octal`, `speed: 80MHz`) and drives the 8-bit parallel data bus (`D0..D7` on `GPIO6, 7, 4, 5, 10, 9, 46, 3`) at full frame rates.

### 3.2 `Xinyuan-LilyGO/LilyGo-EPD47` (`esp32s3` Branch)
- **Repository:** `https://github.com/Xinyuan-LilyGO/LilyGo-EPD47/tree/esp32s3`
- **Problem Solved:** Provides the canonical hardware pin mappings for the `[H716]` PCB, the `epd_poweron()` / `epd_poweroff()` high-voltage rail sequencing, and the `GPIO14` battery voltage measurement circuit.
- **Critical Hardware Insight Applied Here:**
  - The ED047TC1 e-paper panel uses `-15V` / `+15V` / `+22V` rails to move charged pigment microcapsules. If the ESP32-S3 enters Deep Sleep while those rails remain energized, the panel draws excess current and permanently darkens/burns the screen edges.
  - Both the `lilygo_t5_47_plus` driver and our `lipo_power_manager.yaml` sleep sequence ensure the display driver completes `epd_poweroff()` before `deep_sleep_ctrl` powers down the MCU.

### 3.3 `tolnai/esphome-dashboard-lilygo-t5`
- **Repository:** `https://github.com/tolnai/esphome-dashboard-lilygo-t5`
- **Problem Solved:** Demonstrates how to structure high-contrast 960×540 e-ink typography, weather forecast columns, and multi-room temperature/humidity grids without visual clutter.
- **How We Extended It in `esphome/include/epd_dashboard_ui.h`:**
  - Adopted the clean card-grid proportions and Material Design Icons (`materialdesignicons-webfont.ttf`) glyph rendering.
  - Upgraded the weather integration for **Home Assistant 2024.3+** compatibility by pairing `homeassistant/packages/lilygo_t5_dashboard.yaml` (`weather.get_forecasts` action) with a lightweight C++ string tokenizer (`Day|Cond|Hi|Lo;...`) that requires zero JSON heap allocation on the ESP32-S3.

### 3.4 `kotope/esphome_eink_dashboard`
- **Repository:** `https://github.com/kotope/esphome_eink_dashboard`
- **Problem Solved:** Managing battery-powered ESPHome e-paper displays that sleep most of the time—specifically solving how to push wireless OTA updates and how to protect 1S LiPo cells from over-discharge.
- **How We Extended It in `esphome/packages/lipo_power_manager.yaml`:**
  - Implemented the **OTA Stay-Awake Lock** (`input_boolean.lilygo_t5_stay_awake_ota`) plus an automatic 2-hour safety timeout automation in Home Assistant.
  - Added an **11-Point Piecewise Linear 1S LiPo Discharge Curve** (`4.20V=100%` down to `3.30V=0%`) rather than a naive linear formula, plus a **Critical Low-Battery Hibernate Screen** at `< 3.32V` that renders a persistent "CHARGE VIA USB-C" graphic and halts wake timers to save the LiPo pouch cell.

### 3.5 `rktdno/esphome-lilygo-t5-epaper-s3-pro`
- **Repository:** `https://github.com/rktdno/esphome-lilygo-t5-epaper-s3-pro`
- **Problem Solved:** Turning a passive e-paper display into an **interactive capacitive touch control panel** using the Goodix GT911 touch controller (`GPIO17`/`GPIO18` I2C + `GPIO16` interrupt).
- **How We Unified It in `esphome/packages/touch_navigation.yaml`:**
  - Mapped the 960×540 GT911 coordinate space into a **4-Tab Bottom Navigation Bar** (`y: 476..540`), **2 Header Quick-Action Buttons** (`[REFRESH]` and `[SLEEP / MODE]`), and a **2×3 Contextual Card Grid** (`y: 75..435`).
  - Configured `GPIO16` (`GT911_INT`, active-low) as the `EXT0` hardware wakeup pin (`wakeup_pin: GPIO16`), allowing the display to sleep at `~180 µA` and still wake up when you tap the glass screen.
