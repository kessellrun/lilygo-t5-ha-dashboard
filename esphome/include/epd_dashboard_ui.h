#pragma once

#include "esphome.h"
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace epd_ui {

// Screen geometry constants for LilyGo T5 4.7-inch E-Paper [H716] (ED047TC1)
static constexpr int SCREEN_W = 960;
static constexpr int SCREEN_H = 540;
static constexpr int HEADER_H = 56;
static constexpr int NAVBAR_Y = 476;
static constexpr int NAVBAR_H = 64;

// Dynamic labels passed from YAML substitutions:
//   label_ctrl_1..6, label_room1..4, subtitle_ctrl_1..6, type_ctrl_1..6
// The sub_* / type_* fields use default member initializers matching the
// original Living Room layout, so legacy 10-value aggregate initializers
// ({ctrl_1..6, room_1..4}) remain fully backwards compatible.
struct DashboardLabels {
  const char *ctrl_1;
  const char *ctrl_2;
  const char *ctrl_3;
  const char *ctrl_4;
  const char *ctrl_5;
  const char *ctrl_6;
  const char *room_1;
  const char *room_2;
  const char *room_3;
  const char *room_4;
  // Tab 0 card subtitles (subtitle_ctrl_1..6)
  const char *sub_1 = "Home Assistant Scene";
  const char *sub_2 = "Smart Light Group";
  const char *sub_3 = "Home Assistant Scene";
  const char *sub_4 = "Indoor Light Strip";
  const char *sub_5 = "Smart Switch Control";
  const char *sub_6 = "Whole-Home Scene";
  // Tab 0 card types (type_ctrl_1..6): "scene" or "toggle"
  const char *type_1 = "scene";
  const char *type_2 = "toggle";
  const char *type_3 = "scene";
  const char *type_4 = "toggle";
  const char *type_5 = "toggle";
  const char *type_6 = "scene";
};

// Returns true when a Tab 0 card type string is "scene" (null-safe)
inline bool is_scene_type(const char *type) {
  return type != nullptr && strcmp(type, "scene") == 0;
}

// Helper to draw a thick-bordered card with optional inverted active state
inline void draw_card(esphome::display::Display &it, int x, int y, int w, int h, bool inverted = false, int border_px = 2) {
  if (inverted) {
    it.filled_rectangle(x, y, w, h, esphome::display::COLOR_ON);
  } else {
    it.filled_rectangle(x, y, w, h, esphome::display::COLOR_OFF);
    for (int b = 0; b < border_px; b++) {
      it.rectangle(x + b, y + b, w - 2 * b, h - 2 * b, esphome::display::COLOR_ON);
    }
  }
}

// Helper to map Home Assistant weather condition string to MDI UTF-8 glyph
inline const char *weather_condition_to_mdi(const std::string &cond) {
  if (cond.find("partlycloudy") != std::string::npos || cond.find("partly") != std::string::npos)
    return "\U000F0595"; // mdi-weather-partly-cloudy
  if (cond.find("pouring") != std::string::npos)
    return "\U000F0596"; // mdi-weather-pouring
  if (cond.find("rain") != std::string::npos)
    return "\U000F0597"; // mdi-weather-rainy
  if (cond.find("lightning") != std::string::npos || cond.find("thunder") != std::string::npos)
    return "\U000F0593"; // mdi-weather-lightning
  if (cond.find("snow") != std::string::npos || cond.find("sleet") != std::string::npos || cond.find("hail") != std::string::npos)
    return "\U000F0598"; // mdi-weather-snowy
  if (cond.find("wind") != std::string::npos || cond.find("fog") != std::string::npos)
    return "\U000F059D"; // mdi-weather-windy
  if (cond.find("night") != std::string::npos)
    return "\U000F0594"; // mdi-weather-night
  if (cond.find("cloud") != std::string::npos)
    return "\U000F0590"; // mdi-weather-cloudy
  return "\U000F0599";   // mdi-weather-sunny
}

// Helper to format condition string into human-readable title
inline std::string format_condition_label(const std::string &cond) {
  if (cond.empty() || cond == "unknown" || cond == "unavailable") return "Partly Cloudy";
  if (cond == "partlycloudy") return "Partly Cloudy";
  if (cond == "clear-night") return "Clear Night";
  if (cond == "sunny") return "Sunny";
  if (cond == "cloudy") return "Cloudy";
  if (cond == "rainy") return "Rain Showers";
  if (cond == "pouring") return "Heavy Rain";
  if (cond == "lightning" || cond == "lightning-rainy") return "Thunderstorm";
  if (cond == "snowy") return "Snow";
  if (cond == "windy") return "Windy";
  std::string out = cond;
  out[0] = toupper(out[0]);
  return out;
}

// Returns true while the HX6610S is actively pushing charge current
// (rising-voltage latch active, or CV float >= 4.14V). Otherwise a USB-C
// powered panel is shown as "USB-C POWERED" (steady / old or idle cell).
inline bool lipo_charge_active(float vbat) {
  uint32_t latch = id(charging_latch_ms);
  bool latch_active = latch > 0 && (uint32_t)(millis() - latch) < 300000UL;
  return latch_active || (!isnan(vbat) && vbat >= 4.14f);
}

// ==============================================================================
// 1. Critical Low-Battery Hibernate Protection Screen (confirmed < 3.32V)
//    Rendered ONLY when critical_hibernate_latched is set by evaluate_power_state
// ==============================================================================
inline void render_critical_battery_screen(esphome::display::Display &it, float vbat) {
  it.fill(esphome::display::COLOR_OFF);
  draw_card(it, 60, 50, 840, 440, false, 4);

  it.print(480, 125, &id(font_mdi_48), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "\U000F0083");
  it.print(480, 195, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "CRITICAL LIPO BATTERY");
  it.printf(480, 250, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
            "Pack Voltage: %.2f V  (Cutoff Threshold: 3.32 V)", vbat);

  it.line(120, 300, 840, 300, esphome::display::COLOR_ON);

  it.print(480, 325, &id(font_regular_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "Over-discharge protection: 15-minute hibernate (re-checks automatically).");
  it.print(480, 358, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "Connect 5V USB-C power - the panel resumes on its next 15m check.");
  it.print(480, 415, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "LilyGo T5 4.7\" E-Paper [H716]  •  GPIO21 Top Button Wake  •  15m USB-C Auto-Recovery Check");
}

// ==============================================================================
// 2. Top Status Header Bar (y: 0..56)
// ==============================================================================
inline void render_header(esphome::display::Display &it) {
  // Bottom separator line for header
  it.filled_rectangle(0, 0, SCREEN_W, HEADER_H, esphome::display::COLOR_OFF);
  it.line(0, HEADER_H - 1, SCREEN_W, HEADER_H - 1, esphome::display::COLOR_ON);
  it.line(0, HEADER_H - 2, SCREEN_W, HEADER_H - 2, esphome::display::COLOR_ON);

  // Left (x: 16..310): Time & Date from PCF8563 / Home Assistant Time
  auto now = id(rtc_time).now();
  if (now.is_valid()) {
    int hr12 = now.hour % 12;
    if (hr12 == 0) hr12 = 12;
    const char *ampm = (now.hour >= 12) ? "PM" : "AM";
    char time_buf[32];
    snprintf(time_buf, sizeof(time_buf), "%d:%02d %s", hr12, now.minute, ampm);
    it.print(16, 8, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, time_buf);

    char date_buf[32];
    now.strftime(date_buf, sizeof(date_buf), "%a, %b %d");
    it.print(16, 35, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, date_buf);
  } else {
    it.print(16, 10, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "12:00 PM");
    it.print(16, 35, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "Syncing RTC...");
  }

  // Center (x: 315..555): Wi-Fi Icon + Active Power Mode Pill
  float rssi = id(wifi_rssi).state;
  const char *wifi_icon = (!isnan(rssi) && rssi > -95.0f) ? "\U000F05A9" : "\U000F05AA";
  it.print(318, 16, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, wifi_icon);

  const char *mode_label = "ADAPTIVE HYBRID";
  if (id(is_going_to_sleep)) mode_label = "SLEEPING";
  else if (id(power_mode_index) == 0) mode_label = "ALWAYS ONLINE";
  else if (id(power_mode_index) == 2) mode_label = "MAX BATTERY";

  draw_card(it, 350, 12, 195, 32, false, 1);
  it.print(447, 19, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, mode_label);

  // Right Battery Gauge (x: 560..735): Icon + SoC % + Voltage + Charging state
  float vbat = id(lipo_voltage).state;
  float soc  = id(lipo_battery_level).state;
  bool chg   = id(lipo_charging).state;
  bool usb_inferred = id(usb_power_inferred);
  // < 2.80V while running: no cell / tripped PCM, board is on 5V USB-C VBUS
  bool no_cell = !isnan(vbat) && vbat < 2.80f;

  if (no_cell) {
    it.print(560, 15, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "\U000F0425");
    it.print(588, 11, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             "USB-C POWER");
  } else {
    if (isnan(vbat)) { vbat = 4.01f; soc = 84.0f; }
    bool usb_pwr = chg || usb_inferred;
    const char *bat_icon = usb_pwr ? "\U000F0084" : ((vbat < 3.45f) ? "\U000F0083" : "\U000F0079");
    it.print(560, 15, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, bat_icon);
    it.printf(588, 11, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "%.0f%% • %.2fV", soc, vbat);
  }
  if (id(is_going_to_sleep)) {
    // Upward arrow pointing directly at the top-edge physical wake button above the dot (x=632)
    it.filled_triangle(632, 1, 624, 10, 640, 10, esphome::display::COLOR_ON);
  }
  const char *pwr_label = "1S LIPO ACTIVE";
  if (no_cell) {
    pwr_label = "NO LIPO CELL";
  } else if (chg || usb_inferred) {
    pwr_label = (!usb_inferred && lipo_charge_active(vbat)) ? "USB-C CHARGING" : "USB-C POWERED";
  } else if (id(power_mode_index) == 0 || id(ha_stay_awake_ota).state) {
    pwr_label = "OTA / ALWAYS ON";
  }
  it.printf(588, 33, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%s", pwr_label);

  // Header Quick Button 1: [REFRESH] (x: 740..845, y: 8..48)
  draw_card(it, 740, 8, 105, 40, false, 2);
  it.print(752, 17, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "\U000F0450");
  it.print(780, 20, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "CLEAN");

  // Header Quick Button 2: [SLEEP / MODE] (x: 846..955, y: 8..48)
  draw_card(it, 846, 8, 104, 40, false, 2);
  it.print(856, 17, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "\U000F04B2");
  it.print(884, 20, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "MODE");
}

// ==============================================================================
// 3. Bottom 4-Tab Touch Navigation Bar (y: 476..540)
// ==============================================================================
inline void render_navbar(esphome::display::Display &it) {
  it.line(0, NAVBAR_Y, SCREEN_W, NAVBAR_Y, esphome::display::COLOR_ON);
  it.line(0, NAVBAR_Y + 1, SCREEN_W, NAVBAR_Y + 1, esphome::display::COLOR_ON);

  struct TabItem {
    int x;
    int w;
    const char *icon;
    const char *title;
  };
  static const TabItem kTabs[4] = {
    {  0, 240, "\U000F07D0", "CONTROLS"},
    {240, 240, "\U000F0595", "WEATHER"},
    {480, 240, "\U000F050F", "CLIMATE"},
    {720, 240, "\U000F0079", "POWER"}
  };

  int cur_tab = id(active_tab);
  for (int i = 0; i < 4; i++) {
    bool active = (cur_tab == i);
    if (active) {
      it.filled_rectangle(kTabs[i].x, NAVBAR_Y + 2, kTabs[i].w, NAVBAR_H - 2, esphome::display::COLOR_ON);
    } else {
      it.filled_rectangle(kTabs[i].x, NAVBAR_Y + 2, kTabs[i].w, NAVBAR_H - 2, esphome::display::COLOR_OFF);
      if (i > 0) {
        it.line(kTabs[i].x, NAVBAR_Y + 2, kTabs[i].x, SCREEN_H, esphome::display::COLOR_ON);
      }
    }
    auto fg = active ? esphome::display::COLOR_OFF : esphome::display::COLOR_ON;
    int cx = kTabs[i].x + kTabs[i].w / 2;
    int icon_x = (i == 3) ? (cx - 42) : (cx - 54);
    int text_x = cx + 12;
    it.print(icon_x, NAVBAR_Y + 19, &id(font_mdi_22), fg, esphome::display::TextAlign::TOP_CENTER, kTabs[i].icon);
    it.print(text_x, NAVBAR_Y + 22, &id(font_bold_18), fg, esphome::display::TextAlign::TOP_CENTER, kTabs[i].title);
  }
}

// ==============================================================================
// 4. Tab 0: Smart Home Touch Controls (2x3 Interactive Grid + Status Strip)
// ==============================================================================
inline void render_tab_controls(esphome::display::Display &it, const DashboardLabels &labels) {
  struct ControlCard {
    int x;
    int y;
    const char *title;
    const char *subtitle;
    const char *icon_on;
    const char *icon_off;
    bool state;
    const char *state_on_label;
    const char *state_off_label;
  };

  // Per-card scene/toggle type drives the ACTIVE / TAP TO RUN vs ON / OFF labels
  const bool is_scene[6] = {
    is_scene_type(labels.type_1), is_scene_type(labels.type_2), is_scene_type(labels.type_3),
    is_scene_type(labels.type_4), is_scene_type(labels.type_5), is_scene_type(labels.type_6)
  };

  ControlCard cards[6] = {
    { 20,  75, labels.ctrl_1, labels.sub_1, "\U000F07D0", "\U000F07D0", id(ctrl_1_state), is_scene[0] ? "ACTIVE" : "ON", is_scene[0] ? "TAP TO RUN" : "OFF" },
    {335,  75, labels.ctrl_2, labels.sub_2, "\U000F08DD", "\U000F0336", id(ctrl_2_state), is_scene[1] ? "ACTIVE" : "ON", is_scene[1] ? "TAP TO RUN" : "OFF" },
    {650,  75, labels.ctrl_3, labels.sub_3, "\U000F0335", "\U000F0336", id(ctrl_3_state), is_scene[2] ? "ACTIVE" : "ON", is_scene[2] ? "TAP TO RUN" : "OFF" },
    { 20, 265, labels.ctrl_4, labels.sub_4, "\U000F0335", "\U000F0336", id(ctrl_4_state), is_scene[3] ? "ACTIVE" : "ON", is_scene[3] ? "TAP TO RUN" : "OFF" },
    {335, 265, labels.ctrl_5, labels.sub_5, "\U000F0425", "\U000F0425", id(ctrl_5_state), is_scene[4] ? "ACTIVE" : "ON", is_scene[4] ? "TAP TO RUN" : "OFF" },
    {650, 265, labels.ctrl_6, labels.sub_6, "\U000F0594", "\U000F0594", id(ctrl_6_state), is_scene[5] ? "ACTIVE" : "ON", is_scene[5] ? "TAP TO RUN" : "OFF" }
  };

  int active_count = 0;
  for (int i = 0; i < 6; i++) {
    bool is_on = cards[i].state;
    if (is_on) active_count++;
    draw_card(it, cards[i].x, cards[i].y, 290, 170, is_on, 2);

    auto fg = is_on ? esphome::display::COLOR_OFF : esphome::display::COLOR_ON;
    const char *ico = is_on ? cards[i].icon_on : cards[i].icon_off;
    const char *st_txt = is_on ? cards[i].state_on_label : cards[i].state_off_label;

    it.print(cards[i].x + 22, cards[i].y + 22, &id(font_mdi_32), fg, esphome::display::TextAlign::TOP_LEFT, ico);
    it.print(cards[i].x + 268, cards[i].y + 26, &id(font_bold_18), fg, esphome::display::TextAlign::TOP_RIGHT, st_txt);

    it.print(cards[i].x + 22, cards[i].y + 92, &id(font_bold_24), fg, esphome::display::TextAlign::TOP_LEFT, cards[i].title);
    it.print(cards[i].x + 22, cards[i].y + 128, &id(font_regular_14), fg, esphome::display::TextAlign::TOP_LEFT, cards[i].subtitle);
  }

  // Bottom Status Strip (y: 444..470)
  if (id(last_touch_x) >= 0 && id(last_touch_y) >= 0) {
    it.printf(24, 448, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "GT911 Touch Ready (Last Tap: X=%d, Y=%d)  •  %d of 6 Entities Active  •  Tap any card to toggle",
              id(last_touch_x), id(last_touch_y), active_count);
  } else {
    it.printf(24, 448, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "GT911 Capacitive Touch Ready  •  %d of 6 Entities Active  •  Tap any card to toggle via Home Assistant API",
              active_count);
  }
}

// ==============================================================================
// 5. Tab 1: Weather & 5-Day Forecast (Parses Day|Cond|Hi|Lo;... CSV)
// ==============================================================================
inline void render_tab_weather(esphome::display::Display &it) {
  // Left Hero Card (x: 20..420, y: 75..455)
  draw_card(it, 20, 75, 400, 380, false, 2);

  std::string cond = id(ha_weather_condition).state;
  float temp  = id(ha_weather_temp).state;
  float feels = id(ha_weather_feels_like).state;
  float hum   = id(ha_weather_humidity).state;
  float wind  = id(ha_weather_wind_speed).state;
  float uv    = id(ha_weather_uv).state;
  float press = id(ha_weather_pressure).state;

  if (isnan(temp))  temp  = 72.0f;
  if (isnan(feels)) feels = 70.0f;
  if (isnan(hum))   hum   = 46.0f;
  if (isnan(wind))  wind  = 8.4f;
  if (isnan(uv))    uv    = 5.0f;
  if (isnan(press)) press = 1016.0f;

  it.print(44, 92, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "OUTDOOR CONDITIONS");
  it.print(52, 130, &id(font_mdi_48), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           weather_condition_to_mdi(cond));
  it.printf(132, 125, &id(font_bold_48), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%.0f°F", temp);
  it.printf(134, 182, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%s", format_condition_label(cond).c_str());

  it.line(44, 224, 396, 224, esphome::display::COLOR_ON);

  // 2x3 Weather Detail Metrics inside Left Hero Card
  it.printf(44, 242, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "FEELS LIKE");
  it.printf(44, 264, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f°F", feels);

  it.printf(230, 242, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "HUMIDITY");
  it.printf(230, 264, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f%%", hum);

  it.printf(44, 315, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "WIND SPEED");
  it.printf(44, 337, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.1f mph", wind);

  it.printf(230, 315, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "UV INDEX");
  it.printf(230, 337, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f", uv);

  it.printf(44, 388, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "BAROMETRIC PRESSURE");
  it.printf(44, 410, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f hPa", press);

  // Right 5-Day Forecast Card (x: 440..940, y: 75..455)
  draw_card(it, 440, 75, 500, 380, false, 2);
  it.print(464, 92, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "5-DAY OUTLOOK (COMPACT HA STREAM)");

  struct ForecastDay {
    std::string day;
    std::string cond;
    int hi;
    int lo;
  };
  ForecastDay days[5] = {
    {"MON", "sunny",        75, 58},
    {"TUE", "partlycloudy", 73, 56},
    {"WED", "rainy",        66, 52},
    {"THU", "partlycloudy", 70, 54},
    {"FRI", "sunny",        76, 59}
  };

  // Parse compact CSV from Home Assistant: "Day|Cond|Hi|Lo;Day|Cond|Hi|Lo;..."
  std::string csv = id(ha_weather_forecast_csv).state;
  if (!csv.empty() && csv != "unknown" && csv != "unavailable") {
    int idx = 0;
    size_t start = 0;
    while (idx < 5 && start < csv.size()) {
      size_t end = csv.find(';', start);
      if (end == std::string::npos) end = csv.size();
      std::string token = csv.substr(start, end - start);

      size_t p1 = token.find('|');
      size_t p2 = (p1 != std::string::npos) ? token.find('|', p1 + 1) : std::string::npos;
      size_t p3 = (p2 != std::string::npos) ? token.find('|', p2 + 1) : std::string::npos;
      if (p1 != std::string::npos && p2 != std::string::npos && p3 != std::string::npos) {
        days[idx].day  = token.substr(0, p1);
        days[idx].cond = token.substr(p1 + 1, p2 - p1 - 1);
        days[idx].hi   = atoi(token.substr(p2 + 1, p3 - p2 - 1).c_str());
        days[idx].lo   = atoi(token.substr(p3 + 1).c_str());
        idx++;
      }
      start = end + 1;
    }
  }

  for (int i = 0; i < 5; i++) {
    int col_x = 452 + i * 96;
    int cx = col_x + 44;
    if (i > 0) {
      it.line(col_x, 125, col_x, 435, esphome::display::COLOR_ON);
    }
    it.print(cx, 130, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
             days[i].day.c_str());
    it.print(cx, 175, &id(font_mdi_32), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
             weather_condition_to_mdi(days[i].cond));
    it.printf(cx, 232, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
              "%d°", days[i].hi);

    // Visual vertical temperature range bar
    it.rectangle(cx - 6, 272, 12, 96, esphome::display::COLOR_ON);
    it.filled_rectangle(cx - 4, 286, 8, 64, esphome::display::COLOR_ON);

    it.printf(cx, 382, &id(font_regular_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
              "%d°", days[i].lo);
  }
}

// ==============================================================================
// 6. Tab 2: Indoor Climate Matrix (4 Rooms) & HVAC Setpoint Controller
// ==============================================================================
inline void render_tab_climate(esphome::display::Display &it, const DashboardLabels &labels) {
  struct RoomCard {
    int x;
    int y;
    const char *name;
    float temp;
    float hum;
    bool is_espresso;
  };
  RoomCard rooms[4] = {
    { 20,  75, labels.room_1, id(ha_room1_temp).state, id(ha_room1_hum).state, false},
    {310,  75, labels.room_2, id(ha_room2_temp).state, id(ha_room2_hum).state, false},
    { 20, 270, labels.room_3, id(ha_room3_temp).state, id(ha_room3_hum).state, false},
    {310, 270, labels.room_4, id(ha_room4_temp).state, id(ha_room4_hum).state, true}
  };

  float fallback_t[4] = {71.4f, 68.8f, 73.1f, 198.5f};
  float fallback_h[4] = {44.0f, 48.0f, 41.0f, 0.0f};

  for (int i = 0; i < 4; i++) {
    float rt = isnan(rooms[i].temp) ? fallback_t[i] : rooms[i].temp;
    float rh = isnan(rooms[i].hum)  ? fallback_h[i] : rooms[i].hum;
    draw_card(it, rooms[i].x, rooms[i].y, 270, 185, false, 2);

    it.print(rooms[i].x + 18, rooms[i].y + 16, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             rooms[i].name);
    it.printf(rooms[i].x + 18, rooms[i].y + 54, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "%.1f°", rt);

    if (rooms[i].is_espresso) {
      it.print(rooms[i].x + 18, rooms[i].y + 114, &id(font_regular_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
               "Decent DE1Pro Head");
      const char *brew_state = (!isnan(rooms[i].temp) && rooms[i].temp > 175.0f) ? "BREW TEMP READY" : "STANDBY / WARMING";
      it.print(rooms[i].x + 18, rooms[i].y + 148, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
               brew_state);
    } else {
      it.printf(rooms[i].x + 18, rooms[i].y + 114, &id(font_regular_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
                "Humidity: %.0f%%", rh);
      const char *comfort = (rt >= 67.0f && rt <= 74.0f && rh >= 35.0f && rh <= 55.0f) ? "OPTIMAL COMFORT" : "CHECK ZONE";
      it.print(rooms[i].x + 18, rooms[i].y + 148, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
               comfort);
    }
  }

  // Right HVAC & Air Quality Panel (x: 600..940, y: 75..455)
  draw_card(it, 600, 75, 340, 380, false, 2);
  it.print(622, 92, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "MAIN HVAC THERMOSTAT");

  std::string hvac_mode   = id(ha_hvac_mode).state;
  std::string hvac_action = id(ha_hvac_action).state;
  if (hvac_mode.empty() || hvac_mode == "unknown") hvac_mode = "cool";
  if (hvac_action.empty() || hvac_action == "unknown") hvac_action = "idle";

  float cur_t = id(ha_hvac_current_temp).state;
  float tgt_t = id(ha_hvac_target_temp).state;
  if (isnan(cur_t)) cur_t = 71.0f;
  if (isnan(tgt_t)) tgt_t = 70.0f;

  it.printf(622, 122, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Mode: %s (%s)", hvac_mode.c_str(), hvac_action.c_str());

  it.print(622, 165, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "CURRENT");
  it.printf(622, 188, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f°F", cur_t);

  it.print(790, 165, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "TARGET SETPOINT");
  it.printf(790, 188, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, "%.0f°F", tgt_t);

  // Interactive [-] and [+] Touch Buttons (matching touch_navigation.yaml hitboxes)
  draw_card(it, 625, 295, 85, 60, false, 2);
  it.print(667, 307, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "-");

  it.print(770, 315, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "ADJUST");

  draw_card(it, 830, 295, 85, 60, false, 2);
  it.print(872, 307, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "+");

  // Indoor Air Quality (CO2 ppm & AQI) at bottom of right panel
  it.line(622, 372, 918, 372, esphome::display::COLOR_ON);
  float co2 = id(ha_indoor_co2).state;
  float aqi = id(ha_indoor_aqi).state;
  if (isnan(co2)) co2 = 540.0f;
  if (isnan(aqi)) aqi = 18.0f;

  it.printf(622, 386, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "CO2: %.0f ppm", co2);
  it.printf(810, 386, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "AQI: %.0f", aqi);
  it.print(622, 418, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "Indoor Air Quality: GOOD  •  Ventilation Normal");
}

// ==============================================================================
// 7. Tab 3: Power Profiles, 1S LiPo SoC Curve & Runtime Calculator + Telemetry
// ==============================================================================
inline void render_tab_power(esphome::display::Display &it) {
  int cur_mode = id(power_mode_index);
  float vbat = id(lipo_voltage).state;
  float soc  = id(lipo_battery_level).state;
  bool chg   = id(lipo_charging).state;
  bool usb_inferred = id(usb_power_inferred);
  // < 2.80V while running: no cell / tripped PCM, board is on 5V USB-C VBUS
  bool no_cell = !isnan(vbat) && vbat < 2.80f;
  if (isnan(vbat)) { vbat = 4.01f; soc = 84.0f; }
  if (no_cell) soc = 0.0f;

  // 1. Row 1 (y: 66..142, h: 76): 3 Compact Power Mode Selector Buttons
  struct ModeCard {
    int x;
    int mode_idx;
    const char *title;
    const char *subtitle;
  };
  static const ModeCard kModes[3] = {
    { 20, 0, "1. ALWAYS ONLINE",   "Modem Sleep • Use for OTA"},
    {335, 1, "2. ADAPTIVE HYBRID", "Day Live • Night/Low Sleep"},
    {650, 2, "3. MAX BATTERY",     "15m Timer + IO21 Btn Wake"}
  };

  for (int i = 0; i < 3; i++) {
    bool sel = (cur_mode == kModes[i].mode_idx);
    draw_card(it, kModes[i].x, 66, 290, 76, sel, 2);
    auto fg = sel ? esphome::display::COLOR_OFF : esphome::display::COLOR_ON;

    it.print(kModes[i].x + 14, 78, &id(font_bold_18), fg, esphome::display::TextAlign::TOP_LEFT, kModes[i].title);
    it.print(kModes[i].x + 276, 81, &id(font_bold_14), fg, esphome::display::TextAlign::TOP_RIGHT,
             sel ? "ACTIVE" : "SELECT");
    it.print(kModes[i].x + 14, 108, &id(font_regular_14), fg, esphome::display::TextAlign::TOP_LEFT, kModes[i].subtitle);
  }

  // 2. Main Left Card (x: 20, y: 152, w: 605, h: 312):
  //    1S LiPo State of Charge (SoC) Curve & Mode Runtime Comparison
  draw_card(it, 20, 152, 605, 312, false, 2);
  it.print(38, 164, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "1S LIPO STATE OF CHARGE (SoC) CURVE & EST. RUNTIME");

  // --- Left side inside card: 11-Point LiPo Discharge Curve (gx=58, gy=194, gw=310, gh=160) ---
  const int gx = 58;
  const int gy = 194;
  const int gw = 310;
  const int gh = 160;
  it.rectangle(gx, gy, gw, gh, esphome::display::COLOR_ON);

  // Horizontal reference grid line at 50% SoC + Y-axis labels (100%, 50%, 0%)
  for (int dx = gx + 4; dx < gx + gw - 2; dx += 6) {
    it.line(dx, gy + gh / 2, dx + 2, gy + gh / 2, esphome::display::COLOR_ON);
  }
  it.print(gx - 5, gy - 6, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT, "100%");
  it.print(gx - 5, gy + gh / 2 - 7, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT, "50%");
  it.print(gx - 5, gy + gh - 8, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT, "0%");

  // X-axis voltage ticks & labels below chart (y = gy + gh + 6)
  static const float kVoltTicks[4] = {3.30f, 3.60f, 3.90f, 4.20f};
  static const char *kVoltLabels[4] = {"3.3V", "3.6V", "3.9V", "4.2V"};
  for (int t = 0; t < 4; t++) {
    int tx = gx + (int)(((kVoltTicks[t] - 3.30f) / 0.90f) * gw);
    it.line(tx, gy + gh, tx, gy + gh + 4, esphome::display::COLOR_ON);
    it.print(tx, gy + gh + 6, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, kVoltLabels[t]);
  }

  // Vertical dashed threshold lines: 3.32V (Critical Cutoff) and 3.77V (35% Hybrid Sleep Threshold)
  int x_crit = gx + (int)(((3.32f - 3.30f) / 0.90f) * gw);
  int x_hyb  = gx + (int)(((3.77f - 3.30f) / 0.90f) * gw);
  for (int dy = gy + 3; dy < gy + gh - 3; dy += 6) {
    it.line(x_crit, dy, x_crit, dy + 3, esphome::display::COLOR_ON);
    it.line(x_hyb, dy, x_hyb, dy + 3, esphome::display::COLOR_ON);
  }

  // Plot 11-point piecewise linear 1S LiPo discharge curve (3.30V=0% .. 4.20V=100%)
  struct CurvePt { float v; float s; };
  static const CurvePt kCurve[11] = {
    {3.30f,   0.0f},
    {3.61f,  10.0f},
    {3.70f,  20.0f},
    {3.75f,  30.0f},
    {3.79f,  40.0f},
    {3.82f,  50.0f},
    {3.87f,  60.0f},
    {3.92f,  70.0f},
    {3.98f,  80.0f},
    {4.06f,  90.0f},
    {4.20f, 100.0f}
  };
  for (int i = 0; i < 10; i++) {
    int x0 = gx + (int)(((kCurve[i].v - 3.30f) / 0.90f) * gw);
    int y0 = gy + gh - (int)((kCurve[i].s / 100.0f) * gh);
    int x1 = gx + (int)(((kCurve[i + 1].v - 3.30f) / 0.90f) * gw);
    int y1 = gy + gh - (int)((kCurve[i + 1].s / 100.0f) * gh);
    it.line(x0, y0, x1, y1, esphome::display::COLOR_ON);
    it.line(x0, y0 + 1, x1, y1 + 1, esphome::display::COLOR_ON);
  }

  // Live operating point marker on the curve at (vbat, soc)
  float v_clamp = (vbat < 3.30f) ? 3.30f : ((vbat > 4.20f) ? 4.20f : vbat);
  float s_clamp = (soc < 0.0f) ? 0.0f : ((soc > 100.0f) ? 100.0f : soc);
  int cur_x = gx + (int)(((v_clamp - 3.30f) / 0.90f) * gw);
  int cur_y = gy + gh - (int)((s_clamp / 100.0f) * gh);
  it.filled_circle(cur_x, cur_y, 5, esphome::display::COLOR_ON);
  it.circle(cur_x, cur_y, 8, esphome::display::COLOR_ON);

  int lbl_y = (cur_y < gy + 24) ? (cur_y + 8) : (cur_y - 20);
  if (no_cell) {
    it.print(cur_x + 12, lbl_y, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             "NO LIPO CELL");
  } else if (cur_x > gx + gw - 115) {
    it.printf(cur_x - 12, lbl_y, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT,
              "%.2fV (%.0f%%)", vbat, soc);
  } else {
    it.printf(cur_x + 12, lbl_y, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "%.2fV (%.0f%%)", vbat, soc);
  }

  // --- Right side inside card (x: 388..610, y: 192..365): Recorded & Est. Runtime by Mode ---
  it.line(378, 194, 378, 372, esphome::display::COLOR_ON);
  it.printf(388, 192, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "MODE TIME @ %.0f%% SoC", soc);

  float soc_frac = s_clamp / 100.0f;
  float hrs_mode0  = 120.0f * soc_frac;  // Full = 120h (5.0d) on 2500mAh 1S LiPo
  float days_mode0 = 5.0f * soc_frac;
  float days_mode1 = 30.0f * soc_frac;   // Full = 720h (30.0d)
  float days_mode2 = 120.0f * soc_frac;  // Full = 2880h (120.0d)

  char rt0_buf[24];
  if (hrs_mode0 < 48.0f) {
    snprintf(rt0_buf, sizeof(rt0_buf), "Est %.0fh", hrs_mode0);
  } else {
    snprintf(rt0_buf, sizeof(rt0_buf), "Est %.1fd", days_mode0);
  }
  char rt1_buf[24];
  snprintf(rt1_buf, sizeof(rt1_buf), "Est %.0fd", days_mode1);
  char rt2_buf[24];
  snprintf(rt2_buf, sizeof(rt2_buf), "Est %.0fd", days_mode2);

  uint32_t rec_secs[3] = { id(mode_0_sec), id(mode_1_sec), id(mode_2_sec) };
  char rec_bufs[3][28];
  for (int m = 0; m < 3; m++) {
    uint32_t s = rec_secs[m];
    if (s < 3600UL) {
      snprintf(rec_bufs[m], sizeof(rec_bufs[m]), "Rec: %lum", (unsigned long)(s / 60UL));
    } else if (s < 172800UL) {
      snprintf(rec_bufs[m], sizeof(rec_bufs[m]), "Rec: %.1fh", s / 3600.0f);
    } else {
      snprintf(rec_bufs[m], sizeof(rec_bufs[m]), "Rec: %.1fd", s / 86400.0f);
    }
  }

  struct RuntimeRow {
    const char *label;
    const char *val_str;
    const char *rec_str;
  };
  RuntimeRow rows[3] = {
    {"ALWAYS ONLINE",   rt0_buf, rec_bufs[0]},
    {"ADAPTIVE HYBRID", rt1_buf, rec_bufs[1]},
    {"MAX BATTERY",     rt2_buf, rec_bufs[2]}
  };

  for (int m = 0; m < 3; m++) {
    int ry = 218 + m * 50;
    bool is_act = (cur_mode == m);
    it.print(388, ry, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, rows[m].label);
    it.print(607, ry, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT, rows[m].val_str);

    // Mini progress bar scaled by current SoC
    it.rectangle(388, ry + 20, 120, 10, esphome::display::COLOR_ON);
    int mw = (int)(soc_frac * 116.0f);
    if (mw > 0) {
      it.filled_rectangle(390, ry + 22, mw, 6, esphome::display::COLOR_ON);
    }

    it.print(607, ry + 17, is_act ? &id(font_bold_14) : &id(font_regular_14),
             esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_RIGHT, rows[m].rec_str);
  }

  // --- Bottom summary strip inside Left Card (y: 384..452) ---
  it.line(38, 384, 607, 384, esphome::display::COLOR_ON);
  it.printf(38, 394, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Cell: %.2fV  •  SoC: %.0f%%  •  Cutoff: 3.32V  •  Hybrid Shift: <=35%% (3.77V)", vbat, soc);
  it.print(38, 418, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "Tip: Select '1. ALWAYS ONLINE' when pushing wireless OTA firmware updates.");

  // 3. Main Right Card (x: 650, y: 152, w: 290, h: 240): 1S LiPo Telemetry & Diagnostics
  draw_card(it, 650, 152, 290, 240, false, 2);
  it.print(668, 164, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "LIPO TELEMETRY (GPIO14)");
  if (no_cell) {
    it.print(668, 188, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             "USB-C (NO BATT)");
  } else {
    it.printf(668, 188, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "%.2f V  (%.0f%%)", vbat, soc);
  }

  // SoC Progress Bar (x: 668, y: 222, w: 254, h: 18)
  it.rectangle(668, 222, 254, 18, esphome::display::COLOR_ON);
  int bar_w = (int)(soc_frac * 250.0f);
  if (bar_w > 0) {
    it.filled_rectangle(670, 224, bar_w, 14, esphome::display::COLOR_ON);
  }

  std::string wake = id(wake_reason_text).state;
  if (wake.empty()) wake = "Cold Boot / USB";
  float rssi_val = isnan(id(wifi_rssi).state) ? -58.0f : id(wifi_rssi).state;
  float up_val   = isnan(id(uptime_sec).state) ? (millis() / 1000.0f) : id(uptime_sec).state;
  int q_start    = !isnan(id(ha_quiet_start).state) ? (int)id(ha_quiet_start).state : 23;
  int q_end      = !isnan(id(ha_quiet_end).state)   ? (int)id(ha_quiet_end).state   : 6;

  const char *state_txt = "1S LIPO DISCHARGING";
  if (no_cell) {
    state_txt = "USB-C DIRECT POWER";
  } else if (chg || usb_inferred) {
    state_txt = (!usb_inferred && lipo_charge_active(vbat)) ? "USB-C CHARGING" : "USB-C POWERED";
  } else if (id(ha_stay_awake_ota).state) {
    state_txt = "OTA LOCKED (HA)";
  }
  it.printf(668, 250, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "State: %s", state_txt);
  it.printf(668, 274, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Wake: %s", wake.c_str());
  it.printf(668, 298, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Wi-Fi: %.0f dBm  •  Up: %.0fs", rssi_val, up_val);
  it.printf(668, 322, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Quiet Hours: %02d:00 - %02d:00", q_start, q_end);
  it.printf(668, 346, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "EPD Refreshes: %d cycles", id(refresh_counter));

  // 4. Bottom-Right Compact Action Buttons (y: 402..464, h: 62)
  draw_card(it, 650, 402, 138, 62, false, 2);
  it.print(719, 412, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "[ CLEAN ]");
  it.print(719, 434, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "Anti-Ghosting");

  draw_card(it, 802, 402, 138, 62, false, 2);
  it.print(871, 412, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "[ SLEEP ]");
  it.print(871, 434, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, "Deep Sleep Now");
}

// ==============================================================================
// 8. Main Entrypoint Called from `display:` Lambda in lilygo-t5-h716-dashboard.yaml
// ==============================================================================
inline void render_dashboard(esphome::display::Display &it, const DashboardLabels &labels) {
  it.fill(esphome::display::COLOR_OFF);

  // Critical Battery Hibernate lock screen: ONLY once a critical discharge has been
  // confirmed (~60s window) by evaluate_power_state — never on raw ADC dips
  float vbat = id(lipo_voltage).state;
  if (id(critical_hibernate_latched)) {
    render_critical_battery_screen(it, vbat);
    return;
  }

  render_header(it);

  switch (id(active_tab)) {
    case 0:
      render_tab_controls(it, labels);
      break;
    case 1:
      render_tab_weather(it);
      break;
    case 2:
      render_tab_climate(it, labels);
      break;
    case 3:
    default:
      render_tab_power(it);
      break;
  }

  render_navbar(it);

  // Sleep/Wake callout banner with upward pointer aligned to the top-edge button above the dot (x=632)
  if (id(is_going_to_sleep)) {
    draw_card(it, 452, 56, 360, 26, true, 1);
    it.filled_triangle(632, 48, 624, 56, 640, 56, esphome::display::COLOR_ON);
    it.print(632, 62, &id(font_bold_14), esphome::display::COLOR_OFF, esphome::display::TextAlign::TOP_CENTER,
             "SLEEPING • PRESS TOP BUTTON TO WAKE");
  }
}

// Backwards-compatible overload with default labels
inline void render_dashboard(esphome::display::Display &it) {
  DashboardLabels defaults = {
    "Living Room TV", "Kitchen Lights", "Evening Lights",
    "Bookshelf Lights", "Wave Light", "Goodnight",
    "Living Room", "Hallway", "Home Office", "DE1+ Grouphead"
  };
  render_dashboard(it, defaults);
}

} // namespace epd_ui
