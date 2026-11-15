# Complete Beginner's Step-by-Step Installation & Setup Guide

**Target Hardware:** LilyGo T5 4.7-Inch E-Paper Touch Non-Soldered Female Pin **`[H716]`** (ESP32-S3-WROOM-1-N16R8, ED047TC1 960×540 16-Grayscale EPD, GT911 Capacitive Touch, PCF8563 RTC)

Welcome! This guide is written from the ground up for someone with **zero prior experience** flashing ESP32 microcontrollers or setting up custom Home Assistant packages and services. Follow Parts 1 through 5 in order and you will have a wireless, touch-interactive E-Paper Smart Home Dashboard running on your LiPo battery.

---

## Part 1: Missing Items & Hardware Checklist

### 1.1 What Comes Inside the LilyGo T5 `[H716]` Box vs. What You Need to Supply

| Item | Included in H716 Box? | Notes & Exact Specification |
| :--- | :---: | :--- |
| **LilyGo T5 4.7" E-Paper `[H716]` Board** | **Yes** | Pre-assembled ESP32-S3 PCB bonded to the 4.7" ED047TC1 E-Ink display + GT911 glass touch panel, with a 40-pin non-soldered female header on the back. |
| **2-Pin JST 2.0mm PH Battery Pigtail Lead** | **Usually Included** | Small red/black wire pigtail in the box for soldering to a raw cell if needed. |
| **1S 3.7V LiPo Pouch Battery** | **NO (Must Supply)** | **Recommended:** `2,000 mAh` to `5,000 mAh` single-cell (`1S`, `3.7V` nominal / `4.2V` max) LiPo pouch battery (common cell codes: **`103450`** for 2000mAh, **`605060`** for 2500mAh, or **`606090`** for 4000mAh) with a **2-pin JST 2.0mm PH** plug. |
| **USB-C Data Cable** | **NO (Must Supply)** | Must be a **USB-C Data + Charge cable** (not a power-only charging cable from a lamp/fan) for the first-time USB flash from your computer. |
| **3 TrueType Font Files (`.ttf`)** | **NO (Free Download)** | `Roboto-Regular.ttf`, `Roboto-Bold.ttf`, and `materialdesignicons-webfont.ttf` (free download instructions in Section 1.4 below). |
| **Web Browser (Chrome or Edge)** | **Free on PC/Mac** | Google Chrome or Microsoft Edge on your computer is required for WebSerial USB flashing (`web.esphome.io`). Safari and Firefox do not support WebSerial. |

### 1.2 Choosing the Right 1S LiPo Battery & Connector (`JST 2.0mm PH`)

When ordering a 1S (`3.7V`) LiPo pouch battery on Amazon, Adafruit, SparkFun, or AliExpress:
1. **Voltage:** Must be a **1S (Single Cell) 3.7V nominal / 4.2V full charge** Lithium Polymer (LiPo) or Lithium-Ion battery with a built-in protection circuit module (PCM). Never use a 2S (`7.4V`) battery!
2. **Connector Pitch:** The white battery socket on the back of the LilyGo T5 `[H716]` is a **2-pin JST-PH 2.0mm** socket (the pins are spaced `2.0mm` apart).
   - *Note:* Maker batteries from Adafruit and most Amazon "JST 2.0mm PH 3.7V LiPo" listings fit directly. Beware of tiny micro-drone batteries that use `1.25mm` Molex PicoBlade or `2.54mm` DuPont plugs.

### 1.3 CRITICAL BEFORE PLUGGING IN YOUR BATTERY: 10-Second Polarity Check!

> [!CAUTION]
> **CHECK WIRE POLARITY BEFORE PLUGGING IN YOUR LIPO BATTERY!**
> There is no universal industry standard for which side of a 2-pin JST-PH 2.0mm plug carries the Red (`+`) vs. Black (`-`) wire. Around 30% of generic Amazon/AliExpress LiPo batteries come wired **backwards** compared to the LilyGo T5 PCB! Plugging in a reversed battery will immediately damage the onboard charging chip.

Hold your LilyGo T5 `[H716]` with the back of the circuit board facing you and inspect the silkscreen `+` and `-` symbols printed right next to the white 2-pin battery socket:

```text
  ===================================================================
  BACK OF LILYGO T5 4.7" [H716] PCB (LOOK AT THE "+" AND "-" MARKINGS)
  ===================================================================

        +---------------------------------------------------+
        |  [40-Pin Non-Soldered Female Header Socket]       |
        |  o o o o o o o o o o o o o o o o o o o o          |
        |  o o o o o o o o o o o o o o o o o o o o          |
        |                                                   |
        |                             White JST-PH 2.0mm    |
        |                               Battery Socket      |
        |                                 +-------+         |
        |   Silkscreen Markings ----->  + |  o o  | -       |
        |                                 +---+---+         |
        +-------------------------------------|-------------+
                                              |
                                              ^
                                    Insert JST-PH Plug Here:
                                      +-------+
                                      |  | |  |
                                      +---+---+
                                         | |
                   RED WIRE (+3.7V) -----+ +----- BLACK WIRE (GND)
               MUST ALIGN WITH PCB "+"        MUST ALIGN WITH PCB "-"
```

**What if my battery's Red (`+`) and Black (`-`) wires are backwards?**
You do **not** need a soldering iron! You can swap the wires in 10 seconds using a sewing pin, safety pin, or fine tweezers:
1. Look closely at one side of the white plastic JST plug on your battery. You will see two tiny rectangular plastic retention tabs holding the shiny metal crimps inside the housing.
2. Gently lift one plastic tab up `1 mm` with the tip of a sewing pin while sliding that wire out the back of the plug.
3. Repeat for the second wire.
4. Push the **Red (`+`)** wire and **Black (`-`)** wire back into the swapped holes until they click into place, and double-check against the `+` and `-` markings on the LilyGo PCB before plugging it in!

### 1.4 Downloading the 3 Required Font Files

ESPHome compiles TrueType fonts directly into the firmware binary so the 960×540 E-Paper screen can render crisp typography and Material Design weather/smart-home icons.

