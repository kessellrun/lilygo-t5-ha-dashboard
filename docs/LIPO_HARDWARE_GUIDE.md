# LilyGo T5 4.7" E-Paper Touch `[H716]` Hardware, Pinout & LiPo Battery Guide

**SKU / Model:** LilyGo T5 4.7-Inch E-Paper Touch Non-Soldered Female Pin **`[H716]`** (`T5-4.7-Plus` ESP32-S3 Revision)

This guide covers the complete internal ESP32-S3 pinout, the 40-pin non-soldered female expansion header on the back of the `[H716]` board, 1S LiPo battery sizing and runtime math across all three power modes, and how to plug an optional local room sensor (`BME280` or `SHT4x`) directly into the female header with zero soldering.

---

## 1. Internal ESP32-S3 Hardware Pinout (`T5-4.7-Plus [H716]`)

All internal connections between the **ESP32-S3-WROOM-1-N16R8** (`16MB` Quad SPI Flash, `8MB` Octal `80MHz` PSRAM) and the onboard peripherals are pre-routed on the `[H716]` PCB:

### 1.1 ED047TC1 4.7" E-Paper Display (8-Bit Parallel `LCD_CAM` I80 Bus + Shift Register)

| Signal Name | ESP32-S3 GPIO | Direction | Description |
| :--- | :---: | :---: | :--- |
| **`EPD_D0`** | `GPIO6` | Output | 8-bit parallel data bus bit 0 |
| **`EPD_D1`** | `GPIO7` | Output | 8-bit parallel data bus bit 1 |
| **`EPD_D2`** | `GPIO4` | Output | 8-bit parallel data bus bit 2 |
| **`EPD_D3`** | `GPIO5` | Output | 8-bit parallel data bus bit 3 |
| **`EPD_D4`** | `GPIO10` | Output | 8-bit parallel data bus bit 4 |
| **`EPD_D5`** | `GPIO9` | Output | 8-bit parallel data bus bit 5 |
| **`EPD_D6`** | `GPIO46` | Output | 8-bit parallel data bus bit 6 |
| **`EPD_D7`** | `GPIO3` | Output | 8-bit parallel data bus bit 7 |
| **`CFG_DATA`** | `GPIO13` | Output | 74HC595 control shift register serial data |
| **`CFG_CLK`** | `GPIO12` | Output | 74HC595 control shift register clock |
| **`CFG_STR`** | `GPIO0` | Output | 74HC595 control shift register latch / strobe |
| **`CKV`** | `GPIO38` | Output | Vertical gate driver clock |
| **`STH`** | `GPIO40` | Output | Horizontal source driver start pulse |
| **`CKH`** | `GPIO41` | Output | Horizontal pixel clock (`LCD_PCLK`) |

### 1.2 Shared I2C Bus (`GT911` Capacitive Touch + `PCF8563` Real-Time Clock)

| Peripheral / Signal | ESP32-S3 GPIO | I2C Address | Description |
| :--- | :---: | :---: | :--- |
| **`I2C_SDA`** | `GPIO17` | Shared Bus | 400 kHz I2C Serial Data (shared by GT911, PCF8563, and Female Header) |
| **`I2C_SCL`** | `GPIO18` | Shared Bus | 400 kHz I2C Serial Clock (shared by GT911, PCF8563, and Female Header) |
| **`GT911_INT`** | `GPIO16` | `0x5D` / `0x14` | Capacitive Touch Interrupt (Active-Low; used as `EXT0` Deep Sleep Wakeup Pin!) |
| **`PCF8563_INT`** | `GPIO21` | `0x51` | Onboard Real-Time Clock Interrupt (Active-Low) |

### 1.3 1S LiPo Battery ADC, SD Card / LoRa Spots & Physical Buttons

