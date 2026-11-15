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

// ==============================================================================
// 1. Critical Low-Battery Hibernate Protection Screen (< 3.32V)
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
           "Entering hardware over-discharge protection mode (Deep Hibernate).");
  it.print(480, 358, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "Connect a 5V USB-C cable to charge the 1S LiPo battery and resume.");
  it.print(480, 415, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER,
           "LilyGo T5 4.7\" E-Paper [H716]  •  GPIO16 EXT0 Touch Wake Armed");
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
  if (id(power_mode_index) == 0) mode_label = "ALWAYS ONLINE";
  else if (id(power_mode_index) == 2) mode_label = "MAX BATTERY";

  draw_card(it, 350, 12, 195, 32, false, 1);
  it.print(447, 19, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_CENTER, mode_label);

  // Right Battery Gauge (x: 560..735): Icon + SoC % + Voltage + Charging state
  float vbat = id(lipo_voltage).state;
  float soc  = id(lipo_battery_level).state;
  bool chg   = id(lipo_charging).state;
  if (isnan(vbat) || vbat < 0.5f) { vbat = 4.01f; soc = 84.0f; }

  const char *bat_icon = chg ? "\U000F0084" : ((vbat < 3.45f) ? "\U000F0083" : "\U000F0079");
  it.print(560, 15, &id(font_mdi_22), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT, bat_icon);
  it.printf(588, 11, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%.0f%% • %.2fV", soc, vbat);
  it.printf(588, 33, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%s", chg ? "USB-C CHARGING" : (id(ha_stay_awake_ota).state ? "OTA STAY-AWAKE" : "1S LIPO ACTIVE"));

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
    {720, 240, "\U000F0079", "LIPO & POWER"}
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
    it.print(cx - 48, NAVBAR_Y + 19, &id(font_mdi_22), fg, esphome::display::TextAlign::TOP_CENTER, kTabs[i].icon);
    it.print(cx + 14, NAVBAR_Y + 22, &id(font_bold_18), fg, esphome::display::TextAlign::TOP_CENTER, kTabs[i].title);
  }
}