Download these 3 files and place them inside the `esphome/fonts/` folder:
1. **`Roboto-Regular.ttf`** — Download from [Google Fonts (Roboto)](https://fonts.google.com/specimen/Roboto) or directly from the [Google Fonts GitHub repository](https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Regular.ttf).
2. **`Roboto-Bold.ttf`** — Included in the same Roboto download or from [Google Fonts GitHub (`Roboto-Bold.ttf`)](https://github.com/googlefonts/roboto-2/raw/main/src/hinted/Roboto-Bold.ttf).
3. **`materialdesignicons-webfont.ttf`** — Download from the official [Pictogrammers MaterialDesign-Webfont repository (`fonts/materialdesignicons-webfont.ttf`)](https://github.com/Templarian/MaterialDesign-Webfont/raw/master/fonts/materialdesignicons-webfont.ttf).

Make sure the filenames inside `esphome/fonts/` match these exact three names:
- `esphome/fonts/Roboto-Regular.ttf`
- `esphome/fonts/Roboto-Bold.ttf`
- `esphome/fonts/materialdesignicons-webfont.ttf`

---

## Part 2: Setting Up the Home Assistant Companion Package & Services

Before flashing the screen, we will set up the Home Assistant companion package (`homeassistant/packages/lilygo_t5_dashboard.yaml`). This creates the helper switches (like **Stay Awake for OTA Updates** and **Power Profile**), low-battery alerts, and the **5-Day Compact Weather Forecast sensor** (`sensor.lilygo_t5_weather_forecast_compact`).

### Step 2.1: Install "File editor" (or "Studio Code Server") in Home Assistant
If you already have a way to edit files in `/config`, skip to Step 2.2. Otherwise:
1. Open your Home Assistant web interface.
2. Go to **Settings** (bottom left gear icon) $\rightarrow$ **Add-ons** $\rightarrow$ click the blue **Add-on Store** button (bottom right).
3. Search for **File editor** (or **Studio Code Server**), click it, and click **Install**.
4. Once installed, turn on **Show in sidebar** and click **Start**.
5. Click **File editor** in your left sidebar.

### Step 2.2: Enable the `packages` Folder in `/config/configuration.yaml`
1. In **File editor**, click the folder icon in the top-left corner and open **`configuration.yaml`**.
2. Check if you already have a `homeassistant:` section. Add the `packages: !include_dir_named packages` line under `homeassistant:` using exact 2-space indentation like this:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

3. Click the red **Save** (floppy disk) icon in the top-right corner.

### Step 2.3: Upload `lilygo_t5_dashboard.yaml` into `/config/packages/`
1. In **File editor**, click the folder icon in the top-left corner, click **New Folder**, and name it **`packages`** (so its path is `/config/packages`).
2. Open the newly created `packages` folder, click **Upload File** (or **New File**), and upload **`homeassistant/packages/lilygo_t5_dashboard.yaml`** from this project into `/config/packages/lilygo_t5_dashboard.yaml`.

### Step 2.4: Set Your Weather Entity Name Inside `lilygo_t5_dashboard.yaml`
Home Assistant installations name their weather entity based on the weather integration you use (typically `weather.forecast_home` or `weather.home`).
1. To check your exact weather entity name:
   - Open a new browser tab to Home Assistant $\rightarrow$ **Settings** $\rightarrow$ **Devices & Services** $\rightarrow$ click the **Entities** tab at the top.
   - Type `weather.` into the search bar.
   - Copy the **Entity ID** shown (for example, `weather.forecast_home`).
2. If your Entity ID is `weather.forecast_home`, you don't need to change anything!
3. If your Entity ID is different (for example, `weather.home`), open `/config/packages/lilygo_t5_dashboard.yaml` in **File editor** and replace the 3 occurrences of `weather.forecast_home` (around lines 73, 76, and 85) with your weather entity ID, then click **Save**.

### Step 2.5: Check Configuration & Restart Home Assistant
1. Go to **Developer Tools** in your left sidebar (if you don't see Developer Tools, click your user profile initials at the very bottom left and toggle on **Advanced Mode**).
2. Under the **YAML** tab, click **Check Configuration**. Wait for the green message: *"Configuration will not prevent Home Assistant from starting!"*
3. Click **Restart** $\rightarrow$ **Restart Home Assistant** (or click **All YAML configuration** to reload).
4. Once Home Assistant finishes restarting, go to **Developer Tools** $\rightarrow$ **States** and search for `lilygo_t5`. You will see your new entities ready and waiting:
   - `sensor.lilygo_t5_weather_forecast_compact` *(showing a 5-day string like `Mon|sunny|74|56;Tue|...`)*
   - `input_boolean.lilygo_t5_stay_awake_ota`
   - `input_select.lilygo_t5_power_profile`
   - `input_number.lilygo_t5_quiet_hours_start`
   - `input_number.lilygo_t5_quiet_hours_end`

---

## Part 3: Programming (Flashing) the LilyGo T5 `[H716]` Hardware for the First Time

Because a brand-new LilyGo T5 `[H716]` does not know your Wi-Fi password yet, the **very first installation** is done with a USB-C cable plugged into your computer. Every future update after that can be done wirelessly over Wi-Fi!

### Step 3.1: Install the ESPHome Add-on in Home Assistant
1. In Home Assistant, go to **Settings** $\rightarrow$ **Add-ons** $\rightarrow$ **Add-on Store**.
2. Search for **ESPHome** (or **ESPHome Device Builder**), click it, and click **Install**.
3. Once installed, turn on **Start on boot**, **Watchdog**, and **Show in sidebar**, then click **Start**.

### Step 3.2: Copy the `esphome/` Project Files into `/config/esphome/`
Using **File editor**, **Studio Code Server**, or the **Samba share** add-on, copy the contents of this repository's `esphome/` directory into your Home Assistant `/config/esphome/` directory so your folder structure inside `/config/esphome/` looks exactly like this:

```text
/config/esphome/
├── lilygo-t5-h716-dashboard.yaml       <-- Main device configuration
├── secrets.yaml                        <-- Copy from secrets.yaml.example & edit!
├── fonts/
│   ├── Roboto-Regular.ttf              <-- Downloaded in Step 1.4
│   ├── Roboto-Bold.ttf                 <-- Downloaded in Step 1.4
│   └── materialdesignicons-webfont.ttf <-- Downloaded in Step 1.4
├── include/
│   └── epd_dashboard_ui.h              <-- C++ 960x540 4-Tab UI Renderer
└── packages/
    ├── hardware_h716.yaml              <-- ESP32-S3, PSRAM, ED047TC1, GT911, PCF8563
    ├── lipo_power_manager.yaml         <-- GPIO14 LiPo ADC, 11-pt SoC, Hybrid Sleep
    ├── ha_entities.yaml                <-- Home Assistant entity subscriptions
    └── touch_navigation.yaml           <-- GT911 960x540 touch hitboxes & actions
```

### Step 3.3: Enter Your Wi-Fi & Static IP Settings in `/config/esphome/secrets.yaml`
1. If you do not already have a `/config/esphome/secrets.yaml` file, rename `secrets.yaml.example` to **`secrets.yaml`**.
2. Open `/config/esphome/secrets.yaml` and fill in your 2.4 GHz Wi-Fi name, password, and a static IP address on your home router's subnet:

```yaml
wifi_ssid: "Your_2.4GHz_WiFi_Name"
wifi_password: "Your_WiFi_Password"

# Assigning a static IP speeds up Wi-Fi reconnection after Deep Sleep by 2-3 seconds!
static_ip: "192.168.1.185"
gateway_ip: "192.168.1.1"
subnet_mask: "255.255.255.0"
dns_ip: "192.168.1.1"

# 32-byte base64 key (you can keep the example key or generate one in ESPHome)
api_encryption_key: "YOUR_GENERATED_32_BYTE_BASE64_KEY_HERE"
ota_password: "choose_an_ota_password"
```

> [!TIP]
> **Why is a Static IP important for a LiPo battery display?**
> Every time the LilyGo T5 wakes from 15-minute Deep Sleep or Touch Wake, skipping DHCP negotiation saves `2.0 to 3.5 seconds` of high-current Wi-Fi radio time—nearly **doubling** your battery life over a month! Make sure the `192.168.x.x` numbers match your home router's IP range.

### Step 3.4: First-Time USB-C Flash via Chrome or Edge
1. Open the **ESPHome** dashboard from your Home Assistant left sidebar (you must use **Google Chrome** or **Microsoft Edge** on your laptop/desktop).
2. You will see a card titled **`lilygo-t5-h716-dashboard`**.
3. Click the three dots (`⋮`) in the bottom-right corner of the `lilygo-t5-h716-dashboard` card and click **Install**.
4. Select **Manual download** (this is the most reliable method across all setups because it compiles the firmware on your Home Assistant server and downloads the ready-to-flash `.bin` file to your computer):
   - *Note:* The first compilation takes **3 to 6 minutes** while ESPHome downloads the ESP32-S3 toolchain, `hbast/lilygo_t5_47_plus` display driver, and rasterizes the fonts.
   - When compilation finishes, your browser will automatically download **`lilygo-t5-h716-dashboard.factory.bin`** (or choose **Factory format (Previously Modern)**).
5. Plug your **LilyGo T5 `[H716]`** into your computer using your **USB-C data cable**.
6. Open **[https://web.esphome.io](https://web.esphome.io)** in Google Chrome or Microsoft Edge.
7. Click **Connect** and select the USB Serial / JTAG port that appears (usually named `USB JTAG/serial debug unit (COMx)` on Windows or `/dev/cu.usbmodem...` on Mac).

#### What if the USB port doesn't appear or fails to connect? (Entering ESP32-S3 Bootloader Mode)
If your board does not show up or disconnects during connection, put the ESP32-S3 into **Download / Bootloader Mode** using the physical buttons on the edge of the LilyGo T5 `[H716]`:
1. Locate the small **`BOOT`** (sometimes labeled `IO0`) and **`RST`** (Reset) buttons along the edge of the PCB.
2. **Hold down** the **`BOOT`** button and keep holding it.
3. While still holding `BOOT`, **press and release** the **`RST`** button once.
4. **Release** the **`BOOT`** button.
5. Click **Connect** on `web.esphome.io` again—the `USB JTAG/serial debug unit` port will now appear immediately!

8. On `web.esphome.io`, click **Install**, select the **`lilygo-t5-h716-dashboard.factory.bin`** file you downloaded in step 4, and click **Install**.
9. Wait ~60 seconds for the progress bar to reach `100%`.
10. **Important final step after USB flashing:** Press the physical **`RST`** button on the LilyGo T5 once to exit bootloader mode and start the firmware. Within 5–10 seconds, the 4.7-inch E-Paper screen will perform its crisp initialization flash and draw the 4-Tab Smart Home Dashboard!

---

## Part 4: Connecting the Display to Home Assistant & Enabling Action Permissions

Once the LilyGo T5 `[H716]` boots and connects to your Wi-Fi, Home Assistant will automatically detect it on your local network.

### Step 4.1: Adopt / Add the Device in Home Assistant
1. In Home Assistant, go to **Settings** $\rightarrow$ **Devices & Services**.
2. Under the **Discovered** section at the top, look for **LilyGo T5 H716 Dashboard (`lilygo-t5-h716-dashboard`)** and click **Configure** $\rightarrow$ **Submit**.
   - *(If it is not auto-discovered within 1 minute, click the blue **+ Add Integration** button in the bottom-right corner, select **ESPHome**, enter the `static_ip` you set in `secrets.yaml`, and click **Submit**).*
3. If prompted for the **Encryption Key**, paste the `api_encryption_key` from your `secrets.yaml` file.

### Step 4.2: CRUCIAL — Enable "Allow the device to perform Home Assistant actions"
> [!IMPORTANT]
> **YOUR TOUCHSCREEN BUTTONS WILL NOT TOGGLE LIGHTS OR THERMOSTATS UNTIL YOU ENABLE THIS CHECKBOX!**
> Starting in Home Assistant 2023.9, newly added ESPHome devices are blocked by default from calling Home Assistant services (`light.toggle`, `climate.set_temperature`, `lock.lock`, etc.) for security until you explicitly grant permission.

Follow these 4 clicks right now so your capacitive touchscreen cards can control your smart home:
1. Go to **Settings** $\rightarrow$ **Devices & Services** $\rightarrow$ click on the **ESPHome** integration card.
2. Find **LilyGo T5 H716 Dashboard** in the list and click the **Configure** button (gear icon) next to it.
3. Check the box labeled:
   - `[x]` **Allow the device to perform Home Assistant actions**
4. Click **Submit**.

Try tapping one of the 6 Smart Home Control cards on **Tab 0 (`CONTROLS`)** of your E-Paper screen—it will now immediately execute the action in Home Assistant and refresh the card state!

---

## Part 5: Mapping Your Own Home Assistant Entities & Managing Wireless OTA Updates on Battery

Out of the box, `esphome/lilygo-t5-h716-dashboard.yaml` comes pre-populated with clean sample entity IDs in its top `substitutions:` block so it compiles immediately even before you customize it. Now let's link it to your real smart home devices.

### Step 5.1: How to Find Your Own Entity IDs in Home Assistant
1. In Home Assistant, go to **Settings** $\rightarrow$ **Devices & Services** $\rightarrow$ click the **Entities** tab at the top.
2. Search for the light, switch, lock, garage door, room temperature sensor, or thermostat you want on your dashboard.
3. Copy the exact **Entity ID** (for example, `light.living_room_lamp`, `sensor.bedroom_temperature`, or `climate.hallway_thermostat`).

### Step 5.2: Edit the `substitutions:` Block in `esphome/lilygo-t5-h716-dashboard.yaml`
1. Open `/config/esphome/lilygo-t5-h716-dashboard.yaml` in the **ESPHome** dashboard editor (or **File editor**).
2. Right at the top of the file, under `substitutions:`, replace the default entity IDs with your own:
   - **Tab 0 (6 Touch Control Cards):** `ctrl_1_entity` through `ctrl_6_entity` and their display labels (`ctrl_1_name` through `ctrl_6_name`).
   - **Tab 1 (Weather):** `weather_entity` (e.g., `weather.forecast_home`).
   - **Tab 2 (Indoor Climate & HVAC):** `room1_temp_entity` through `room4_temp_entity`, `room1_hum_entity` through `room4_hum_entity`, `indoor_co2_entity`, `indoor_aqi_entity`, and `hvac_entity` (your `climate.*` thermostat).
   - **Units & Clock Format:** Set `use_imperial: "true"` (`°F`, `mph`) or `"false"` (`°C`, `km/h`), and `use_12h_clock: "true"` or `"false"`.
3. Click **Save** in the top-right corner of the ESPHome editor.

### Step 5.3: How to Install Wireless (OTA) Firmware Updates When Running on LiPo Battery

When the LilyGo T5 `[H716]` is running on its 1S LiPo battery in **Adaptive Hybrid** or **Max Battery (Deep Sleep)** mode, the ESP32-S3 turns off its Wi-Fi radio while sleeping to conserve battery. If you click **Install -> Wirelessly** while the board is asleep, ESPHome won't be able to reach it until it wakes up.

Here is the foolproof 3-step routine for wireless OTA updates on battery:
1. **Turn on the "Stay Awake for OTA" switch in Home Assistant:**
   - Toggle ON **`input_boolean.lilygo_t5_stay_awake_ota`** (*"LilyGo T5 Stay Awake for OTA Update"*).
2. **Wake the screen with one finger tap (if it is currently in Deep Sleep):**
   - Tap anywhere on the LilyGo T5 glass touchscreen. The GT911 touch controller triggers hardware interrupt pin `GPIO16`, waking the ESP32-S3 in `< 1.5 seconds`.
   - As soon as it connects to Home Assistant, it sees `input_boolean.lilygo_t5_stay_awake_ota` is `ON` and **locks itself awake on Wi-Fi** (displaying an `OTA READY` badge).
3. **Click Install -> Wirelessly in ESPHome:**
   - In the ESPHome dashboard, click the three dots (`⋮`) on `lilygo-t5-h716-dashboard` $\rightarrow$ **Install** $\rightarrow$ **Wirelessly**.
   - Once the update completes and the screen reboots, toggle **`input_boolean.lilygo_t5_stay_awake_ota`** back **OFF** (or let the built-in Home Assistant safety automation turn it off automatically after 2 hours).

---

## Part 6: Beginner Troubleshooting & Quick FAQ

| Symptom | Cause & Easy Fix |
| :--- | :--- |
| **Screen updates when entities change in HA, but tapping cards on the screen doesn't toggle lights/HVAC.** | You missed **Step 4.2**! Go to *Settings $\rightarrow$ Devices & Services $\rightarrow$ ESPHome $\rightarrow$ Configure* on the LilyGo T5 and check **"Allow the device to perform Home Assistant actions"**. |
| **5-Day Weather Forecast on Tab 1 shows placeholder data (`Mon 74°/56°`) instead of live weather.** | Open `/config/packages/lilygo_t5_dashboard.yaml` and verify `weather.forecast_home` matches your actual weather integration entity ID in Home Assistant (*Settings $\rightarrow$ Devices & Services $\rightarrow$ Entities*). |
| **Serial port does not show up in `web.esphome.io` when plugged into USB-C.** | 1. Make sure you are using **Chrome** or **Edge** (not Firefox/Safari).<br>2. Swap to a known **data-capable USB-C cable**.<br>3. Put the board into Bootloader mode: **Hold `BOOT`, press and release `RST`, then release `BOOT`**. |
| **E-Paper screen shows faint ghosting after many quick button taps.** | Tap the **`[REFRESH]`** button in the top-right header (`x: 740..845, y: 0..56`) at any time to run a full black-white-clear waveform cycle, or let the automatic every-15th-update clean cycle handle it. |
| **Battery percentage reads `100%` whenever USB-C is plugged in.** | Normal behavior! When a 5V USB-C cable is plugged in, the onboard charger pushes the battery rail to `4.20V–4.26V`. Unplug USB-C and wait 2 minutes for the open-circuit 1S LiPo voltage (`3.30V–4.20V`) to settle on `GPIO14`. |
