# Font Assets Guide (`esphome/fonts/`)

ESPHome rasterizes TrueType (`.ttf`) fonts at compile time into compact C++ bitmaps tailored for the **960 × 540 16-level grayscale ED047TC1 E-Paper panel**. Because binary font assets are not stored in git, place the 3 required `.ttf` files in this folder (`/config/esphome/fonts/`) before compiling `lilygo-t5-h716-dashboard.yaml`.

---

## 1. Required Font Files

Ensure your `/config/esphome/fonts/` directory contains these exact filenames:

| Filename | Purpose | Used By ESPHome Font IDs |
| :--- | :--- | :--- |
| `Roboto-Regular.ttf` | Crisp body text, labels, subtitles | `font_regular_14`, `font_regular_18` |
| `Roboto-Bold.ttf` | High-contrast headers, metrics, buttons | `font_bold_14`, `font_bold_18`, `font_bold_24`, `font_bold_36`, `font_bold_48` |
| `materialdesignicons-webfont.ttf` | Weather, Smart Home, HVAC & Battery icons | `font_mdi_22`, `font_mdi_32`, `font_mdi_48` |

---

## 2. One-Command Download (Home Assistant Terminal / Linux / macOS / WSL)

If you have the **Terminal & SSH** add-on in Home Assistant (or are building locally), run these commands to download all three fonts directly into `/config/esphome/fonts/`:

```bash
mkdir -p /config/esphome/fonts
cd /config/esphome/fonts

# 1. Roboto-Regular.ttf & Roboto-Bold.ttf (Google Fonts Official Repository)
curl -L -o Roboto-Regular.ttf "https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Regular.ttf"
curl -L -o Roboto-Bold.ttf "https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf"

# 2. materialdesignicons-webfont.ttf (Pictogrammers MaterialDesign-Webfont v7.4.47)
curl -L -o materialdesignicons-webfont.ttf "https://github.com/Templarian/MaterialDesign-Webfont/raw/v7.4.47/fonts/materialdesignicons-webfont.ttf"
```

### Windows PowerShell Download Commands

```powershell
New-Item -ItemType Directory -Force -Path ".\esphome\fonts" | Out-Null
Invoke-WebRequest -Uri "https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Regular.ttf" -OutFile ".\esphome\fonts\Roboto-Regular.ttf"
Invoke-WebRequest -Uri "https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf" -OutFile ".\esphome\fonts\Roboto-Bold.ttf"
Invoke-WebRequest -Uri "https://github.com/Templarian/MaterialDesign-Webfont/raw/v7.4.47/fonts/materialdesignicons-webfont.ttf" -OutFile ".\esphome\fonts\materialdesignicons-webfont.ttf"
```

---

## 3. Material Design Icons (MDI) Codepoint Reference Table

Every icon rendered by `esphome/include/epd_dashboard_ui.h` and declared in `lilygo-t5-h716-dashboard.yaml` is listed below with its UTF-8 C++ escape sequence and Unicode hex codepoint:

| MDI Icon Name | Unicode Codepoint | YAML Glyph Escape | C++ Escape (`epd_dashboard_ui.h`) | Dashboard Usage |
| :--- | :--- | :--- | :--- | :--- |
| `mdi-weather-sunny` | `U+F0599` | `\U000F0599` | `\U000F0599` | Sunny / Clear Day weather |
| `mdi-weather-cloudy` | `U+F0590` | `\U000F0590` | `\U000F0590` | Cloudy / Overcast weather |
| `mdi-weather-partly-cloudy` | `U+F0595` | `\U000F0595` | `\U000F0595` | Partly Cloudy weather |
| `mdi-weather-rainy` | `U+F0597` | `\U000F0597` | `\U000F0597` | Light / Moderate Rain |
| `mdi-weather-pouring` | `U+F0596` | `\U000F0596` | `\U000F0596` | Heavy Rain / Downpour |
| `mdi-weather-lightning` | `U+F0593` | `\U000F0593` | `\U000F0593` | Thunderstorm |
| `mdi-weather-snowy` | `U+F0598` | `\U000F0598` | `\U000F0598` | Snow / Sleet / Hail |
| `mdi-weather-windy` | `U+F059D` | `\U000F059D` | `\U000F059D` | Windy / Foggy conditions |
| `mdi-weather-night` | `U+F0594` | `\U000F0594` | `\U000F0594` | Clear Night / Goodnight Scene |
| `mdi-lightbulb-on` | `U+F0335` | `\U000F0335` | `\U000F0335` | Living Room Light (ON) |
| `mdi-lightbulb-outline` | `U+F0336` | `\U000F0336` | `\U000F0336` | Living Room Light (OFF) |
| `mdi-ceiling-light` | `U+F08DD` | `\U000F08DD` | `\U000F08DD` | Kitchen Pendant Lights |
| `mdi-power-plug` | `U+F0425` | `\U000F0425` | `\U000F0425` | Office Desk Switch |
| `mdi-lock` | `U+F033E` | `\U000F033E` | `\U000F033E` | Front Door Lock (LOCKED) |
| `mdi-lock-open` | `U+F033F` | `\U000F033F` | `\U000F033F` | Front Door Lock (UNLOCKED) |
| `mdi-garage` | `U+F06D9` | `\U000F06D9` | `\U000F06D9` | Garage Door Cover (CLOSED) |
| `mdi-garage-open` | `U+F06DA` | `\U000F06DA` | `\U000F06DA` | Garage Door Cover (OPEN) |
| `mdi-thermometer` | `U+F050F` | `\U000F050F` | `\U000F050F` | Room Temperature / Climate tab |
| `mdi-water-percent` | `U+F058E` | `\U000F058E` | `\U000F058E` | Relative Humidity % |
| `mdi-fire` | `U+F0238` | `\U000F0238` | `\U000F0238` | HVAC Heating active |
| `mdi-snowflake` | `U+F0717` | `\U000F0717` | `\U000F0717` | HVAC Cooling active |
| `mdi-fan` | `U+F0210` | `\U000F0210` | `\U000F0210` | HVAC Fan / Idle / Circulation |
| `mdi-battery` | `U+F0079` | `\U000F0079` | `\U000F0079` | 1S LiPo Discharging indicator |
| `mdi-battery-charging` | `U+F0084` | `\U000F0084` | `\U000F0084` | USB-C / LiPo Charging active |
| `mdi-battery-alert` | `U+F0083` | `\U000F0083` | `\U000F0083` | Low / Critical Battery alert |
| `mdi-wifi` | `U+F05A9` | `\U000F05A9` | `\U000F05A9` | Wi-Fi Connected status |
| `mdi-wifi-off` | `U+F05AA` | `\U000F05AA` | `\U000F05AA` | Wi-Fi Disconnected status |
| `mdi-refresh` | `U+F0450` | `\U000F0450` | `\U000F0450` | Header Full Clean Refresh button |
| `mdi-sleep` | `U+F04B2` | `\U000F04B2` | `\U000F04B2` | Header Sleep / Power Mode button |
| `mdi-home-automation` | `U+F07D0` | `\U000F07D0` | `\U000F07D0` | Smart Home Controls tab icon |