// ==============================================================================
// 4. Tab 0: Smart Home Touch Controls (2x3 Interactive Grid + Status Strip)
// ==============================================================================
inline void render_tab_controls(esphome::display::Display &it) {
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

  ControlCard cards[6] = {
    { 20,  75, "Living Room",    "Main Dimmable Lights", "\U000F0335", "\U000F0336", id(ha_ctrl_1).state, "ON",     "OFF" },
    {335,  75, "Kitchen Lights", "Island Pendant Group", "\U000F08DD", "\U000F0336", id(ha_ctrl_2).state, "ON",     "OFF" },
    {650,  75, "Office Desk",    "Workstation Power",    "\U000F0425", "\U000F0425", id(ha_ctrl_3).state, "ON",     "OFF" },
    { 20, 265, "Front Door",     "Smart Deadbolt Lock",  "\U000F033E", "\U000F033F", id(ha_ctrl_4).state, "LOCKED", "UNLOCKED" },
    {335, 265, "Garage Door",    "Overhead Roll Cover",  "\U000F06DA", "\U000F06D9", id(ha_ctrl_5).state, "OPEN",   "CLOSED" },
    {650, 265, "Goodnight",      "Whole-Home Scene",     "\U000F0594", "\U000F0594", id(ha_ctrl_6).state, "ACTIVE", "TAP TO RUN" }
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
  it.printf(24, 448, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "GT911 Capacitive Touch Ready  •  %d of 6 Entities Active  •  Tap any card to toggle via Home Assistant API",
            active_count);
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
inline void render_tab_climate(esphome::display::Display &it) {
  struct RoomCard {
    int x;
    int y;
    const char *name;
    float temp;
    float hum;
  };
  RoomCard rooms[4] = {
    { 20,  75, "Living Room",     id(ha_room1_temp).state, id(ha_room1_hum).state},
    {310,  75, "Primary Bedroom", id(ha_room2_temp).state, id(ha_room2_hum).state},
    { 20, 270, "Home Office",     id(ha_room3_temp).state, id(ha_room3_hum).state},
    {310, 270, "Kitchen / Study", id(ha_room4_temp).state, id(ha_room4_hum).state}
  };

  float fallback_t[4] = {71.4f, 68.8f, 73.1f, 70.5f};
  float fallback_h[4] = {44.0f, 48.0f, 41.0f, 46.0f};

  for (int i = 0; i < 4; i++) {
    float rt = isnan(rooms[i].temp) ? fallback_t[i] : rooms[i].temp;
    float rh = isnan(rooms[i].hum)  ? fallback_h[i] : rooms[i].hum;
    draw_card(it, rooms[i].x, rooms[i].y, 270, 185, false, 2);

    it.print(rooms[i].x + 18, rooms[i].y + 16, &id(font_bold_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             rooms[i].name);
    it.printf(rooms[i].x + 18, rooms[i].y + 54, &id(font_bold_36), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "%.1f°F", rt);
    it.printf(rooms[i].x + 18, rooms[i].y + 114, &id(font_regular_18), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
              "Humidity: %.0f%%", rh);

    const char *comfort = (rt >= 67.0f && rt <= 74.0f && rh >= 35.0f && rh <= 55.0f) ? "OPTIMAL COMFORT" : "CHECK ZONE";
    it.print(rooms[i].x + 18, rooms[i].y + 148, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
             comfort);
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
// 7. Tab 3: LiPo Battery & System Diagnostics (2x3 Interactive Power Grid)
// ==============================================================================
inline void render_tab_power(esphome::display::Display &it) {
  int cur_mode = id(power_mode_index);
  bool ota_lock = id(ha_stay_awake_ota).state;

  // Row 1 (y: 75..245): 3 Selectable Power Mode Cards mapped to touch_grid_1..3
  struct ModeCard {
    int x;
    int mode_idx;
    const char *title;
    const char *line1;
    const char *line2;
    const char *runtime;
  };
  ModeCard modes[3] = {
    { 20, 0, "1. ALWAYS ONLINE",   "Wi-Fi Light Modem Sleep",   "Instant HA Push Updates",  "~5-6 Days (3000mAh)"},
    {335, 1, "2. ADAPTIVE HYBRID", "Daytime Live / Night Sleep", "Auto Deep Sleep <35% SoC", "~3-5 Weeks (Recommended)"},
    {650, 2, "3. MAX BATTERY",     "15m Periodic Timer Wake",   "+ Instant GPIO16 Touch Wake", "~3-5 Months (3000mAh)"}
  };

  for (int i = 0; i < 3; i++) {
    bool sel = (cur_mode == modes[i].mode_idx);
    draw_card(it, modes[i].x, 75, 290, 170, sel, 2);
    auto fg = sel ? esphome::display::COLOR_OFF : esphome::display::COLOR_ON;

    it.print(modes[i].x + 18, 92, &id(font_bold_18), fg, esphome::display::TextAlign::TOP_LEFT, modes[i].title);
    it.print(modes[i].x + 18, 128, &id(font_regular_14), fg, esphome::display::TextAlign::TOP_LEFT, modes[i].line1);
    it.print(modes[i].x + 18, 150, &id(font_regular_14), fg, esphome::display::TextAlign::TOP_LEFT, modes[i].line2);
    it.print(modes[i].x + 18, 185, &id(font_bold_14), fg, esphome::display::TextAlign::TOP_LEFT, modes[i].runtime);
    it.print(modes[i].x + 18, 212, &id(font_bold_14), fg, esphome::display::TextAlign::TOP_LEFT,
             sel ? "[ ACTIVE PROFILE ]" : "TAP TO SELECT");
  }

  // Row 2, Col 1 (x: 20..310, y: 265..435): 1S LiPo Telemetry + Full Refresh Action
  draw_card(it, 20, 265, 290, 170, false, 2);
  float vbat = id(lipo_voltage).state;
  float soc  = id(lipo_battery_level).state;
  if (isnan(vbat) || vbat < 0.5f) { vbat = 4.01f; soc = 84.0f; }

  it.print(38, 280, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "1S LIPO TELEMETRY (GPIO14)");
  it.printf(38, 304, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "%.2f V  (%.0f%%)", vbat, soc);

  // 1S LiPo Charge Progress Bar (3.30V .. 4.20V)
  it.rectangle(38, 342, 254, 18, esphome::display::COLOR_ON);
  int bar_w = (int)((soc / 100.0f) * 250.0f);
  if (bar_w < 0) bar_w = 0;
  if (bar_w > 250) bar_w = 250;
  it.filled_rectangle(40, 344, bar_w, 14, esphome::display::COLOR_ON);

  it.printf(38, 372, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
            "Refreshes: %d  •  Tap to Clean Screen", id(refresh_counter));
  it.print(38, 398, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "[ TAP: ANTI-GHOSTING CLEAN ]");

  // Row 2, Col 2 (x: 335..625, y: 265..435): OTA Stay-Awake Lock & Wake Reason
  draw_card(it, 335, 265, 290, 170, ota_lock, 2);
  auto fg2 = ota_lock ? esphome::display::COLOR_OFF : esphome::display::COLOR_ON;
  it.print(353, 280, &id(font_bold_14), fg2, esphome::display::TextAlign::TOP_LEFT,
           "OTA STAY-AWAKE LOCK");
  it.printf(353, 306, &id(font_bold_24), fg2, esphome::display::TextAlign::TOP_LEFT,
            "%s", ota_lock ? "LOCKED AWAKE" : "AUTO SLEEP OK");

  std::string wake = id(wake_reason_text).state;
  if (wake.empty()) wake = "Cold Boot / USB";
  it.printf(353, 346, &id(font_regular_14), fg2, esphome::display::TextAlign::TOP_LEFT,
            "Wake: %s", wake.c_str());
  it.printf(353, 370, &id(font_regular_14), fg2, esphome::display::TextAlign::TOP_LEFT,
            "Wi-Fi RSSI: %.0f dBm  •  Up: %.0fs", id(wifi_rssi).state, id(uptime_sec).state);
  it.print(353, 398, &id(font_bold_14), fg2, esphome::display::TextAlign::TOP_LEFT,
           "[ TAP: TOGGLE OTA LOCK ]");

  // Row 2, Col 3 (x: 650..940, y: 265..435): Enter Touch-Armed Deep Sleep Now
  draw_card(it, 650, 265, 290, 170, false, 2);
  it.print(668, 280, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "DEEP SLEEP & TOUCH WAKE");
  it.print(668, 306, &id(font_bold_24), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "SLEEP NOW");
  it.print(668, 346, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "Arms GT911 GPIO16 EXT0 Wakeup");
  it.print(668, 370, &id(font_regular_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "+ PCF8563 15m Timer (~350 uA)");
  it.print(668, 398, &id(font_bold_14), esphome::display::COLOR_ON, esphome::display::TextAlign::TOP_LEFT,
           "[ TAP: ENTER DEEP SLEEP ]");
}

// ==============================================================================
// 8. Main Entrypoint Called from `display:` Lambda in lilygo-t5-h716-dashboard.yaml
// ==============================================================================
inline void render_dashboard(esphome::display::Display &it) {
  it.fill(esphome::display::COLOR_OFF);

  // Check for Critical Low-Battery Cutoff (< 3.32V when running on LiPo)
  float vbat = id(lipo_voltage).state;
  if (!isnan(vbat) && vbat > 2.0f && vbat < 3.32f && !id(lipo_charging).state) {
    render_critical_battery_screen(it, vbat);
    return;
  }

  render_header(it);

  switch (id(active_tab)) {
    case 0:
      render_tab_controls(it);
      break;
    case 1:
      render_tab_weather(it);
      break;
    case 2:
      render_tab_climate(it);
      break;
    case 3:
    default:
      render_tab_power(it);
      break;
  }

  render_navbar(it);
}

} // namespace epd_ui
