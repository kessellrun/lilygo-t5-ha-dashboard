(() => {
  "use strict";

  const WIDTH = 960;
  const HEIGHT = 540;

  // 16-level ED047TC1 grayscale palette (warm matte paper to deep ink)
  const PALETTE = {
    paper: "#eeede7",     // Level 15 (white paper)
    g14: "#e2e1da",       // Subtle fill
    g13: "#d4d3cc",       // Card tint
    g12: "#c4c3bc",       // Light border / track
    g10: "#a6a59e",       // Muted grid / disabled
    g08: "#85847e",       // Secondary text / bars
    g06: "#63625d",       // Subheadings
    g04: "#42413e",       // Strong accent gray
    g02: "#262523",       // Dark fill
    ink: "#141412"        // Level 0 (deepest ink)
  };

  // Exact 11-point piecewise linear 1S LiPo voltage -> SoC lookup matching firmware
  const LIPO_CURVE = [
    [4.20, 100],
    [4.06, 90],
    [3.98, 80],
    [3.92, 70],
    [3.87, 60],
    [3.82, 50],
    [3.79, 40],
    [3.75, 30],
    [3.70, 20],
    [3.61, 10],
    [3.30, 0]
  ];

  const POWER_MODES = [
    { id: 0, label: "ALWAYS ONLINE", haName: "Always Online (Modem Sleep)", estHoursAt100: 22 },
    { id: 1, label: "ADAPTIVE HYBRID", haName: "Adaptive Hybrid (Recommended)", estHoursAt100: 144 },
    { id: 2, label: "MAX BATTERY", haName: "Max Battery (Deep Sleep + Touch Wake)", estHoursAt100: 720 }
  ];

  const WEATHER_PRESETS = [
    {
      condition: "partlycloudy",
      label: "Partly Cloudy",
      tempF: 72,
      feelsF: 74,
      humidity: 48,
      windMph: 8,
      uv: 5,
      pressureHpa: 1016,
      sunrise: "6:38 AM",
      sunset: "5:49 PM",
      forecastCsv: "Sat|partlycloudy|74|56;Sun|sunny|78|58;Mon|rainy|65|52;Tue|cloudy|67|51;Wed|sunny|75|55"
    },
    {
      condition: "sunny",
      label: "Clear & Sunny",
      tempF: 79,
      feelsF: 80,
      humidity: 36,
      windMph: 5,
      uv: 7,
      pressureHpa: 1021,
      sunrise: "6:37 AM",
      sunset: "5:50 PM",
      forecastCsv: "Sat|sunny|81|59;Sun|sunny|83|60;Mon|partlycloudy|77|57;Tue|partlycloudy|74|55;Wed|sunny|79|58"
    },
    {
      condition: "rainy",
      label: "Light Rain",
      tempF: 59,
      feelsF: 57,
      humidity: 86,
      windMph: 14,
      uv: 2,
      pressureHpa: 1004,
      sunrise: "6:39 AM",
      sunset: "5:48 PM",
      forecastCsv: "Sat|rainy|61|50;Sun|cloudy|63|49;Mon|partlycloudy|68|52;Tue|sunny|72|54;Wed|sunny|75|56"
    },
    {
      condition: "lightning-rainy",
      label: "Thunderstorm",
      tempF: 64,
      feelsF: 65,
      humidity: 91,
      windMph: 22,
      uv: 1,
      pressureHpa: 997,
      sunrise: "6:40 AM",
      sunset: "5:47 PM",
      forecastCsv: "Sat|lightning-rainy|66|54;Sun|rainy|62|51;Mon|cloudy|65|50;Tue|partlycloudy|71|53;Wed|sunny|76|56"
    },
    {
      condition: "snowy",
      label: "Snow Showers",
      tempF: 30,
      feelsF: 22,
      humidity: 78,
      windMph: 12,
      uv: 1,
      pressureHpa: 1008,
      sunrise: "7:12 AM",
      sunset: "4:52 PM",
      forecastCsv: "Sat|snowy|32|21;Sun|cloudy|35|24;Mon|partlycloudy|38|26;Tue|sunny|41|28;Wed|snowy|33|22"
    }
  ];

  // Application & Hardware State
  const state = {
    activeTab: 0,
    powerModeIndex: 1, // Default: ADAPTIVE HYBRID
    lipoVoltage: 4.01,
    usbCharging: false,
    stayAwakeOta: false,
    isSleeping: false,
    isCriticalHibernate: false,
    useMetric: false,
    showHitboxes: false,
    partialRefreshCount: 0,
    fullRefreshCount: 1,
    maxPartialBeforeClean: 10,
    wakeCause: "GPIO16 Touch Interrupt",
    wifiRssi: -58,
    uptimeSeconds: 1842,
    weatherIndex: 0,
    cursor: { x: null, y: null },
    hoveredHitbox: null,
    lastStatusMessage: "HA Connected • All entities synced",
    sceneFlashUntil: 0,
    flashOverlay: null, // { mode: 'full'|'partial', region, phase }

    controls: [
      { id: "ctrl_1", name: "Living Room Lights", entity: "light.living_room_lights", kind: "light", active: true, detail: "80% Warm White" },
      { id: "ctrl_2", name: "Kitchen Pendant", entity: "light.kitchen_pendant", kind: "pendant", active: false, detail: "Off" },
      { id: "ctrl_3", name: "Office Desk Switch", entity: "switch.office_desk", kind: "plug", active: true, detail: "42W Active" },
      { id: "ctrl_4", name: "Front Door Lock", entity: "lock.front_door", kind: "lock", active: true, detail: "Locked • Deadbolt" },
      { id: "ctrl_5", name: "Garage Door Cover", entity: "cover.garage_door", kind: "garage", active: false, detail: "Closed" },
      { id: "ctrl_6", name: "Goodnight Scene", entity: "scene.goodnight", kind: "scene", active: false, detail: "Lights Off + Lock" }
    ],

    rooms: [
      { name: "Living Room", tempF: 71.4, hum: 46 },
      { name: "Primary Bedroom", tempF: 68.2, hum: 48 },
      { name: "Home Office", tempF: 73.6, hum: 44 },
      { name: "Kitchen / Nursery", tempF: 70.1, hum: 51 }
    ],

    hvac: {
      modes: ["HEAT", "COOL", "AUTO", "OFF"],
      modeIndex: 2,
      currentTempF: 71,
      targetTempF: 70,
      co2Ppm: 540,
      aqi: 24
    }
  };

  // DOM References
  const epdCanvas = document.getElementById("epd-canvas");
  const ctx = epdCanvas.getContext("2d");
  const overlayCanvas = document.getElementById("overlay-canvas");
  const octx = overlayCanvas.getContext("2d");

  const cursorCoordsEl = document.getElementById("cursor-coords");
  const hoveredHitboxEl = document.getElementById("hovered-hitbox");
  const headerPowerStateEl = document.getElementById("header-power-state");
  const sleepBannerEl = document.getElementById("sleep-banner");
  const ledChargeEl = document.getElementById("led-charge");
  const ledActiveEl = document.getElementById("led-active");
  const usbcSlotEl = document.getElementById("usbc-slot");

  const lipoSliderEl = document.getElementById("lipo-voltage-slider");
  const lipoBadgeEl = document.getElementById("lipo-badge");
  const refreshCounterBadgeEl = document.getElementById("refresh-counter-badge");
  const toggleChargingEl = document.getElementById("toggle-charging");
  const toggleOtaAwakeEl = document.getElementById("toggle-ota-awake");
  const toggleMetricEl = document.getElementById("toggle-metric");
  const unitsLabelEl = document.getElementById("units-label");
  const toggleHitboxesEl = document.getElementById("toggle-hitboxes");
  const apiConsoleEl = document.getElementById("api-console");

  // ---------------------------------------------------------------------------
  // Battery & Unit Conversion Helpers
  // ---------------------------------------------------------------------------
  function computeLipoSoc(voltage) {
    if (voltage >= LIPO_CURVE[0][0]) return 100;
    const last = LIPO_CURVE[LIPO_CURVE.length - 1];
    if (voltage <= last[0]) return 0;
    for (let i = 0; i < LIPO_CURVE.length - 1; i++) {
      const [vHi, sHi] = LIPO_CURVE[i];
      const [vLo, sLo] = LIPO_CURVE[i + 1];
      if (voltage <= vHi && voltage >= vLo) {
        const ratio = (voltage - vLo) / (vHi - vLo);
        return Math.round(sLo + ratio * (sHi - sLo));
      }
    }
    return 0;
  }

  function isChargingActive() {
    return state.usbCharging || state.lipoVoltage > 4.22;
  }

  function formatTemp(tempF, decimals = 0) {
    if (state.useMetric) {
      const c = (tempF - 32) * (5 / 9);
      return `${c.toFixed(decimals)}°C`;
    }
    return `${tempF.toFixed(decimals)}°F`;
  }

  function formatTempNum(tempF, decimals = 0) {
    const val = state.useMetric ? (tempF - 32) * (5 / 9) : tempF;
    return val.toFixed(decimals);
  }

  function formatSpeed(mph) {
    if (state.useMetric) {
      return `${Math.round(mph * 1.60934)} km/h`;
    }
    return `${Math.round(mph)} mph`;
  }

  function formatPressure(hpa) {
    if (state.useMetric) {
      return `${hpa} hPa`;
    }
    return `${(hpa * 0.02953).toFixed(2)} inHg`;
  }

  function formatClock(dateObj) {
    let hours = dateObj.getHours();
    const mins = String(dateObj.getMinutes()).padStart(2, "0");
    if (state.useMetric) {
      return `${String(hours).padStart(2, "0")}:${mins}`;
    }
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
  }

  function formatClockSimple(str12h) {
    if (!state.useMetric) return str12h;
    const match = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(str12h);
    if (!match) return str12h;
    let h = parseInt(match[1], 10);
    const m = match[2];
    const p = match[3].toUpperCase();
    if (p === "PM" && h !== 12) h += 12;
    if (p === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  function formatDurationHours(hoursFloat) {
    if (hoursFloat < 1) return `${Math.max(0, Math.round(hoursFloat * 60))}m`;
    if (hoursFloat < 48) return `${hoursFloat.toFixed(1)} hrs`;
    return `${(hoursFloat / 24).toFixed(1)} days`;
  }

  function getRoomComfort(tempF, hum) {
    if (hum > 62) return "HUMID";
    if (hum < 30) return "DRY";
    if (tempF > 76) return "WARM";
    if (tempF < 65) return "COOL";
    return "COMFORT";
  }

  // ---------------------------------------------------------------------------
  // Logging Console
  // ---------------------------------------------------------------------------
  function logEvent(category, tag, message) {
    const now = new Date();
    const ts = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join(":");

    const line = document.createElement("div");
    line.className = `log-line log-${category}`;

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `[${ts}]`;

    const tagSpan = document.createElement("span");
    tagSpan.className = "log-tag";
    tagSpan.textContent = `[${tag}]`;

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;

    line.appendChild(timeSpan);
    line.appendChild(tagSpan);
    line.appendChild(msgSpan);
    apiConsoleEl.appendChild(line);

    while (apiConsoleEl.children.length > 120) {
      apiConsoleEl.removeChild(apiConsoleEl.firstChild);
    }
    apiConsoleEl.scrollTop = apiConsoleEl.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // Hitbox Registry (Exact Firmware 960x540 Coordinates)
  // ---------------------------------------------------------------------------
  function getActiveHitboxes() {
    const boxes = [
      // Header Quick Buttons (y: 8..48)
      { id: "hdr_refresh", label: "REFRESH", x1: 740, y1: 8, x2: 845, y2: 48, action: () => triggerFullCleanRefresh("Manual [REFRESH]") },
      {
        id: "hdr_sleep_mode",
        label: "SLEEP / MODE",
        x1: 846,
        y1: 8,
        x2: 950,
        y2: 48,
        action: (ev) => {
          if (ev && ev.shiftKey) {
            enterDeepSleep("Header Shift+Click");
          } else {
            cyclePowerMode();
          }
        }
      },

      // Bottom 4-Tab Navigation Bar (y: 476..540)
      { id: "tab_0_controls", label: "TAB 0: CONTROLS", x1: 0, y1: 476, x2: 239, y2: 540, action: () => switchTab(0) },
      { id: "tab_1_weather", label: "TAB 1: WEATHER", x1: 240, y1: 476, x2: 479, y2: 540, action: () => switchTab(1) },
      { id: "tab_2_climate", label: "TAB 2: CLIMATE", x1: 480, y1: 476, x2: 719, y2: 540, action: () => switchTab(2) },
      { id: "tab_3_power", label: "TAB 3: LIPO & POWER", x1: 720, y1: 476, x2: 959, y2: 540, action: () => switchTab(3) }
    ];

    if (state.isCriticalHibernate || state.isSleeping) {
      return boxes;
    }

    if (state.activeTab === 0) {
      // 2x3 Grid of Smart Home Controls
      const cols = [
        [20, 310],
        [335, 625],
        [650, 940]
      ];
      const rows = [
        [75, 245],
        [265, 435]
      ];
      state.controls.forEach((ctrl, idx) => {
        const col = cols[idx % 3];
        const row = rows[Math.floor(idx / 3)];
        boxes.push({
          id: ctrl.id,
          label: ctrl.name,
          x1: col[0],
          y1: row[0],
          x2: col[1],
          y2: row[1],
          action: () => toggleControlCard(idx, col[0], row[0], col[1] - col[0], row[1] - row[0])
        });
      });
    } else if (state.activeTab === 1) {
      boxes.push({
        id: "weather_hero",
        label: "WEATHER HERO (CYCLE)",
        x1: 20,
        y1: 75,
        x2: 420,
        y2: 455,
        action: () => cycleWeatherPreset()
      });
    } else if (state.activeTab === 2) {
      boxes.push(
        {
          id: "hvac_mode_pill",
          label: "HVAC MODE",
          x1: 625,
          y1: 92,
          x2: 915,
          y2: 132,
          action: () => cycleHvacMode()
        },
        {
          id: "hvac_temp_down",
          label: "HVAC [-]",
          x1: 625,
          y1: 295,
          x2: 710,
          y2: 355,
          action: () => adjustHvacTarget(-1)
        },
        {
          id: "hvac_temp_up",
          label: "HVAC [+]",
          x1: 830,
          y1: 295,
          x2: 915,
          y2: 355,
          action: () => adjustHvacTarget(1)
        }
      );
    } else if (state.activeTab === 3) {
      // Grid Row 2 mapped to Power Modes + Sleep Now
      boxes.push(
        {
          id: "pwr_mode_0",
          label: "ALWAYS ONLINE",
          x1: 20,
          y1: 265,
          x2: 310,
          y2: 435,
          action: () => setPowerMode(0, { x: 20, y: 265, w: 290, h: 170 })
        },
        {
          id: "pwr_mode_1",
          label: "ADAPTIVE HYBRID",
          x1: 335,
          y1: 265,
          x2: 625,
          y2: 435,
          action: () => setPowerMode(1, { x: 335, y: 265, w: 290, h: 170 })
        },
        {
          id: "pwr_mode_2_sleep",
          label: "MAX BATTERY / SLEEP",
          x1: 650,
          y1: 265,
          x2: 940,
          y2: 435,
          action: () => {
            if (state.powerModeIndex === 2) {
              enterDeepSleep("Tab 3 [SLEEP NOW] button");
            } else {
              setPowerMode(2, { x: 650, y: 265, w: 290, h: 170 });
            }
          }
        }
      );
    }

    return boxes;
  }

  function findHitboxAt(x, y) {
    const boxes = getActiveHitboxes();
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2) {
        return b;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // State Transitions & E-Paper Refresh Animations
  // ---------------------------------------------------------------------------
  function triggerPartialRefresh(region, reason) {
    state.partialRefreshCount += 1;
    if (state.partialRefreshCount >= state.maxPartialBeforeClean) {
      logEvent("epd", "EPD", `Partial counter reached ${state.maxPartialBeforeClean}; auto-triggering full clean refresh`);
      triggerFullCleanRefresh("Auto anti-ghosting clean");
      return;
    }

    logEvent("epd", "EPD", `Partial refresh #${state.partialRefreshCount}/${state.maxPartialBeforeClean} (${reason})`);
    state.flashOverlay = {
      mode: "partial",
      region: region || { x: 0, y: 57, w: WIDTH, h: 418 },
      phase: 1
    };
    renderAll();

    setTimeout(() => {
      state.flashOverlay = null;
      renderAll();
    }, 110);
  }

  function triggerFullCleanRefresh(reason) {
    state.partialRefreshCount = 0;
    state.fullRefreshCount += 1;
    state.lastStatusMessage = `Full e-ink clean complete (${reason})`;
    logEvent("epd", "EPD", `Full black-white-clear flash refresh #${state.fullRefreshCount} (${reason}) — ghosting counter reset to 0`);

    state.flashOverlay = { mode: "full", phase: "black" };
    renderAll();

    setTimeout(() => {
      state.flashOverlay = { mode: "full", phase: "white" };
      renderAll();
    }, 130);

    setTimeout(() => {
      state.flashOverlay = null;
      renderAll();
    }, 260);
  }

  function switchTab(tabIndex) {
    if (state.activeTab === tabIndex) return;
    state.activeTab = tabIndex;
    const tabNames = ["CONTROLS", "WEATHER", "CLIMATE", "LIPO & POWER"];
    state.lastStatusMessage = `Switched to Tab ${tabIndex}: ${tabNames[tabIndex]}`;
    logEvent("epd", "UI", `global active_tab = ${tabIndex} (${tabNames[tabIndex]})`);
    triggerPartialRefresh({ x: 0, y: 57, w: WIDTH, h: 483 }, `Tab -> ${tabNames[tabIndex]}`);
  }

  function toggleControlCard(idx, x, y, w, h) {
    const ctrl = state.controls[idx];
    if (ctrl.kind === "scene") {
      ctrl.active = true;
      state.sceneFlashUntil = Date.now() + 2500;
      state.controls[0].active = false;
      state.controls[0].detail = "Off";
      state.controls[1].active = false;
      state.controls[1].detail = "Off";
      state.controls[2].active = false;
      state.controls[2].detail = "Standby";
      state.controls[3].active = true;
      state.controls[3].detail = "Locked • Deadbolt";
      state.lastStatusMessage = "Activated scene.goodnight";
      logEvent("ha", "ESPHOME -> HA", `homeassistant.service: scene.turn_on { entity_id: "${ctrl.entity}" }`);
      logEvent("ha", "HA -> ESPHOME", `Goodnight applied: lights OFF, desk OFF, front door LOCKED`);
      triggerPartialRefresh({ x: 20, y: 75, w: 920, h: 365 }, "scene.goodnight");
      setTimeout(() => {
        ctrl.active = false;
        renderAll();
      }, 2500);
      return;
    }

    ctrl.active = !ctrl.active;
    let service = "homeassistant.toggle";
    if (ctrl.kind === "light" || ctrl.kind === "pendant") {
      service = "light.toggle";
      ctrl.detail = ctrl.active ? (ctrl.kind === "light" ? "80% Warm White" : "100% Bright") : "Off";
    } else if (ctrl.kind === "plug") {
      service = "switch.toggle";
      ctrl.detail = ctrl.active ? "42W Active" : "Standby";
    } else if (ctrl.kind === "lock") {
      service = ctrl.active ? "lock.lock" : "lock.unlock";
      ctrl.detail = ctrl.active ? "Locked • Deadbolt" : "Unlocked!";
    } else if (ctrl.kind === "garage") {
      service = ctrl.active ? "cover.open_cover" : "cover.close_cover";
      ctrl.detail = ctrl.active ? "OPEN" : "Closed";
    }

    const stateLabel = ctrl.kind === "lock"
      ? (ctrl.active ? "LOCKED" : "UNLOCKED")
      : ctrl.kind === "garage"
        ? (ctrl.active ? "OPEN" : "CLOSED")
        : (ctrl.active ? "ON" : "OFF");

    state.lastStatusMessage = `${service} (${ctrl.entity}) -> ${stateLabel}`;
    logEvent("ha", "ESPHOME -> HA", `homeassistant.service: ${service} { entity_id: "${ctrl.entity}" }`);
    logEvent("ha", "HA -> ESPHOME", `state_changed: ${ctrl.entity} = ${stateLabel}`);
    triggerPartialRefresh({ x, y, w, h }, ctrl.entity);
  }

  function cycleWeatherPreset() {
    state.weatherIndex = (state.weatherIndex + 1) % WEATHER_PRESETS.length;
    const w = WEATHER_PRESETS[state.weatherIndex];
    logEvent("ha", "HA -> ESPHOME", `weather.forecast_home updated: ${w.condition} (${formatTemp(w.tempF)})`);
    triggerPartialRefresh({ x: 20, y: 75, w: 920, h: 380 }, `Weather -> ${w.label}`);
  }

  function cycleHvacMode() {
    state.hvac.modeIndex = (state.hvac.modeIndex + 1) % state.hvac.modes.length;
    const mode = state.hvac.modes[state.hvac.modeIndex];
    logEvent("ha", "ESPHOME -> HA", `homeassistant.service: climate.set_hvac_mode { entity_id: "climate.main_thermostat", hvac_mode: "${mode.toLowerCase()}" }`);
    triggerPartialRefresh({ x: 600, y: 75, w: 340, h: 380 }, `HVAC Mode -> ${mode}`);
  }

  function adjustHvacTarget(delta) {
    state.hvac.targetTempF = Math.max(58, Math.min(82, state.hvac.targetTempF + delta));
    const displayTarget = formatTemp(state.hvac.targetTempF);
    logEvent("ha", "ESPHOME -> HA", `homeassistant.service: climate.set_temperature { entity_id: "climate.main_thermostat", temperature: ${formatTempNum(state.hvac.targetTempF)} }`);
    logEvent("ha", "HA -> ESPHOME", `climate.main_thermostat target_temp = ${displayTarget}`);
    triggerPartialRefresh({ x: 600, y: 140, w: 340, h: 230 }, `HVAC Setpoint ${displayTarget}`);
  }

  function setPowerMode(index, region) {
    state.powerModeIndex = index;
    const mode = POWER_MODES[index];
    state.lastStatusMessage = `Power Mode: ${mode.label}`;
    logEvent("power", "POWER", `global power_mode_index = ${index} (${mode.haName})`);
    logEvent("ha", "ESPHOME -> HA", `select.lilygo_t5_power_profile -> "${mode.haName}"`);
    triggerPartialRefresh(region || { x: 315, y: 0, w: 240, h: 56 }, `Mode -> ${mode.label}`);
  }

  function cyclePowerMode() {
    const next = (state.powerModeIndex + 1) % POWER_MODES.length;
    setPowerMode(next, { x: 315, y: 0, w: 240, h: 56 });
  }

  function enterDeepSleep(source) {
    if (state.stayAwakeOta) {
      logEvent("power", "POWER", `Deep Sleep blocked (${source}): input_boolean.lilygo_t5_stay_awake_ota is ON`);
      state.lastStatusMessage = "Sleep blocked: OTA Stay-Awake ON";
      renderAll();
      return;
    }
    state.isSleeping = true;
    logEvent("power", "DEEP SLEEP", `Entered Touch-Armed Deep Sleep via ${source}. Wi-Fi OFF, GPIO16 EXT0 armed, PCF8563 RTC 15m timer armed (~0.2 mA).`);
    syncExternalControls();
    renderAll();
  }

  function wakeFromDeepSleep(cause) {
    if (!state.isSleeping) {
      state.wakeCause = cause;
      logEvent("power", "WAKE", `Simulated Wakeup Cause set to: ${cause}`);
      triggerPartialRefresh({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, cause);
      return;
    }
    state.isSleeping = false;
    state.wakeCause = cause;
    logEvent("power", "WAKE", `Woke from Deep Sleep! Cause: ${cause}. Wi-Fi fast_connect (-58 dBm) -> HA API reconnected.`);
    syncExternalControls();
    triggerPartialRefresh({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, `Wake: ${cause}`);
  }

  function evaluateBatteryThresholds(prevVoltage) {
    const v = state.lipoVoltage;
    const soc = computeLipoSoc(v);
    const wasCrit = state.isCriticalHibernate;
    state.isCriticalHibernate = v < 3.32;

    if (state.isCriticalHibernate && !wasCrit) {
      state.isSleeping = false;
      logEvent("crit", "CRITICAL", `ADC GPIO14 = ${v.toFixed(2)}V (< 3.32V)! Entering Critical LiPo Hibernation to prevent over-discharge.`);
      logEvent("ha", "HA ALERT", `Automation triggered: Critical Battery Hibernate Alert (${v.toFixed(2)}V / ${soc}%)`);
    } else if (!state.isCriticalHibernate && wasCrit) {
      logEvent("power", "RECOVER", `LiPo recovered to ${v.toFixed(2)}V (${soc}%). Exiting Critical Hibernate.`);
      triggerFullCleanRefresh("Critical Hibernate Recovery");
    } else if (v < 3.45 && prevVoltage >= 3.45) {
      logEvent("power", "WARN", `LiPo Low Warning (${v.toFixed(2)}V / ${soc}% < 3.45V).`);
    } else if (soc < 35 && computeLipoSoc(prevVoltage) >= 35 && state.powerModeIndex === 1) {
      logEvent("power", "HYBRID", `SoC dropped below 35% (${soc}%) in Adaptive Hybrid mode — switching to periodic Deep Sleep cadence.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas Drawing Primitives (Crisp 16-Level E-Paper Graphics)
  // ---------------------------------------------------------------------------
  function roundRectPath(c, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.quadraticCurveTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius);
    c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  function fillRoundRect(c, x, y, w, h, r, fill, stroke, lineWidth = 1.5) {
    roundRectPath(c, x, y, w, h, r);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.lineWidth = lineWidth;
      c.strokeStyle = stroke;
      c.stroke();
    }
  }

  function drawWifiBars(c, x, y, rssi, color) {
    const bars = rssi > -55 ? 4 : rssi > -68 ? 3 : rssi > -80 ? 2 : 1;
    for (let i = 0; i < 4; i++) {
      const bh = 5 + i * 4;
      c.fillStyle = i < bars ? color : PALETTE.g12;
      c.fillRect(x + i * 5, y + (17 - bh), 3.5, bh);
    }
  }

  function drawBatteryIcon(c, x, y, soc, charging, color) {
    // Outer body
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.strokeRect(x, y, 32, 16);
    // Positive terminal nub
    c.fillStyle = color;
    c.fillRect(x + 32, y + 4, 3, 8);
    // Fill level
    const fillW = Math.max(0, Math.round((26 * soc) / 100));
    if (fillW > 0) {
      c.fillStyle = soc <= 15 ? PALETTE.g04 : color;
      c.fillRect(x + 3, y + 3, fillW, 10);
    }
    // Charging bolt next to icon
    if (charging) {
      c.beginPath();
      c.moveTo(x - 8, y + 1);
      c.lineTo(x - 14, y + 9);
      c.lineTo(x - 9, y + 9);
      c.lineTo(x - 11, y + 16);
      c.lineTo(x - 4, y + 7);
      c.lineTo(x - 9, y + 7);
      c.closePath();
      c.fillStyle = color;
      c.fill();
    }
  }

  function drawControlIcon(c, kind, cx, cy, active, fg) {
    c.save();
    c.strokeStyle = fg;
    c.fillStyle = fg;
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";

    if (kind === "light") {
      c.beginPath();
      c.arc(cx, cy - 4, 12, Math.PI * 0.78, Math.PI * 2.22);
      c.lineTo(cx + 6, cy + 11);
      c.lineTo(cx - 6, cy + 11);
      c.closePath();
      if (active) c.fill();
      c.stroke();
      c.fillRect(cx - 5, cy + 13, 10, 4);
      if (active) {
        for (let a = 0; a < 5; a++) {
          const ang = -Math.PI + (a * Math.PI) / 4;
          c.beginPath();
          c.moveTo(cx + Math.cos(ang) * 16, cy - 4 + Math.sin(ang) * 16);
          c.lineTo(cx + Math.cos(ang) * 20, cy - 4 + Math.sin(ang) * 20);
          c.stroke();
        }
      }
    } else if (kind === "pendant") {
      c.beginPath();
      c.moveTo(cx, cy - 18);
      c.lineTo(cx, cy - 8);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - 16, cy + 8);
      c.quadraticCurveTo(cx, cy - 12, cx + 16, cy + 8);
      c.closePath();
      if (active) c.fill();
      c.stroke();
      c.beginPath();
      c.arc(cx, cy + 11, 4, 0, Math.PI);
      c.stroke();
    } else if (kind === "plug") {
      c.strokeRect(cx - 12, cy - 12, 24, 24);
      c.beginPath();
      c.moveTo(cx - 5, cy - 6);
      c.lineTo(cx - 5, cy);
      c.moveTo(cx + 5, cy - 6);
      c.lineTo(cx + 5, cy);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy + 6, 2.5, 0, Math.PI * 2);
      c.fill();
    } else if (kind === "lock") {
      c.beginPath();
      if (active) {
        c.arc(cx, cy - 6, 8, Math.PI, 0);
      } else {
        c.arc(cx - 3, cy - 9, 8, Math.PI, 0);
      }
      c.stroke();
      roundRectPath(c, cx - 12, cy - 3, 24, 19, 3);
      if (active) c.fill();
      c.stroke();
    } else if (kind === "garage") {
      c.beginPath();
      c.moveTo(cx - 17, cy - 3);
      c.lineTo(cx, cy - 16);
      c.lineTo(cx + 17, cy - 3);
      c.lineTo(cx + 17, cy + 15);
      c.lineTo(cx - 17, cy + 15);
      c.closePath();
      c.stroke();
      if (!active) {
        // Closed horizontal slats
        for (let row = 0; row < 3; row++) {
          c.fillRect(cx - 10, cy + 1 + row * 5, 20, 2.5);
        }
      } else {
        // Open arrow
        c.beginPath();
        c.moveTo(cx, cy + 12);
        c.lineTo(cx, cy);
        c.moveTo(cx - 5, cy + 5);
        c.lineTo(cx, cy);
        c.lineTo(cx + 5, cy + 5);
        c.stroke();
      }
    } else if (kind === "scene") {
      // Crescent moon + star
      c.beginPath();
      c.arc(cx - 2, cy, 13, Math.PI * 0.3, Math.PI * 1.75);
      c.quadraticCurveTo(cx + 4, cy, cx - 2 + Math.cos(Math.PI * 0.3) * 13, cy + Math.sin(Math.PI * 0.3) * 13);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(cx + 12, cy - 10, 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function drawWeatherIcon(c, cond, cx, cy, scale = 1, fg = PALETTE.ink) {
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    c.strokeStyle = fg;
    c.fillStyle = fg;
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";

    const drawSun = (sx, sy, r) => {
      c.beginPath();
      c.arc(sx, sy, r, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(sx + Math.cos(a) * (r + 4), sy + Math.sin(a) * (r + 4));
        c.lineTo(sx + Math.cos(a) * (r + 8), sy + Math.sin(a) * (r + 8));
        c.stroke();
      }
    };

    const drawCloud = (ox, oy, fillCloud = false) => {
      c.beginPath();
      c.moveTo(ox - 16, oy + 8);
      c.arc(ox - 10, oy + 2, 7, Math.PI * 0.5, Math.PI * 1.6);
      c.arc(ox, oy - 3, 9, Math.PI * 1.1, Math.PI * 1.95);
      c.arc(ox + 11, oy + 2, 6, Math.PI * 1.5, Math.PI * 0.5);
      c.closePath();
      if (fillCloud) {
        c.fillStyle = PALETTE.paper;
        c.fill();
      }
      c.strokeStyle = fg;
      c.stroke();
    };

    if (cond === "sunny") {
      drawSun(0, 0, 10);
    } else if (cond === "partlycloudy") {
      drawSun(-8, -7, 7);
      drawCloud(4, 5, true);
    } else if (cond === "cloudy") {
      drawCloud(0, 2, true);
    } else if (cond === "rainy") {
      drawCloud(0, -3, true);
      for (let dx of [-9, 0, 9]) {
        c.beginPath();
        c.moveTo(dx, 9);
        c.lineTo(dx - 3, 16);
        c.stroke();
      }
    } else if (cond === "lightning-rainy") {
      drawCloud(0, -4, true);
      c.beginPath();
      c.moveTo(1, 7);
      c.lineTo(-4, 14);
      c.lineTo(2, 14);
      c.lineTo(-2, 21);
      c.stroke();
      c.beginPath();
      c.moveTo(-11, 9);
      c.lineTo(-13, 15);
      c.moveTo(11, 9);
      c.lineTo(9, 15);
      c.stroke();
    } else if (cond === "snowy") {
      drawCloud(0, -4, true);
      for (let dx of [-9, 0, 9]) {
        c.beginPath();
        c.arc(dx, 13, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Main 960x540 Frame Renderers
  // ---------------------------------------------------------------------------
  function renderHeader() {
    // Background bar (y: 0..56)
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, WIDTH, 56);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(WIDTH, 56);
    ctx.stroke();

    // Left (x: 16..310): Time & Date
    const now = new Date();
    const timeStr = formatClock(now);
    const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 22px 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(timeStr, 16, 28);
    const timeW = ctx.measureText(timeStr).width;
    ctx.fillStyle = PALETTE.g06;
    ctx.font = "500 15px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`•  ${dateStr}`, 24 + timeW, 29);

    // Center (x: 315..555): Wi-Fi RSSI bars + Active Power Mode pill
    drawWifiBars(ctx, 322, 19, state.wifiRssi, state.isSleeping ? PALETTE.g10 : PALETTE.ink);
    const modeLabel = POWER_MODES[state.powerModeIndex].label;
    fillRoundRect(ctx, 352, 12, 196, 32, 16, PALETTE.g14, PALETTE.ink, 1.5);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 12.5px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(modeLabel, 450, 28);

    // Right Battery Gauge (x: 560..735): 1S LiPo icon + SoC% + Voltage
    const soc = computeLipoSoc(state.lipoVoltage);
    const charging = isChargingActive();
    drawBatteryIcon(ctx, 578, 20, soc, charging, PALETTE.ink);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 15px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${soc}% • ${state.lipoVoltage.toFixed(2)}V`, 620, 29);

    // Header Quick Buttons (y: 8..48)
    // [REFRESH] x: 740..845, y: 8..48
    fillRoundRect(ctx, 740, 8, 105, 40, 8, PALETTE.paper, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("REFRESH", 792.5, 28);

    // [SLEEP / MODE] x: 846..950, y: 8..48
    fillRoundRect(ctx, 848, 8, 102, 40, 8, PALETTE.ink, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(state.isSleeping ? "SLEEPING" : "MODE", 899, 28);
  }

  function renderBottomTabs() {
    // Bottom Bar y: 476..540
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 476, WIDTH, 64);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 476);
    ctx.lineTo(WIDTH, 476);
    ctx.stroke();

    const tabs = [
      { label: "CONTROLS", x1: 0, x2: 239 },
      { label: "WEATHER", x1: 240, x2: 479 },
      { label: "CLIMATE", x1: 480, x2: 719 },
      { label: "LIPO & POWER", x1: 720, x2: 959 }
    ];

    tabs.forEach((tab, idx) => {
      const w = tab.x2 - tab.x1 + 1;
      const isSelected = state.activeTab === idx;
      if (isSelected) {
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(tab.x1, 476, w, 64);
      } else if (idx > 0) {
        ctx.strokeStyle = PALETTE.g12;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tab.x1, 482);
        ctx.lineTo(tab.x1, 534);
        ctx.stroke();
      }
      ctx.fillStyle = isSelected ? PALETTE.paper : PALETTE.ink;
      ctx.font = "700 16px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, tab.x1 + w / 2, 509);
    });
  }

  function renderTab0Controls() {
    const cols = [
      [20, 310],
      [335, 625],
      [650, 940]
    ];
    const rows = [
      [75, 245],
      [265, 435]
    ];

    state.controls.forEach((ctrl, idx) => {
      const [x1, x2] = cols[idx % 3];
      const [y1, y2] = rows[Math.floor(idx / 3)];
      const w = x2 - x1;
      const h = y2 - y1;

      const isEmphasized = ctrl.kind === "scene"
        ? Date.now() < state.sceneFlashUntil
        : ctrl.active;

      const cardBg = isEmphasized ? PALETTE.ink : PALETTE.paper;
      const fg = isEmphasized ? PALETTE.paper : PALETTE.ink;
      const subFg = isEmphasized ? PALETTE.g12 : PALETTE.g06;

      fillRoundRect(ctx, x1, y1, w, h, 12, cardBg, PALETTE.ink, 2);

      // Icon circle
      fillRoundRect(ctx, x1 + 18, y1 + 18, 52, 52, 12, isEmphasized ? PALETTE.g02 : PALETTE.g14, fg, 1.5);
      drawControlIcon(ctx, ctrl.kind, x1 + 44, y1 + 44, ctrl.active, fg);

      // State Pill top-right
      let stateText = ctrl.active ? "ON" : "OFF";
      if (ctrl.kind === "lock") stateText = ctrl.active ? "LOCKED" : "UNLOCKED";
      if (ctrl.kind === "garage") stateText = ctrl.active ? "OPEN" : "CLOSED";
      if (ctrl.kind === "scene") stateText = Date.now() < state.sceneFlashUntil ? "ACTIVATED" : "TRIGGER";

      fillRoundRect(ctx, x2 - 104, y1 + 22, 86, 26, 13, isEmphasized ? PALETTE.paper : PALETTE.g14, fg, 1.2);
      ctx.fillStyle = isEmphasized ? PALETTE.ink : PALETTE.ink;
      ctx.font = "700 11.5px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stateText, x2 - 61, y1 + 35);

      // Title & Entity detail
      ctx.fillStyle = fg;
      ctx.font = "700 20px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(ctrl.name, x1 + 18, y1 + 104);

      ctx.fillStyle = subFg;
      ctx.font = "500 13.5px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(ctrl.detail, x1 + 18, y1 + 132);

      ctx.font = "500 11px Consolas, monospace";
      ctx.fillText(ctrl.entity, x1 + 18, y1 + 154);
    });

    // Bottom Status Strip (y: 444..470)
    fillRoundRect(ctx, 20, 444, 920, 24, 6, PALETTE.g14, PALETTE.g12, 1);
    ctx.fillStyle = PALETTE.g04;
    ctx.font = "600 12px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`STATUS: ${state.lastStatusMessage}`, 32, 456);
    ctx.textAlign = "right";
    ctx.fillText(
      `Partial: ${state.partialRefreshCount}/${state.maxPartialBeforeClean}  •  OTA Lock: ${state.stayAwakeOta ? "AWAKE" : "AUTO"}`,
      928,
      456
    );
  }

  function renderTab1Weather() {
    const w = WEATHER_PRESETS[state.weatherIndex];

    // Left Hero Card (x: 20..420, y: 75..455)
    fillRoundRect(ctx, 20, 75, 400, 380, 14, PALETTE.paper, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.g06;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("OUTDOOR WEATHER  •  CLICK TO CYCLE", 40, 100);

    drawWeatherIcon(ctx, w.condition, 105, 185, 2.2, PALETTE.ink);

    // Large Temperature
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 72px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(formatTemp(w.tempF, 0), 175, 178);
    ctx.font = "600 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = PALETTE.g04;
    ctx.fillText(w.label, 178, 224);

    // Divider
    ctx.strokeStyle = PALETTE.g12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(38, 260);
    ctx.lineTo(402, 260);
    ctx.stroke();

    // 2x3 Metrics Grid
    const metrics = [
      ["FEELS LIKE", formatTemp(w.feelsF, 0)],
      ["HUMIDITY", `${w.humidity}%`],
      ["WIND", formatSpeed(w.windMph)],
      ["UV INDEX", `${w.uv} (${w.uv >= 6 ? "High" : w.uv >= 3 ? "Mod" : "Low"})`],
      ["PRESSURE", formatPressure(w.pressureHpa)],
      ["SUNRISE / SET", `${formatClockSimple(w.sunrise)} / ${formatClockSimple(w.sunset)}`]
    ];

    metrics.forEach(([label, val], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const mx = 42 + col * 185;
      const my = 286 + row * 56;
      ctx.fillStyle = PALETTE.g06;
      ctx.font = "700 11px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(label, mx, my);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 17px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(val, mx, my + 22);
    });

    // Right 5-Day Forecast Card (x: 440..940, y: 75..455)
    fillRoundRect(ctx, 440, 75, 500, 380, 14, PALETTE.paper, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.g06;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("5-DAY FORECAST  (sensor.lilygo_t5_weather_forecast_compact)", 460, 100);

    const days = w.forecastCsv.split(";").map((entry) => {
      const [day, cond, hi, lo] = entry.split("|");
      return { day, cond, hiF: Number(hi), loF: Number(lo) };
    });

    const minAll = Math.min(...days.map((d) => d.loF));
    const maxAll = Math.max(...days.map((d) => d.hiF));
    const span = Math.max(1, maxAll - minAll);

    days.forEach((d, idx) => {
      const colW = 92;
      const cx = 456 + idx * 95 + colW / 2;
      const boxX = 456 + idx * 95;

      fillRoundRect(ctx, boxX, 122, colW, 312, 10, idx === 0 ? PALETTE.g14 : PALETTE.paper, PALETTE.g12, 1.2);

      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 16px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.day, cx, 148);

      drawWeatherIcon(ctx, d.cond, cx, 202, 1.15, PALETTE.ink);

      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(formatTemp(d.hiF, 0), cx, 256);

      // Vertical Temperature Range Bar (y: 276..384)
      const barTop = 276;
      const barH = 108;
      fillRoundRect(ctx, cx - 6, barTop, 12, barH, 6, PALETTE.g14, PALETTE.g12, 1);

      const yTop = barTop + Math.round(((maxAll - d.hiF) / span) * (barH - 18));
      const yBot = barTop + Math.round(((maxAll - d.loF) / span) * (barH - 18)) + 18;
      fillRoundRect(ctx, cx - 6, yTop, 12, Math.max(16, yBot - yTop), 6, PALETTE.ink, PALETTE.ink, 1);

      ctx.font = "600 15px 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = PALETTE.g06;
      ctx.fillText(formatTemp(d.loF, 0), cx, 408);
    });
    ctx.textAlign = "left";
  }

  function renderTab2Climate() {
    // Left 2x2 Room Grid (x: 20..580, y: 75..455)
    const roomBoxes = [
      { x: 20, y: 75, w: 270, h: 180 },
      { x: 310, y: 75, w: 270, h: 180 },
      { x: 20, y: 275, w: 270, h: 180 },
      { x: 310, y: 275, w: 270, h: 180 }
    ];

    state.rooms.forEach((room, idx) => {
      const b = roomBoxes[idx];
      fillRoundRect(ctx, b.x, b.y, b.w, b.h, 12, PALETTE.paper, PALETTE.ink, 2);

      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 17px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(room.name, b.x + 18, b.y + 28);

      const comfort = getRoomComfort(room.tempF, room.hum);
      fillRoundRect(ctx, b.x + 18, b.y + 132, 92, 26, 13, comfort === "COMFORT" ? PALETTE.g14 : PALETTE.ink, PALETTE.ink, 1.2);
      ctx.fillStyle = comfort === "COMFORT" ? PALETTE.ink : PALETTE.paper;
      ctx.font = "700 11px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(comfort, b.x + 64, b.y + 145);

      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 38px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(formatTemp(room.tempF, 1), b.x + 18, b.y + 84);

      ctx.fillStyle = PALETTE.g04;
      ctx.font = "700 20px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${room.hum}% RH`, b.x + b.w - 18, b.y + 145);

      // Humidity micro-bar
      fillRoundRect(ctx, b.x + 130, b.y + 114, 120, 8, 4, PALETTE.g14, PALETTE.g12, 1);
      fillRoundRect(ctx, b.x + 130, b.y + 114, Math.round((120 * room.hum) / 100), 8, 4, PALETTE.g04, null);
    });

    // Right HVAC & Air Quality Panel (x: 600..940, y: 75..455)
    fillRoundRect(ctx, 600, 75, 340, 380, 14, PALETTE.paper, PALETTE.ink, 2);

    const hvacMode = state.hvac.modes[state.hvac.modeIndex];
    fillRoundRect(ctx, 625, 92, 290, 40, 10, PALETTE.ink, PALETTE.ink, 1.5);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`THERMOSTAT: ${hvacMode}  (TAP TO CYCLE)`, 770, 112);

    ctx.fillStyle = PALETTE.g06;
    ctx.font = "700 12px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`CURRENT: ${formatTemp(state.hvac.currentTempF, 0)}`, 770, 160);

    ctx.fillStyle = PALETTE.g04;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("TARGET SETPOINT", 770, 198);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 54px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(formatTemp(state.hvac.targetTempF, 0), 770, 248);

    // [-] Button: x: 625..710, y: 295..355
    fillRoundRect(ctx, 625, 295, 85, 60, 10, PALETTE.g14, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 32px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("-", 667.5, 325);

    // Center delta readout between [-] and [+]
    const diff = state.hvac.targetTempF - state.hvac.currentTempF;
    const actionStr = hvacMode === "OFF"
      ? "IDLE"
      : diff > 0 && (hvacMode === "HEAT" || hvacMode === "AUTO")
        ? "HEATING"
        : diff < 0 && (hvacMode === "COOL" || hvacMode === "AUTO")
          ? "COOLING"
          : "SATISFIED";
    ctx.fillStyle = PALETTE.g04;
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(actionStr, 770, 325);

    // [+] Button: x: 830..915, y: 295..355
    fillRoundRect(ctx, 830, 295, 85, 60, 10, PALETTE.g14, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 30px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("+", 872.5, 325);

    // Divider & Indoor CO2 / AQI Bar (y: 375..442)
    ctx.strokeStyle = PALETTE.g12;
    ctx.beginPath();
    ctx.moveTo(622, 372);
    ctx.lineTo(918, 372);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Indoor CO2: ${state.hvac.co2Ppm} ppm`, 625, 396);
    ctx.textAlign = "right";
    ctx.fillText(`AQI: ${state.hvac.aqi} (Good)`, 915, 396);

    // AQI Bar
    fillRoundRect(ctx, 625, 416, 290, 16, 8, PALETTE.g14, PALETTE.ink, 1.5);
    const aqiFill = Math.min(290, Math.max(18, Math.round((state.hvac.aqi / 150) * 290)));
    fillRoundRect(ctx, 625, 416, aqiFill, 16, 8, PALETTE.ink, null);
    ctx.textAlign = "left";
  }

  function renderTab3Power() {
    const soc = computeLipoSoc(state.lipoVoltage);

    // Top-Left: 1S LiPo Discharge Curve Visualizer (x: 20..625, y: 75..245)
    fillRoundRect(ctx, 20, 75, 605, 170, 12, PALETTE.paper, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`1S LIPO DISCHARGE CURVE (3.20V - 4.20V)  •  ${state.lipoVoltage.toFixed(2)}V (${soc}%)`, 38, 97);

    // Graph area
    const gx = 54;
    const gy = 118;
    const gw = 350;
    const gh = 104;

    ctx.strokeStyle = PALETTE.g12;
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // 3.32V Critical threshold vertical dashed line
    const vToX = (v) => gx + ((Math.max(3.20, Math.min(4.25, v)) - 3.20) / 1.05) * gw;
    const sToY = (s) => gy + gh - (s / 100) * gh;

    const critX = vToX(3.32);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = PALETTE.g04;
    ctx.beginPath();
    ctx.moveTo(critX, gy);
    ctx.lineTo(critX, gy + gh);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.g06;
    ctx.font = "700 10px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("3.32V", critX + 3, gy + 12);

    // Plot 11-point curve
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = LIPO_CURVE.length - 1; i >= 0; i--) {
      const px = vToX(LIPO_CURVE[i][0]);
      const py = sToY(LIPO_CURVE[i][1]);
      if (i === LIPO_CURVE.length - 1) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current voltage marker dot
    const curX = vToX(state.lipoVoltage);
    const curY = sToY(soc);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.paper;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Runtime estimates column (x: 422..612)
    ctx.fillStyle = PALETTE.g06;
    ctx.font = "700 11.5px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("EST. RUNTIME AT CURRENT SOC", 422, 122);
    POWER_MODES.forEach((m, i) => {
      const rem = (soc / 100) * m.estHoursAt100;
      const ry = 148 + i * 28;
      ctx.fillStyle = state.powerModeIndex === i ? PALETTE.ink : PALETTE.g06;
      ctx.font = state.powerModeIndex === i ? "700 12.5px 'Segoe UI', Roboto, sans-serif" : "600 12px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${m.label.split(" ")[0]}: ${formatDurationHours(rem)}`, 422, ry);
    });

    // Top-Right: Diagnostics Card (x: 650..940, y: 75..245)
    fillRoundRect(ctx, 650, 75, 290, 170, 12, PALETTE.paper, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("SYSTEM DIAGNOSTICS", 668, 97);

    const diagLines = [
      ["Wakeup:", state.wakeCause],
      ["Wi-Fi RSSI:", `${state.wifiRssi} dBm (Light Sleep)`],
      ["Refreshes:", `${state.partialRefreshCount}/${state.maxPartialBeforeClean} partial • ${state.fullRefreshCount} full`],
      ["OTA Lock:", state.stayAwakeOta ? "STAY AWAKE (ON)" : "Auto Sleep Allowed"]
    ];
    diagLines.forEach(([k, v], i) => {
      const dy = 128 + i * 27;
      ctx.fillStyle = PALETTE.g06;
      ctx.font = "700 12px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(k, 668, dy);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "600 12px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(v, 738, dy);
    });

    // Bottom Row (y: 265..435): 3 Power Mode Cards mapped to grid columns
    const modeCards = [
      { x: 20, title: "ALWAYS ONLINE", sub: "Modem Light Sleep", est: "~18-24 hrs / charge", foot: "Instant HA push updates" },
      { x: 335, title: "ADAPTIVE HYBRID", sub: "Smart Sleep <35% / Night", est: "~4-7 days / charge", foot: "Recommended balance" },
      { x: 650, title: state.powerModeIndex === 2 ? "SLEEP NOW (EXT0)" : "MAX BATTERY", sub: "Deep Sleep + GPIO16 Wake", est: "~25-35 days / charge", foot: state.powerModeIndex === 2 ? "Tap again -> Deep Sleep" : "15m PCF8563 RTC wake" }
    ];

    modeCards.forEach((card, idx) => {
      const active = state.powerModeIndex === idx;
      fillRoundRect(ctx, card.x, 265, 290, 170, 12, active ? PALETTE.ink : PALETTE.paper, PALETTE.ink, 2);
      ctx.fillStyle = active ? PALETTE.paper : PALETTE.ink;
      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(card.title, card.x + 20, 300);

      ctx.fillStyle = active ? PALETTE.g12 : PALETTE.g04;
      ctx.font = "600 13.5px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(card.sub, card.x + 20, 334);
      ctx.fillText(card.est, card.x + 20, 362);

      fillRoundRect(ctx, card.x + 20, 386, 250, 30, 8, active ? PALETTE.paper : PALETTE.g14, active ? PALETTE.paper : PALETTE.ink, 1);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 12px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(active ? (idx === 2 ? "ACTIVE — TAP TO SLEEP NOW" : "ACTIVE PROFILE") : card.foot, card.x + 145, 401);
      ctx.textAlign = "left";
    });
  }

  function renderCriticalHibernateOverlay() {
    // Full e-paper protection screen when LiPo < 3.32V
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 57, WIDTH, 483);

    fillRoundRect(ctx, 80, 95, 800, 390, 16, PALETTE.paper, PALETTE.ink, 4);
    fillRoundRect(ctx, 80, 95, 800, 74, 14, PALETTE.ink, PALETTE.ink, 2);

    ctx.fillStyle = PALETTE.paper;
    ctx.font = "700 24px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CRITICAL LIPO PROTECTION  —  HIBERNATE MODE", WIDTH / 2, 132);

    // Big Battery Warning Glyph
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(WIDTH / 2 - 60, 200, 110, 54);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(WIDTH / 2 + 50, 215, 10, 24);
    ctx.font = "700 34px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("!", WIDTH / 2 - 5, 228);

    ctx.font = "700 28px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Battery Critical: ${state.lipoVoltage.toFixed(2)}V (0% SoC)`, WIDTH / 2, 296);

    ctx.fillStyle = PALETTE.g04;
    ctx.font = "600 17px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("ADC GPIO14 fell below 3.32V over-discharge threshold.", WIDTH / 2, 344);
    ctx.fillText("Wi-Fi & GT911 scanning halted. ESP32-S3 entering Deep Sleep Hibernate.", WIDTH / 2, 374);

    fillRoundRect(ctx, 230, 410, 500, 44, 10, PALETTE.g14, PALETTE.ink, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 15px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Connect USB-C 5V Charger or raise LiPo voltage >= 3.32V", WIDTH / 2, 432);
    ctx.textAlign = "left";
  }

  function renderEInkFlashEffects() {
    if (!state.flashOverlay) return;
    if (state.flashOverlay.mode === "full") {
      ctx.fillStyle = state.flashOverlay.phase === "black" ? "#111110" : "#f7f6f0";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else if (state.flashOverlay.mode === "partial" && state.flashOverlay.region) {
      const r = state.flashOverlay.region;
      ctx.save();
      ctx.fillStyle = "rgba(20, 20, 18, 0.35)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }

  function renderHitboxOverlay() {
    octx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!state.showHitboxes) return;

    const boxes = getActiveHitboxes();
    octx.save();
    boxes.forEach((b) => {
      const w = b.x2 - b.x1;
      const h = b.y2 - b.y1;
      const isHover = state.hoveredHitbox && state.hoveredHitbox.id === b.id;

      octx.fillStyle = isHover ? "rgba(56, 189, 248, 0.22)" : "rgba(56, 189, 248, 0.08)";
      octx.fillRect(b.x1, b.y1, w, h);

      octx.setLineDash([6, 4]);
      octx.strokeStyle = isHover ? "#0284c7" : "#0ea5e9";
      octx.lineWidth = isHover ? 2.5 : 1.5;
      octx.strokeRect(b.x1 + 0.5, b.y1 + 0.5, w - 1, h - 1);

      octx.setLineDash([]);
      const tag = `${b.id} [${b.x1}..${b.x2}, ${b.y1}..${b.y2}]`;
      octx.font = "700 10.5px Consolas, monospace";
      const tw = octx.measureText(tag).width + 10;
      octx.fillStyle = "rgba(13, 17, 23, 0.88)";
      octx.fillRect(b.x1 + 2, b.y1 + 2, Math.min(tw, w - 4), 17);
      octx.fillStyle = "#7dd3fc";
      octx.textBaseline = "middle";
      octx.fillText(tag, b.x1 + 7, b.y1 + 10.5);
    });

    // Live crosshair + coordinate tooltip
    if (state.cursor.x !== null && state.cursor.y !== null) {
      const { x, y } = state.cursor;
      octx.strokeStyle = "rgba(248, 81, 73, 0.75)";
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(x, 0);
      octx.lineTo(x, HEIGHT);
      octx.moveTo(0, y);
      octx.lineTo(WIDTH, y);
      octx.stroke();

      const label = `(${x}, ${y})`;
      const lx = x + 12 > WIDTH - 90 ? x - 86 : x + 12;
      const ly = y + 24 > HEIGHT - 10 ? y - 24 : y + 12;
      octx.fillStyle = "#0d1117";
      octx.fillRect(lx, ly, 76, 20);
      octx.strokeStyle = "#f85149";
      octx.strokeRect(lx, ly, 76, 20);
      octx.fillStyle = "#ffffff";
      octx.font = "700 11px Consolas, monospace";
      octx.textBaseline = "middle";
      octx.fillText(label, lx + 7, ly + 10);
    }
    octx.restore();
  }

  function renderAll() {
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    renderHeader();

    if (state.isCriticalHibernate) {
      renderCriticalHibernateOverlay();
    } else {
      if (state.activeTab === 0) renderTab0Controls();
      else if (state.activeTab === 1) renderTab1Weather();
      else if (state.activeTab === 2) renderTab2Climate();
      else if (state.activeTab === 3) renderTab3Power();
      renderBottomTabs();
    }

    renderEInkFlashEffects();
    renderHitboxOverlay();
    syncExternalControls();
  }

  // ---------------------------------------------------------------------------
  // External Controls Synchronization
  // ---------------------------------------------------------------------------
  function syncExternalControls() {
    const soc = computeLipoSoc(state.lipoVoltage);
    lipoSliderEl.value = state.lipoVoltage.toFixed(2);
    lipoBadgeEl.textContent = `${soc}% • ${state.lipoVoltage.toFixed(2)}V`;
    lipoBadgeEl.className = "badge " + (
      state.lipoVoltage < 3.32 ? "badge-danger" : state.lipoVoltage < 3.45 ? "badge-warn" : "badge-ok"
    );

    refreshCounterBadgeEl.textContent = `Partial: ${state.partialRefreshCount} / ${state.maxPartialBeforeClean}`;

    const charging = isChargingActive();
    ledChargeEl.classList.toggle("charging", charging);
    usbcSlotEl.classList.toggle("plugged", charging);
    ledActiveEl.classList.toggle("active", !state.isSleeping && !state.isCriticalHibernate);

    sleepBannerEl.classList.toggle("hidden", !state.isSleeping);

    if (state.isCriticalHibernate) {
      headerPowerStateEl.textContent = "CRITICAL HIBERNATE";
      headerPowerStateEl.className = "mono-val state-critical";
    } else if (state.isSleeping) {
      headerPowerStateEl.textContent = "DEEP SLEEP (GPIO16 ARMED)";
      headerPowerStateEl.className = "mono-val state-sleep";
    } else {
      headerPowerStateEl.textContent = `ONLINE (${POWER_MODES[state.powerModeIndex].label})`;
      headerPowerStateEl.className = "mono-val state-online";
    }

    unitsLabelEl.textContent = state.useMetric
      ? "Metric (°C, km/h, 24h)"
      : "Imperial (°F, mph, 12h)";
  }

  // ---------------------------------------------------------------------------
  // Mouse / Pointer Coordinate Mapping onto Exact 960x540 Canvas
  // ---------------------------------------------------------------------------
  function getCanvasCoords(ev) {
    const rect = epdCanvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = Math.max(0, Math.min(WIDTH - 1, Math.round((ev.clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(HEIGHT - 1, Math.round((ev.clientY - rect.top) * scaleY)));
    return { x, y };
  }

  epdCanvas.addEventListener("mousemove", (ev) => {
    const { x, y } = getCanvasCoords(ev);
    state.cursor = { x, y };
    state.hoveredHitbox = findHitboxAt(x, y);
    cursorCoordsEl.textContent = `X: ${String(x).padStart(3, " ")}, Y: ${String(y).padStart(3, " ")}`;
    hoveredHitboxEl.textContent = state.hoveredHitbox ? state.hoveredHitbox.id : "none";
    epdCanvas.style.cursor = state.hoveredHitbox || state.isSleeping ? "pointer" : "crosshair";
    if (state.showHitboxes) renderHitboxOverlay();
  });

  epdCanvas.addEventListener("mouseleave", () => {
    state.cursor = { x: null, y: null };
    state.hoveredHitbox = null;
    cursorCoordsEl.textContent = "X: ---, Y: ---";
    hoveredHitboxEl.textContent = "none";
    if (state.showHitboxes) renderHitboxOverlay();
  });

  epdCanvas.addEventListener("click", (ev) => {
    const { x, y } = getCanvasCoords(ev);

    if (state.isCriticalHibernate) {
      logEvent("crit", "TOUCH IGNORED", `Touch (${x}, ${y}) ignored — LiPo < 3.32V Critical Hibernate active.`);
      return;
    }

    if (state.isSleeping) {
      logEvent("touch", "GPIO16 EXT0", `Touch interrupt at (${x}, ${y}) woke ESP32-S3 from Deep Sleep!`);
      wakeFromDeepSleep("GPIO16 Touch Interrupt");
      return;
    }

    const hit = findHitboxAt(x, y);
    if (hit) {
      logEvent("touch", "GT911", `Touch (x=${x}, y=${y}) -> hitbox: ${hit.id}`);
      hit.action(ev);
    } else {
      logEvent("touch", "GT911", `Touch (x=${x}, y=${y}) -> no active hitbox (sleep timer reset)`);
    }
  });

  // ---------------------------------------------------------------------------
  // External Hardware Panel Listeners
  // ---------------------------------------------------------------------------
  lipoSliderEl.addEventListener("input", () => {
    const prev = state.lipoVoltage;
    state.lipoVoltage = parseFloat(lipoSliderEl.value);
    evaluateBatteryThresholds(prev);
    renderAll();
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prev = state.lipoVoltage;
      state.lipoVoltage = parseFloat(btn.dataset.voltage);
      logEvent("power", "ADC GPIO14", `LiPo preset set to ${state.lipoVoltage.toFixed(2)}V (${computeLipoSoc(state.lipoVoltage)}%)`);
      evaluateBatteryThresholds(prev);
      renderAll();
    });
  });

  toggleChargingEl.addEventListener("change", () => {
    state.usbCharging = toggleChargingEl.checked;
    logEvent("power", "USB-C", `Charging / VBUS ${state.usbCharging ? "CONNECTED (lipo_charging = ON)" : "DISCONNECTED"}`);
    renderAll();
  });

  toggleOtaAwakeEl.addEventListener("change", () => {
    state.stayAwakeOta = toggleOtaAwakeEl.checked;
    logEvent("ha", "HA -> ESPHOME", `input_boolean.lilygo_t5_stay_awake_ota = ${state.stayAwakeOta ? "ON (Deep Sleep locked out)" : "OFF"}`);
    renderAll();
  });

  toggleMetricEl.addEventListener("change", () => {
    state.useMetric = toggleMetricEl.checked;
    logEvent("epd", "UNITS", `Switched display units to ${state.useMetric ? "Metric (°C, km/h, 24h)" : "Imperial (°F, mph, 12h)"}`);
    triggerPartialRefresh({ x: 0, y: 0, w: WIDTH, h: 475 }, "Unit Conversion");
  });

  toggleHitboxesEl.addEventListener("change", () => {
    state.showHitboxes = toggleHitboxesEl.checked;
    logEvent("touch", "DEBUG", `GT911 hitbox & coordinate overlay ${state.showHitboxes ? "ENABLED" : "DISABLED"}`);
    renderHitboxOverlay();
  });

  document.getElementById("btn-deep-sleep").addEventListener("click", () => {
    if (state.isSleeping) {
      wakeFromDeepSleep("GPIO16 Touch Interrupt");
    } else {
      enterDeepSleep("Hardware Simulator Button");
    }
  });

  document.getElementById("btn-rtc-wake").addEventListener("click", () => {
    wakeFromDeepSleep("PCF8563 15m Timer");
  });

  document.getElementById("btn-cycle-weather").addEventListener("click", () => {
    cycleWeatherPreset();
  });

  document.getElementById("btn-hw-rst").addEventListener("click", () => {
    state.isSleeping = false;
    state.wakeCause = "Cold Boot";
    logEvent("power", "RST", "Hardware RST pressed -> ESP32-S3 Cold Boot (PCF8563 RTC synced)");
    triggerFullCleanRefresh("Hardware RST Cold Boot");
  });

  document.getElementById("btn-hw-boot").addEventListener("click", () => {
    logEvent("power", "GPIO0 BOOT", "BOOT button pressed. (Tip: Hold BOOT + tap RST to enter USB-C Download Mode for flashing)");
  });

  document.getElementById("btn-clear-log").addEventListener("click", () => {
    apiConsoleEl.innerHTML = "";
  });

  // Periodic live clock update (every 15 seconds)
  setInterval(() => {
    if (!state.isSleeping && !state.isCriticalHibernate) {
      renderAll();
    }
  }, 15000);

  // Initial Boot Render
  logEvent("power", "BOOT", "LilyGo T5 4.7\" [H716] Simulator initialized (ED047TC1 960x540, GT911 I2C 0x5D, GPIO14 ADC)");
  logEvent("ha", "API", "Home Assistant Native API connected — 4 tabs & 6 control entities ready");
  renderAll();
})();