| Signal Name | ESP32-S3 GPIO | Description |
| :--- | :---: | :--- |
| **`BATT_ADC`** | `GPIO14` | Connected to the `VBAT` rail via an onboard `100kΩ / 100kΩ` (`2:1`) resistor voltage divider (`ADC2_CH3`, use `attenuation: 12db` and `multiply: 2.0`). |
| **`BOOT` Button** | `GPIO0` | Physical edge button (Active-Low; hold while pressing `RST` for USB Bootloader mode). |
| **`RST` Button** | `EN` (`CHIP_PU`) | Physical hardware reset button on the edge of the board. |
| **`SD_MOSI / MISO / SCLK / CS`** | `GPIO15 / 16 / 11 / 42` | Reserved footprint pins on PCB revisions with MicroSD / SPI expansion. |

---

## 2. The 40-Pin Non-Soldered Female Header (`[H716]` Expansion Socket)

The signature feature of the **`[H716]`** model is its factory-installed **40-pin (`2×20`, `2.54mm` pitch) female socket strip** on the back of the PCB. Unlike the soldered male-pin version, the `[H716]` keeps the rear profile flat and lets you plug in standard male DuPont jumper wires or low-profile sensors with **zero soldering**.

```text
  ==============================================================================
  BACK OF LILYGO T5 4.7" [H716] — 40-PIN FEMALE HEADER ORIENTATION & SAFE PINS
  ==============================================================================

  Key exposed rails & safe expansion pins on the 2x20 female socket:
  +--------------------------------------------------------------------------+
  |  [3V3]  Power output (3.3V regulated, active when ESP32-S3 is awake)     |
  |  [GND]  Common Ground                                                    |
  |  [5V]   USB-C VBUS 5V rail (active only when USB-C cable is plugged in)  |
  |  [VBAT] Direct 1S LiPo battery rail (3.30V - 4.20V)                      |
  |  [IO17] Shared I2C SDA (400kHz, has onboard pull-ups)                    |
  |  [IO18] Shared I2C SCL (400kHz, has onboard pull-ups)                    |
  |  [IO43] UART0 TXD (free if serial logging is disabled)                   |
  |  [IO44] UART0 RXD (free if serial logging is disabled)                   |
  |  [IO45] Free General Purpose I/O (Note: Strapping pin at boot)           |
  |  [IO48] Free General Purpose I/O (ADC / NeoPixel / OneWire / PIR wake)   |
  +--------------------------------------------------------------------------+
```

> [!WARNING]
> **Do Not Connect External Sensors to the Display Bus Pins!**
> Several pins on the 40-pin header are internally shared with the high-speed 8-bit parallel ED047TC1 display bus (`GPIO3, 4, 5, 6, 7, 9, 10, 12, 13, 38, 40, 41, 46`) and battery ADC (`GPIO14`). Driving those pins externally will corrupt the E-Paper image. For external sensors, always use the shared **I2C bus (`GPIO17` SDA / `GPIO18` SCL)** or free pins `GPIO48` / `GPIO43` / `GPIO44`.

### How to Wire an Optional Local Room Sensor (`BME280` or `SHT4x`) to the Female Header

If you want your LilyGo T5 `[H716]` to measure the exact temperature and humidity at the desk or wall where it sits—in addition to displaying entities from Home Assistant—you can plug a 4-pin `BME280` (`I2C 0x76` or `0x77`) or `SHT40/SHT41/SHT45` (`I2C 0x44`) breakout module directly into the `[H716]` female header using 4 short male-to-female DuPont wires:

| Sensor Breakout Pin | Connect to `[H716]` Female Header Socket | Notes |
| :--- | :---: | :--- |
| **`VIN` / `VCC` (`3.3V`)** | **`3V3`** | Regulated `3.3V` rail (never connect sensor `VCC` to `5V`). |
| **`GND`** | **`GND`** | Common ground. |
| **`SDA`** | **`IO17`** | Shared cleanly with the onboard GT911 (`0x5D`) and PCF8563 (`0x51`). |
| **`SCL`** | **`IO18`** | Shared cleanly with the onboard GT911 (`0x5D`) and PCF8563 (`0x51`). |

Once wired, simply uncomment the ready-made `bme280_i2c:` or `sht4x:` block at the bottom of `esphome/packages/hardware_h716.yaml` and re-install!

