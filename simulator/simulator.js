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
    { id: 0, label: "ALWAYS ONLINE", haName: "Always Online (Modem Sleep)", estHoursAt100: 120 },
    { id: 1, label: "ADAPTIVE HYBRID", haName: "Adaptive Hybrid (Recommended)", estHoursAt100: 720 },
    { id: 2, label: "MAX BATTERY", haName: "Max Battery (Deep Sleep + Touch Wake)", estHoursAt100: 2880 }
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
    quietStartHour: 23,
    quietEndHour: 6,
    weatherIndex: 0,
    cursor: { x: null, y: null },
    lastTouch: null,
    hoveredHitbox: null,
    lastStatusMessage: "HA Connected • All entities synced",
    sceneFlashUntil: 0,
    flashOverlay: null, // { mode: 'full'|'partial', region, phase }

    controls: [
      { id: "ctrl_1", name: "Living Room TV", entity: "scene.living_room_tv", subtitle: "Home Assistant Scene", kind: "tv", active: true, onLabel: "ACTIVE", offLabel: "TAP TO RUN" },
      { id: "ctrl_2", name: "Kitchen Lights", entity: "light.kitchen_lights", subtitle: "Smart Light Group", kind: "light_group", active: false, onLabel: "ON", offLabel: "OFF" },
      { id: "ctrl_3", name: "Evening Lights", entity: "scene.evening_lights", subtitle: "Home Assistant Scene", kind: "light", active: false, onLabel: "ACTIVE", offLabel: "TAP TO RUN" },
      { id: "ctrl_4", name: "Bookshelf Lights", entity: "light.cync_indoor_light_strip_16ft_2", subtitle: "Indoor Light Strip", kind: "light", active: false, onLabel: "ON", offLabel: "OFF" },
      { id: "ctrl_5", name: "Wave Light", entity: "switch.living_room_light", subtitle: "Smart Switch Control", kind: "switch", active: true, onLabel: "ON", offLabel: "OFF" },
      { id: "ctrl_6", name: "Goodnight", entity: "scene.bed_time", subtitle: "Whole-Home Scene", kind: "scene", active: false, onLabel: "ACTIVE", offLabel: "TAP TO RUN" }
    ],

    rooms: [
      { name: "Living Room", tempF: 71.4, hum: 44, isEspresso: false },
      { name: "Hallway", tempF: 68.8, hum: 48, isEspresso: false },
      { name: "Home Office", tempF: 73.1, hum: 41, isEspresso: false },
      { name: "DE1+ Grouphead", tempF: 198.5, hum: 0, isEspresso: true }
    ],

    hvac: {
      modes: ["cool", "heat", "auto", "off"],
      modeIndex: 0,
      currentTempF: 71,
      targetTempF: 70,
      co2Ppm: 540,
      aqi: 18
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
      { id: "hdr_refresh", label: "CLEAN", x1: 740, y1: 8, x2: 845, y2: 48, action: () => triggerFullCleanRefresh("Header [CLEAN]") },
      {
        id: "hdr_sleep_mode",
        label: "MODE",
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
      { id: "tab_3_power", label: "TAB 3: POWER", x1: 720, y1: 476, x2: 959, y2: 540, action: () => switchTab(3) }
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
          x1: 620,
          y1: 116,
          x2: 920,
          y2: 148,
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
      // Top Row Compact Power Mode Buttons (y: 66..142) + Bottom-Right Compact Action Buttons (y: 402..464)
      boxes.push(
        {
          id: "pwr_mode_0",
          label: "1. ALWAYS ONLINE",
          x1: 20,
          y1: 66,
          x2: 310,
          y2: 142,
          action: () => setPowerMode(0, { x: 20, y: 66, w: 290, h: 76 })
        },
        {
          id: "pwr_mode_1",
          label: "2. ADAPTIVE HYBRID",
          x1: 335,
          y1: 66,
          x2: 625,
          y2: 142,
          action: () => setPowerMode(1, { x: 335, y: 66, w: 290, h: 76 })
        },
        {
          id: "pwr_mode_2",
          label: "3. MAX BATTERY",
          x1: 650,
          y1: 66,
          x2: 940,
          y2: 142,
          action: () => setPowerMode(2, { x: 650, y: 66, w: 290, h: 76 })
        },
        {
          id: "pwr_clean",
          label: "[ CLEAN ]",
          x1: 650,
          y1: 402,
          x2: 788,
          y2: 464,
          action: () => triggerFullCleanRefresh("Tab 3 [CLEAN]")
        },
        {
          id: "pwr_sleep",
          label: "[ SLEEP ]",
          x1: 802,
          y1: 402,
          x2: 940,
          y2: 464,
          action: () => enterDeepSleep("Tab 3 [SLEEP]")
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
    const tabNames = ["CONTROLS", "WEATHER", "CLIMATE", "POWER"];
    state.lastStatusMessage = `Switched to Tab ${tabIndex}: ${tabNames[tabIndex]}`;
    logEvent("epd", "UI", `global active_tab = ${tabIndex} (${tabNames[tabIndex]})`);
    triggerPartialRefresh({ x: 0, y: 57, w: WIDTH, h: 483 }, `Tab -> ${tabNames[tabIndex]}`);
  }

  function toggleControlCard(idx, x, y, w, h) {
    const ctrl = state.controls[idx];
    if (idx === 0 || idx === 2 || idx === 5) {
      // Mutually exclusive scenes matching touch_navigation.yaml (ctrl_1, ctrl_3, ctrl_6)
      state.controls[0].active = idx === 0;
      state.controls[2].active = idx === 2;
      state.controls[5].active = idx === 5;
      if (idx === 5) {
        state.controls[1].active = false;
        state.controls[3].active = false;
        state.controls[4].active = false;
      }
      state.lastStatusMessage = `homeassistant.turn_on (${ctrl.entity}) -> ACTIVE`;
      logEvent("ha", "ESPHOME -> HA", `homeassistant.service: homeassistant.turn_on { entity_id: "${ctrl.entity}" }`);
      logEvent("ha", "HA -> ESPHOME", `state_changed: ${ctrl.entity} = ACTIVE`);
      triggerPartialRefresh({ x: 20, y: 75, w: 920, h: 365 }, ctrl.entity);
      return;
    }

    ctrl.active = !ctrl.active;
    const stateLabel = ctrl.active ? ctrl.onLabel : ctrl.offLabel;
    state.lastStatusMessage = `homeassistant.toggle (${ctrl.entity}) -> ${stateLabel}`;
    logEvent("ha", "ESPHOME -> HA", `homeassistant.service: homeassistant.toggle { entity_id: "${ctrl.entity}" }`);
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
  function drawCard(c, x, y, w, h, inverted = false, borderPx = 2) {
    if (inverted) {
      c.fillStyle = PALETTE.ink;
      c.fillRect(x, y, w, h);
    } else {
      c.fillStyle = PALETTE.paper;
      c.fillRect(x, y, w, h);
      if (borderPx > 0) {
        c.strokeStyle = PALETTE.ink;
        c.lineWidth = borderPx;
        const inset = borderPx / 2;
        c.strokeRect(x + inset, y + inset, w - borderPx, h - borderPx);
      }
    }
  }

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

  function drawWifiIcon(c, x, y, rssi, connected, color) {
    c.save();
    const cx = x + 11;
    const cy = y + 18;
    const active = connected && rssi > -95;
    c.lineWidth = 2.2;
    c.lineCap = "round";

    [13, 9, 5].forEach((r, idx) => {
      const threshold = idx === 0 ? -70 : idx === 1 ? -82 : -95;
      c.strokeStyle = active && rssi > threshold ? color : PALETTE.g12;
      c.beginPath();
      c.arc(cx, cy, r, -Math.PI * 0.78, -Math.PI * 0.22);
      c.stroke();
    });

    c.fillStyle = active ? color : PALETTE.g12;
    c.beginPath();
    c.arc(cx, cy, 2, 0, Math.PI * 2);
    c.fill();

    if (!active) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 2, y + 3);
      c.lineTo(x + 20, y + 20);
      c.stroke();
    }
    c.restore();
  }

  function drawBatteryIcon(c, x, y, soc, charging, color, lowWarning = false) {
    c.save();
    // Vertical MDI-style battery icon (14w x 20h inside 22x22 box)
    const bx = x + 4;
    const by = y + 3;
    const bw = 13;
    const bh = 18;

    // Terminal nub on top
    c.fillStyle = color;
    c.fillRect(bx + 3.5, by - 2.5, 6, 2.5);

    // Outer body
    c.strokeStyle = color;
    c.lineWidth = 1.8;
    c.strokeRect(bx, by, bw, bh);

    // Inner fill proportional to SoC
    const maxFillH = bh - 4;
    const fillH = Math.max(0, Math.round((maxFillH * Math.max(0, Math.min(100, soc))) / 100));
    if (fillH > 0) {
      c.fillStyle = color;
      c.fillRect(bx + 2, by + bh - 2 - fillH, bw - 4, fillH);
    }

    // Charging bolt overlay
    if (charging) {
      c.beginPath();
      c.moveTo(bx + 8, by + 3);
      c.lineTo(bx + 3.5, by + 10);
      c.lineTo(bx + 7, by + 10);
      c.lineTo(bx + 5, by + 15);
      c.lineTo(bx + 10, by + 8);
      c.lineTo(bx + 6.5, by + 8);
      c.closePath();
      c.fillStyle = PALETTE.paper;
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.stroke();
    } else if (lowWarning) {
      c.fillStyle = PALETTE.paper;
      c.font = "700 11px 'Segoe UI', Roboto, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("!", bx + bw / 2, by + bh / 2);
    }
    c.restore();
  }

  function drawRefreshIcon(c, x, y, color) {
    c.save();
    const cx = x + 10;
    const cy = y + 11;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2.1;
    c.lineCap = "round";
    c.beginPath();
    c.arc(cx, cy, 7.5, -Math.PI * 0.85, Math.PI * 0.65);
    c.stroke();
    // Arrowhead
    const ax = cx + Math.cos(-Math.PI * 0.85) * 7.5;
    const ay = cy + Math.sin(-Math.PI * 0.85) * 7.5;
    c.beginPath();
    c.moveTo(ax - 1, ay - 4);
    c.lineTo(ax + 5, ay - 1);
    c.lineTo(ax - 1, ay + 3);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawMoonIcon(c, x, y, color) {
    c.save();
    const cx = x + 10;
    const cy = y + 11;
    c.fillStyle = color;
    c.beginPath();
    c.arc(cx - 1, cy, 8, Math.PI * 0.3, Math.PI * 1.75);
    c.quadraticCurveTo(cx + 3, cy, cx - 1 + Math.cos(Math.PI * 0.3) * 8, cy + Math.sin(Math.PI * 0.3) * 8);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawNavIcon(c, kind, x, y, color) {
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 2;
    c.lineCap = "round";
    c.lineJoin = "round";
    const cx = x + 11;
    const cy = y + 11;

    if (kind === "controls") {
      c.beginPath();
      c.moveTo(cx - 9, cy);
      c.lineTo(cx, cy - 8);
      c.lineTo(cx + 9, cy);
      c.lineTo(cx + 7, cy);
      c.lineTo(cx + 7, cy + 8);
      c.lineTo(cx - 7, cy + 8);
      c.lineTo(cx - 7, cy);
      c.closePath();
      c.stroke();
      c.fillRect(cx - 2.5, cy + 1, 5, 7);
    } else if (kind === "weather") {
      drawWeatherIcon(c, "partlycloudy", cx, cy + 1, 0.52, color);
    } else if (kind === "climate") {
      // Thermometer
      c.beginPath();
      c.arc(cx, cy + 5.5, 3.8, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(cx - 2.2, cy + 3);
      c.lineTo(cx - 2.2, cy - 7);
      c.arc(cx, cy - 7, 2.2, Math.PI, 0);
      c.lineTo(cx + 2.2, cy + 3);
      c.stroke();
    } else if (kind === "power") {
      drawBatteryIcon(c, x, y, 80, false, color, false);
    }
    c.restore();
  }

  function drawControlIcon(c, kind, cx, cy, active, fg) {
    c.save();
    c.strokeStyle = fg;
    c.fillStyle = fg;
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";

    if (kind === "tv") {
      c.strokeRect(cx - 14, cy - 11, 28, 19);
      c.beginPath();
      c.moveTo(cx - 6, cy + 12);
      c.lineTo(cx + 6, cy + 12);
      c.moveTo(cx, cy + 8);
      c.lineTo(cx, cy + 12);
      c.stroke();
      if (active) {
        c.fillRect(cx - 10, cy - 7, 20, 11);
      }
    } else if (kind === "light_group" || kind === "light") {
      c.beginPath();
      c.arc(cx, cy - 3, 10, Math.PI * 0.78, Math.PI * 2.22);
      c.lineTo(cx + 5, cy + 9);
      c.lineTo(cx - 5, cy + 9);
      c.closePath();
      if (active) c.fill();
      c.stroke();
      c.fillRect(cx - 4, cy + 11, 8, 3.5);
      if (active || kind === "light_group") {
        for (let a = 0; a < 5; a++) {
          const ang = -Math.PI + (a * Math.PI) / 4;
          c.beginPath();
          c.moveTo(cx + Math.cos(ang) * 14, cy - 3 + Math.sin(ang) * 14);
          c.lineTo(cx + Math.cos(ang) * 17, cy - 3 + Math.sin(ang) * 17);
          c.stroke();
        }
      }
    } else if (kind === "switch") {
      c.strokeRect(cx - 11, cy - 14, 22, 28);
      c.strokeRect(cx - 5, cy - 8, 10, 16);
      if (active) {
        c.fillRect(cx - 5, cy - 8, 10, 8);
      } else {
        c.fillRect(cx - 5, cy, 10, 8);
      }
    } else if (kind === "scene") {
      // Crescent moon + star
      c.beginPath();
      c.arc(cx - 2, cy, 12, Math.PI * 0.3, Math.PI * 1.75);
      c.quadraticCurveTo(cx + 4, cy, cx - 2 + Math.cos(Math.PI * 0.3) * 12, cy + Math.sin(Math.PI * 0.3) * 12);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(cx + 11, cy - 9, 2.3, 0, Math.PI * 2);
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
    // Background bar (y: 0..56) with 2px bottom border matching epd_dashboard_ui.h
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, WIDTH, 56);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 54, WIDTH, 2);

    // Left (x: 16..310): Time on top line (y: 8..30), Date on second line (y: 35..50)
    const now = new Date();
    const timeStr = formatClock(now);
    const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    ctx.fillStyle = PALETTE.ink;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = "700 24px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(timeStr, 16, 8);
    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(dateStr, 16, 35);

    // Center (x: 318..545): Wi-Fi icon + sharp-bordered mode card (350, 12, 195, 32)
    drawWifiIcon(ctx, 318, 16, state.wifiRssi, !state.isSleeping, PALETTE.ink);
    const modeLabel = POWER_MODES[state.powerModeIndex].label;
    drawCard(ctx, 350, 12, 195, 32, false, 1);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(modeLabel, 447, 19);

    // Right Battery Gauge (x: 560..735): Battery icon + "84% • 4.01V" + status subtitle
    const soc = computeLipoSoc(state.lipoVoltage);
    const charging = isChargingActive();
    drawBatteryIcon(ctx, 560, 15, soc, charging, PALETTE.ink, state.lipoVoltage < 3.45);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${soc}% • ${state.lipoVoltage.toFixed(2)}V`, 588, 11);

    const batStatus = charging
      ? "USB-C CHARGING"
      : (state.powerModeIndex === 0 || state.stayAwakeOta)
        ? "OTA / ALWAYS ON"
        : "1S LIPO ACTIVE";
    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(batStatus, 588, 33);

    // Header Quick Buttons (y: 8..48)
    // [CLEAN] x: 740..845, y: 8..48
    drawCard(ctx, 740, 8, 105, 40, false, 2);
    drawRefreshIcon(ctx, 752, 17, PALETTE.ink);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("CLEAN", 780, 20);

    // [MODE] x: 846..950, y: 8..48
    drawCard(ctx, 846, 8, 104, 40, false, 2);
    drawMoonIcon(ctx, 856, 17, PALETTE.ink);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(state.isSleeping ? "SLEEP" : "MODE", 884, 20);
  }

  function renderBottomTabs() {
    // Bottom Bar y: 476..540
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 476, WIDTH, 64);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 476, WIDTH, 2);

    const tabs = [
      { kind: "controls", label: "CONTROLS", x: 0, w: 240 },
      { kind: "weather", label: "WEATHER", x: 240, w: 240 },
      { kind: "climate", label: "CLIMATE", x: 480, w: 240 },
      { kind: "power", label: "POWER", x: 720, w: 240 }
    ];

    tabs.forEach((tab, idx) => {
      const isSelected = state.activeTab === idx;
      if (isSelected) {
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(tab.x, 478, tab.w, 62);
      } else {
        ctx.fillStyle = PALETTE.paper;
        ctx.fillRect(tab.x, 478, tab.w, 62);
        if (idx > 0) {
          ctx.fillStyle = PALETTE.ink;
          ctx.fillRect(tab.x, 478, 1, 62);
        }
      }

      const fg = isSelected ? PALETTE.paper : PALETTE.ink;
      const cx = tab.x + tab.w / 2;
      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      const iconW = 22;
      const gap = 12;
      const textW = ctx.measureText(tab.label).width;
      const startX = Math.round(cx - (iconW + gap + textW) / 2);

      drawNavIcon(ctx, tab.kind, startX, 497, fg);
      ctx.fillStyle = fg;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(tab.label, startX + iconW + gap, 499);
    });
  }

  function renderTab0Controls() {
    const cols = [20, 335, 650];
    const rows = [75, 265];
    let activeCount = 0;

    state.controls.forEach((ctrl, idx) => {
      const x = cols[idx % 3];
      const y = rows[Math.floor(idx / 3)];
      const isOn = ctrl.active;
      if (isOn) activeCount++;

      drawCard(ctx, x, y, 290, 170, isOn, 2);
      const fg = isOn ? PALETTE.paper : PALETTE.ink;
      const stTxt = isOn ? ctrl.onLabel : ctrl.offLabel;

      drawControlIcon(ctx, ctrl.kind, x + 38, y + 38, isOn, fg);

      ctx.fillStyle = fg;
      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(stTxt, x + 268, y + 26);

      ctx.font = "700 24px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(ctrl.name, x + 22, y + 92);

      ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(ctrl.subtitle, x + 22, y + 128);
    });

    // Bottom Status Strip (y: 444..470)
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const statusText = state.lastTouch
      ? `GT911 Touch Ready (Last Tap: X=${state.lastTouch.x}, Y=${state.lastTouch.y})  •  ${activeCount} of 6 Entities Active  •  Tap any card to toggle`
      : `GT911 Capacitive Touch Ready  •  ${activeCount} of 6 Entities Active  •  Tap any card to toggle via Home Assistant API`;
    ctx.fillText(statusText, 24, 448);
  }

  function renderTab1Weather() {
    const w = WEATHER_PRESETS[state.weatherIndex];

    // Left Hero Card (x: 20..420, y: 75..455)
    drawCard(ctx, 20, 75, 400, 380, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("OUTDOOR CONDITIONS", 44, 92);

    drawWeatherIcon(ctx, w.condition, 78, 156, 1.55, PALETTE.ink);

    // Large Temperature
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 48px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(formatTemp(w.tempF, 0), 132, 125);
    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(w.label, 134, 182);

    // Divider
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(44, 224, 352, 1);

    // Weather Detail Metrics inside Left Hero Card
    const metrics = [
      ["FEELS LIKE", formatTemp(w.feelsF, 0), 44, 242, 24],
      ["HUMIDITY", `${w.humidity}%`, 230, 242, 24],
      ["WIND SPEED", formatSpeed(w.windMph), 44, 315, 24],
      ["UV INDEX", `${w.uv}`, 230, 315, 24],
      ["BAROMETRIC PRESSURE", `${w.pressureHpa} hPa`, 44, 388, 18]
    ];

    metrics.forEach(([label, val, mx, my, valSize]) => {
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(label, mx, my);
      ctx.font = `700 ${valSize}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillText(val, mx, my + 22);
    });

    // Right 5-Day Outlook Card (x: 440..940, y: 75..455)
    drawCard(ctx, 440, 75, 500, 380, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("5-DAY OUTLOOK (COMPACT HA STREAM)", 464, 92);

    const days = w.forecastCsv.split(";").map((entry) => {
      const [day, cond, hi, lo] = entry.split("|");
      return { day: day.toUpperCase(), cond, hiF: Number(hi), loF: Number(lo) };
    });

    const minAll = Math.min(...days.map((d) => d.loF));
    const maxAll = Math.max(...days.map((d) => d.hiF));
    const span = Math.max(1, maxAll - minAll);

    days.forEach((d, idx) => {
      const colX = 452 + idx * 96;
      const cx = colX + 44;

      if (idx > 0) {
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(colX, 125, 1, 310);
      }

      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(d.day, cx, 130);

      drawWeatherIcon(ctx, d.cond, cx, 191, 1.0, PALETTE.ink);

      ctx.font = "700 24px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${Math.round(Number(formatTempNum(d.hiF, 0)))}°`, cx, 232);

      // Sharp vertical temperature range bar
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 5.5, 272.5, 11, 95);
      const yTop = 274 + Math.round(((maxAll - d.hiF) / span) * 76);
      const yBot = 274 + Math.round(((maxAll - d.loF) / span) * 76) + 16;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(cx - 4, yTop, 8, Math.max(14, yBot - yTop));

      ctx.font = "400 18px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${Math.round(Number(formatTempNum(d.loF, 0)))}°`, cx, 382);
    });
    ctx.textAlign = "left";
  }

  function renderTab2Climate() {
    // Left 2x2 Room Grid (x: 20..580, y: 75..455)
    const roomPositions = [
      { x: 20, y: 75 },
      { x: 310, y: 75 },
      { x: 20, y: 270 },
      { x: 310, y: 270 }
    ];

    state.rooms.forEach((room, idx) => {
      const pos = roomPositions[idx];
      drawCard(ctx, pos.x, pos.y, 270, 185, false, 2);

      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(room.name, pos.x + 18, pos.y + 16);

      ctx.font = "700 36px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${formatTempNum(room.tempF, 1)}°`, pos.x + 18, pos.y + 54);

      if (room.isEspresso) {
        ctx.font = "400 18px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText("Decent DE1Pro Head", pos.x + 18, pos.y + 114);
        const brewState = room.tempF > 175 ? "BREW TEMP READY" : "STANDBY / WARMING";
        ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(brewState, pos.x + 18, pos.y + 148);
      } else {
        ctx.font = "400 18px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(`Humidity: ${room.hum}%`, pos.x + 18, pos.y + 114);
        const comfort = (room.tempF >= 67 && room.tempF <= 74 && room.hum >= 35 && room.hum <= 55)
          ? "OPTIMAL COMFORT"
          : "CHECK ZONE";
        ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(comfort, pos.x + 18, pos.y + 148);
      }
    });

    // Right HVAC & Air Quality Panel (x: 600..940, y: 75..455)
    drawCard(ctx, 600, 75, 340, 380, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("MAIN HVAC THERMOSTAT", 622, 92);

    const hvacMode = state.hvac.modes[state.hvac.modeIndex];
    const diff = state.hvac.targetTempF - state.hvac.currentTempF;
    const hvacAction = hvacMode === "off"
      ? "idle"
      : diff > 0 && (hvacMode === "heat" || hvacMode === "auto")
        ? "heating"
        : diff < 0 && (hvacMode === "cool" || hvacMode === "auto")
          ? "cooling"
          : "idle";

    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Mode: ${hvacMode} (${hvacAction})`, 622, 122);

    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("CURRENT", 622, 165);
    ctx.font = "700 36px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(formatTemp(state.hvac.currentTempF, 0), 622, 188);

    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("TARGET SETPOINT", 790, 165);
    ctx.font = "700 36px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(formatTemp(state.hvac.targetTempF, 0), 790, 188);

    // Interactive [-] and [+] Touch Buttons (matching touch_navigation.yaml hitboxes)
    drawCard(ctx, 625, 295, 85, 60, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 36px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("-", 667, 307);

    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("ADJUST", 770, 315);

    drawCard(ctx, 830, 295, 85, 60, false, 2);
    ctx.font = "700 36px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("+", 872, 307);

    // Indoor Air Quality (CO2 ppm & AQI) at bottom of right panel
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(622, 372, 296, 1);

    ctx.textAlign = "left";
    ctx.font = "700 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`CO2: ${state.hvac.co2Ppm} ppm`, 622, 386);
    ctx.fillText(`AQI: ${state.hvac.aqi}`, 810, 386);

    ctx.font = "400 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Indoor Air Quality: GOOD  •  Ventilation Normal", 622, 418);
  }

  function renderTab3Power() {
    const soc = computeLipoSoc(state.lipoVoltage);
    const charging = isChargingActive();

    // Row 1: Compact Power Mode Selector Buttons (y: 66..142, height 76px)
    const modeButtons = [
      { x: 20, idx: 0, title: "1. ALWAYS ONLINE", sub: "Modem Sleep • Use for OTA" },
      { x: 335, idx: 1, title: "2. ADAPTIVE HYBRID", sub: "Day Live • Night/Low Sleep" },
      { x: 650, idx: 2, title: "3. MAX BATTERY", sub: "15m Timer + Touch Wake" }
    ];

    modeButtons.forEach((btn) => {
      const sel = state.powerModeIndex === btn.idx;
      drawCard(ctx, btn.x, 66, 290, 76, sel, 2);
      const fg = sel ? PALETTE.paper : PALETTE.ink;

      ctx.fillStyle = fg;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.font = "700 16px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(btn.title, btn.x + 14, 78);

      ctx.textAlign = "right";
      ctx.font = "700 12px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(sel ? "ACTIVE" : "SELECT", btn.x + 276, 80);

      ctx.textAlign = "left";
      ctx.font = "400 13.5px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(btn.sub, btn.x + 14, 110);
    });

    // Main Left Card (x: 20, y: 152, w: 605, h: 312)
    drawCard(ctx, 20, 152, 605, 312, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("1S LIPO STATE OF CHARGE (SoC) CURVE & EST. RUNTIME", 38, 164);

    // Left graph area (gx = 58, gy = 194, gw = 310, gh = 160)
    const gx = 58;
    const gy = 194;
    const gw = 310;
    const gh = 160;

    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);

    const vToX = (v) => gx + ((Math.max(3.30, Math.min(4.20, v)) - 3.30) / 0.90) * gw;
    const sToY = (s) => gy + gh - (Math.max(0, Math.min(100, s)) / 100) * gh;

    // Y-axis reference lines & labels (100%, 50%, 0%)
    [
      [100, "100%", gy],
      [50, "50%", gy + gh / 2],
      [0, "0%", gy + gh]
    ].forEach(([pct, label, py]) => {
      if (pct === 50) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = PALETTE.g10;
        ctx.beginPath();
        ctx.moveTo(gx, py);
        ctx.lineTo(gx + gw, py);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "400 11px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = pct === 100 ? "top" : pct === 0 ? "bottom" : "middle";
      ctx.fillText(label, gx - 5, py);
    });

    // X-axis voltage ticks & labels below chart (y = gy + gh + 6)
    ctx.textBaseline = "top";
    ctx.font = "400 12px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = PALETTE.ink;
    [3.3, 3.6, 3.9, 4.2].forEach((v) => {
      const tx = vToX(v);
      ctx.beginPath();
      ctx.moveTo(tx, gy + gh);
      ctx.lineTo(tx, gy + gh + 4);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(`${v.toFixed(1)}V`, tx, gy + gh + 6);
    });

    // Vertical dashed markers: 3.32V critical & 3.77V (35% Hybrid)
    const drawVMarker = (v, label, textY) => {
      const mx = vToX(v);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = PALETTE.g04;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, gy);
      ctx.lineTo(mx, gy + gh);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = PALETTE.g04;
      ctx.font = "700 10.5px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, mx + 3, textY);
    };
    drawVMarker(3.32, "3.32V", gy + 4);
    drawVMarker(3.77, "3.77V (35%)", gy + 18);

    // 11-point piecewise linear LiPo curve (3.30V..4.20V)
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

    // Live operating point dot + outer ring + label
    const curX = vToX(state.lipoVoltage);
    const curY = sToY(soc);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(curX, curY, 8, 0, Math.PI * 2);
    ctx.stroke();

    const pointLabel = `${state.lipoVoltage.toFixed(2)}V (${soc}%)`;
    ctx.font = "700 12px 'Segoe UI', Roboto, sans-serif";
    const lblW = ctx.measureText(pointLabel).width;
    const lblX = Math.max(gx + 4, Math.min(gx + gw - lblW - 4, curX - lblW / 2));
    const lblY = curY - 24 >= gy + 4 ? curY - 24 : curY + 12;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(lblX - 2, lblY - 1, lblW + 4, 15);
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(pointLabel, lblX, lblY);

    // Right column (x: 388..610, y: 192..365): Live Runtime Calculator by Mode
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(378, 194, 1, 178);
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`RUNTIME @ ${soc}% SoC`, 388, 192);

    const socFrac = Math.max(0, Math.min(1, soc / 100));
    const hrsMode0 = 120.0 * socFrac;
    const daysMode0 = 5.0 * socFrac;
    const daysMode1 = 30.0 * socFrac;
    const daysMode2 = 120.0 * socFrac;

    const runtimeModes = [
      {
        idx: 0,
        name: "ALWAYS ONLINE",
        timeStr: hrsMode0 < 48 ? `${Math.round(hrsMode0)} hrs` : `${daysMode0.toFixed(1)} days`,
        avgDraw: "~18mA"
      },
      {
        idx: 1,
        name: "ADAPTIVE HYBRID",
        timeStr: `${Math.round(daysMode1)} days`,
        avgDraw: "~1.2mA"
      },
      {
        idx: 2,
        name: "MAX BATTERY",
        timeStr: `${Math.round(daysMode2)} days`,
        avgDraw: "~0.35mA"
      }
    ];

    runtimeModes.forEach((rm, i) => {
      const ry = 218 + i * 50;
      const isAct = state.powerModeIndex === rm.idx;
      ctx.fillStyle = PALETTE.ink;
      ctx.font = "700 13.5px 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(rm.name, 388, ry);

      ctx.textAlign = "right";
      ctx.fillText(rm.timeStr, 607, ry);

      // Mini progress bar scaled by current SoC
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(388.5, ry + 20.5, 141, 9);
      const fillW = Math.max(0, Math.round(socFrac * 138));
      if (fillW > 0) {
        ctx.fillStyle = isAct ? PALETTE.ink : PALETTE.g04;
        ctx.fillRect(390, ry + 22, fillW, 6);
      }

      ctx.fillStyle = PALETTE.ink;
      ctx.font = isAct ? "700 13px 'Segoe UI', Roboto, sans-serif" : "400 13px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(isAct ? "[ACTIVE]" : rm.avgDraw, 607, ry + 17);
    });

    // Bottom summary strip inside Left Card (y: 384..452)
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(38, 384, 569, 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "400 13.5px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(
      `Cell: ${state.lipoVoltage.toFixed(2)}V  •  SoC: ${soc}%  •  Cutoff: 3.32V  •  Hybrid Shift: <=35% (3.77V)`,
      38,
      394
    );
    ctx.font = "700 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Tip: Select '1. ALWAYS ONLINE' when pushing wireless OTA firmware updates.", 38, 420);

    // Main Right Card: LiPo Telemetry & Diagnostics (x: 650, y: 152, w: 290, h: 240)
    drawCard(ctx, 650, 152, 290, 240, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 14px 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("LIPO TELEMETRY (GPIO14)", 668, 164);

    ctx.font = "700 24px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${state.lipoVoltage.toFixed(2)} V  (${soc}%)`, 668, 188);

    // SoC Progress Bar (x: 668, y: 222, w: 254, h: 18)
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(668.5, 222.5, 253, 17);
    const barW = Math.max(0, Math.min(250, Math.round((soc / 100) * 250)));
    if (barW > 0) {
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(670, 224, barW, 14);
    }

    const qStart = String(state.quietStartHour).padStart(2, "0");
    const qEnd = String(state.quietEndHour).padStart(2, "0");
    const totalRefreshes = state.fullRefreshCount + state.partialRefreshCount;

    ctx.font = "700 13.5px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`State: ${charging ? "USB-C CHARGING" : "1S LIPO DISCHARGING"}`, 668, 250);
    ctx.font = "400 13.5px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Wake: ${state.wakeCause}`, 668, 274);
    ctx.fillText(`Wi-Fi: ${state.wifiRssi} dBm  •  Up: ${state.uptimeSeconds}s`, 668, 298);
    ctx.fillText(`Quiet Hours: ${qStart}:00 - ${qEnd}:00`, 668, 322);
    ctx.fillText(`EPD Refreshes: ${totalRefreshes} cycles`, 668, 346);

    // Bottom-Right Compact Action Buttons (y: 402..464, height 62px)
    drawCard(ctx, 650, 402, 138, 62, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "700 16px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("[ CLEAN ]", 719, 414);
    ctx.font = "400 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Anti-Ghosting", 719, 438);

    drawCard(ctx, 802, 402, 138, 62, false, 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "700 16px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("[ SLEEP ]", 871, 414);
    ctx.font = "400 13px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Deep Sleep Now", 871, 438);
    ctx.textAlign = "left";
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
    state.lastTouch = { x, y };
    if (hit) {
      logEvent("touch", "GT911", `Touch (x=${x}, y=${y}) -> hitbox: ${hit.id}`);
      hit.action(ev);
    } else {
      logEvent("touch", "GT911", `Touch (x=${x}, y=${y}) -> no active hitbox (sleep timer reset)`);
      renderAll();
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