---

## 3. 1S LiPo Battery Sizing, Voltage Curve & Runtime Calculations

### 3.1 Recommended 1S (`3.7V`) LiPo Pouch Cells

| Battery Cell Code | Nominal Capacity | Dimensions (`T × W × L`) | Fits Behind 4.7" Frame? | Estimated Runtime in **Adaptive Hybrid** | Estimated Runtime in **Max Battery (Deep Sleep)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`803450`** | `1,500 mAh` | `8.0 × 34 × 50 mm` | Easily fits flat | `~10–14 days` | `~55–65 days` |
| **`103450` (Sweet Spot)** | `2,000 mAh` | `10.0 × 34 × 50 mm` | Easily fits flat | `~15–20 days` | `~75–90 days` |
| **`605060` (Slim Wide)** | `2,200 mAh` | `6.0 × 50 × 60 mm` | Very slim (`6mm`), ideal for wall mounts | `~17–22 days` | `~85–100 days` |
| **`606090` (High Capacity)** | `4,000 mAh` | `6.0 × 60 × 90 mm` | Slim (`6mm`), covers rear footprint | `~30–40 days` | `~150–180 days (5–6 mos)` |
| **`105080` (Max Desk Stand)** | `5,000 mAh` | `10.0 × 50 × 80 mm` | Fits desk stand enclosures | `~38–50 days` | `~190–225 days (6–7 mos)` |

### 3.2 Why Our Firmware Uses an 11-Point Piecewise Linear LiPo Curve

A simple linear formula between `3.30V` (`0%`) and `4.20V` (`100%`) can be off by **up to 25%** in the middle of a 1S LiPo discharge cycle because Lithium Polymer chemistry maintains a flat voltage plateau between `3.70V` and `3.95V`, then drops steeply below `3.65V`.

Both `esphome/packages/lipo_power_manager.yaml` and the browser simulator (`simulator/simulator.js`) implement this exact calibrated 11-point lookup table on `GPIO14`:

| Cell Voltage (`VBAT`) | Raw `GPIO14` ADC Pin (`÷2`) | Calibrated SoC (`%`) | Power State Machine Behavior |
| :---: | :---: | :---: | :--- |
| **`>= 4.20 V`** | `2.100 V` | **`100%`** | Full charge (if `> 4.22V` or rising, `lipo_charging` = `ON`) |
| **`4.06 V`** | `2.030 V` | **`90%`** | Normal operation |
| **`3.98 V`** | `1.990 V` | **`80%`** | Normal operation |
| **`3.92 V`** | `1.960 V` | **`70%`** | Normal operation |
| **`3.87 V`** | `1.935 V` | **`60%`** | Normal operation |
| **`3.82 V`** | `1.910 V` | **`50%`** | Nominal `3.82V` storage midpoint |
| **`3.79 V`** | `1.895 V` | **`40%`** | Below `35%` (`~3.77V`), **Adaptive Hybrid** shifts daytime idle to Deep Sleep |
| **`3.75 V`** | `1.875 V` | **`30%`** | Touch-Armed Deep Sleep between 15m wake cycles |
| **`3.70 V`** | `1.850 V` | **`20%`** | Home Assistant **Low Battery Warning** notification (`< 20%`) |
| **`3.61 V`** | `1.805 V` | **`10%`** | Low-battery badge highlighted on E-Paper header (`< 3.45V` warn) |
| **`<= 3.32 V`** | `1.660 V` | **`0% - 4%`** | **CRITICAL HIBERNATE LOCK (`< 3.32V`)**: Draws "CHARGE VIA USB-C" screen & halts wake timers |

### 3.3 Current Draw Breakdown & Power Profile Math

| Operating State | Typical Current (`@ 3.8V`) | How Each Power Profile Uses It |
| :--- | :---: | :--- |
| **Active Wi-Fi + E-Paper Partial Refresh (`~0.8s`)** | `~115 mA` | Used during button taps and live sensor updates |
| **Active Wi-Fi + E-Paper Full Clean Refresh (`~1.8s`)** | `~135 mA` | Used every 15th refresh to eliminate ghosting |
| **Wi-Fi Light Modem Sleep (`DTIM` listening, `epd_poweroff()`)** | `~18–24 mA` | Daytime active window in **Always Online** & **Adaptive Hybrid** (`SoC > 35%`) |
| **Touch-Armed Deep Sleep (`ESP32-S3 Deep Sleep + GT911 Idle`)** | `~0.18–0.32 mA` (`180–320 µA`) | Used overnight (`23:00–06:00`), after idle timeout in **Adaptive Hybrid**, and full-time in **Max Battery** mode |
| **Critical Hibernate (`< 3.32V`, timer wake disabled)** | `~0.08 mA` (`80 µA`) | Protects the 1S LiPo cell from falling below its `2.8V` PCM hardware trip point |

### 3.4 Older LiPo Cells (ESR Voltage Sag) & Wake Cycle Timing

#### Voltage Sag & Rebound on Aging 1S LiPo Cells
As a 1S LiPo pouch cell ages (or operates in cooler ambient temperatures), its **Equivalent Series Resistance (ESR)** increases. During an active wake cycle—when the ESP32-S3 radio transmits over Wi-Fi and the ED047TC1 high-voltage boost rails charge for an E-Paper refresh—total battery draw briefly peaks at **`~115–250 mA`**.

- **Temporary Voltage Sag (`0.10V–0.25V`):** Across an aged cell with higher ESR (e.g., `400–800 mΩ`), that `~115–250 mA` load burst produces a temporary `0.10V–0.25V` drop at the `VBAT` terminal (and therefore at `GPIO14`), causing reported SoC/voltage to dip slightly while Wi-Fi and the display boost converter are active.
- **Deep Sleep Voltage Rebound:** As soon as the ESP32-S3 finishes refreshing the E-Paper panel, powers down the display rails (`epd_poweroff()`), and enters Deep Sleep (`~0.18–0.32 mA`), the load current drops by ~1,000× and the open-circuit cell voltage rebounds back up by `0.10V–0.25V`.
- **Why Short, Deterministic Wake Windows Matter:** Keeping active Wi-Fi + refresh bursts short prevents sustained sag from prematurely crossing the `3.45V` warning or `3.32V` critical-hibernate thresholds and preserves usable capacity on older cells. Note also that `GPIO14` samples `VBAT` immediately at boot so telemetry is captured cleanly without waiting 30 seconds.

#### Exact Awake Windows by Power Mode & Wake Source
The firmware distinguishes between an unattended **15-minute periodic timer wake** (`ESP_SLEEP_WAKEUP_TIMER`) and an intentional **user interaction wake** (touching the GT911 screen or pressing the `GPIO21` side button):

| Mode / Wake Source | Awake Window | Substitution Key | Behavior |
| :--- | :---: | :--- | :--- |
| **Periodic 15-Minute Timer Wake** (Max Battery, or Adaptive Hybrid overnight / `SoC <= 35%`) | **`12s`** | `timer_wake_sync_sec` | Connects to Wi-Fi, syncs HA states/time, performs a single E-Paper update, and returns straight to Deep Sleep unless the user taps the screen during the sync. |
| **Touch / `GPIO21` Button Wake — Max Battery Mode** (`mode = 2`) | **`30s`** | `max_battery_touch_timeout_sec` | Keeps Wi-Fi and touch active for `30s` after the last tap so you can toggle devices or switch tabs, then re-arms Deep Sleep. |
| **Touch / `GPIO21` Button Wake — Adaptive Hybrid Mode** (`mode = 1`) | **`90s`** | `inactivity_timeout_sec` | Keeps the panel responsive for `90s` after the last tap before re-entering Deep Sleep during Quiet Hours or when `SoC <= 35%`. |
| **Always Online Mode** (`mode = 0`) | **Continuous** | — | Stays connected in Wi-Fi Light Modem Sleep (`DTIM` listening) unless critical `< 3.32V` protection triggers. |
