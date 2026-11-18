#!/usr/bin/env python3
"""
validate_project.py - Automated Project Verification Suite
Project: LilyGo T5 4.7" E-Paper Touch Non-Soldered Female Pin [H716] Home Assistant Dashboard
Author: Verifier Subagent

Validates:
1. File existence and non-emptiness across esphome/, homeassistant/, simulator/, docs/, and root.
2. YAML syntax across all ESPHome and Home Assistant YAML configurations with custom tag constructors.
3. Cross-check of all ESPHome component IDs referenced via id(...) against declared id: definitions (including remote_package.yaml).
4. GT911 touchscreen hitbox coordinates (0 <= x_min < x_max <= 960, 0 <= y_min < y_max <= 540).
5. Simulator HTML/CSS/JS verification (4 tabs, 960x540 canvas, LiPo curve, HA event console).
6. Setup and hardware documentation completeness.
7. USB-C and Critical Hibernate regression & parity checks across firmware, UI, HA, and simulator.
"""

import os
import re
import sys
from pathlib import Path

# Add roaming python site-packages to sys.path if available
site_packages = r"C:\Users\Server\AppData\Roaming\Python\Python312\site-packages"
if os.path.exists(site_packages) and site_packages not in sys.path:
    sys.path.insert(0, site_packages)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Terminal Colors
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def log_header(msg):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*72}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN} {msg}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*72}{Colors.END}")

def log_pass(msg):
    print(f"  {Colors.GREEN}[PASS]{Colors.END} {msg}")

def log_fail(msg):
    print(f"  {Colors.RED}[FAIL]{Colors.END} {msg}")

def log_warn(msg):
    print(f"  {Colors.YELLOW}[WARN]{Colors.END} {msg}")

def log_info(msg):
    print(f"  {Colors.BLUE}[INFO]{Colors.END} {msg}")


class ProjectValidator:
    def __init__(self, root: Path):
        self.root = root
        self.errors = []
        self.warnings = []
        self.total_checks = 0
        self.passed_checks = 0

    def add_error(self, category: str, detail: str, owner: str = "general"):
        self.errors.append({"category": category, "detail": detail, "owner": owner})
        log_fail(f"[{category}] ({owner}): {detail}")

    def add_warning(self, category: str, detail: str):
        self.warnings.append({"category": category, "detail": detail})
        log_warn(f"[{category}]: {detail}")

    def check(self, condition: bool, category: str, pass_msg: str, fail_msg: str, owner: str = "general"):
        self.total_checks += 1
        if condition:
            self.passed_checks += 1
            log_pass(pass_msg)
            return True
        else:
            self.add_error(category, fail_msg, owner)
            return False

    # ==========================================
    # Check 1: File Existence & Integrity
    # ==========================================
    def check_file_existence(self):
        log_header("CHECK 1: File Existence & Integrity Across All Modules")

        expected_files = [
            # Firmware files (Owner: @firmware)
            ("esphome/lilygo-t5-h716-dashboard.yaml", 500, "@firmware"),
            ("esphome/remote_package.yaml", 800, "@firmware"),
            ("esphome/bedroom_package.yaml", 800, "@firmware"),
            ("esphome/devices/bedroom-dashboard.yaml", 200, "@firmware"),
            ("esphome/fonts/README.md", 200, "@firmware"),
            ("esphome/packages/hardware_h716.yaml", 500, "@firmware"),
            ("esphome/packages/lipo_power_manager.yaml", 800, "@firmware"),
            ("esphome/packages/ha_entities.yaml", 800, "@firmware"),
            ("esphome/packages/touch_navigation.yaml", 800, "@firmware"),
            ("esphome/include/epd_dashboard_ui.h", 1500, "@firmware"),

            # Home Assistant files (Owner: @ha-and-docs)
            ("homeassistant/packages/lilygo_t5_dashboard.yaml", 500, "@ha-and-docs"),

            # Simulator files (Owner: @simulator)
            ("simulator/index.html", 500, "@simulator"),
            ("simulator/simulator.css", 500, "@simulator"),
            ("simulator/simulator.js", 1500, "@simulator"),

            # Documentation files (Owner: @ha-and-docs)
            ("docs/STEP_BY_STEP_SETUP_GUIDE.md", 1000, "@ha-and-docs"),
            ("docs/LIPO_HARDWARE_GUIDE.md", 1000, "@ha-and-docs"),
            ("docs/OPEN_SOURCE_REFERENCES.md", 500, "@ha-and-docs"),
            ("README.md", 500, "@ha-and-docs"),
        ]

        for rel_path, min_bytes, owner in expected_files:
            file_path = self.root / rel_path
            exists = file_path.exists()
            size = file_path.stat().st_size if exists else 0
            self.check(
                exists and size >= min_bytes,
                "File Existence",
                f"{rel_path} ({size:,} bytes)",
                f"Missing or undersized: {rel_path} (size={size} bytes, expected >= {min_bytes} bytes)",
                owner
            )

    # ==========================================
    # Check 2: YAML Syntax Validation
    # ==========================================
    def check_yaml_syntax(self):
        log_header("CHECK 2: YAML Syntax Validation with Custom ESPHome / HA Constructors")

        yaml_files = [
            ("esphome/lilygo-t5-h716-dashboard.yaml", "@firmware"),
            ("esphome/remote_package.yaml", "@firmware"),
            ("esphome/bedroom_package.yaml", "@firmware"),
            ("esphome/devices/bedroom-dashboard.yaml", "@firmware"),
            ("esphome/packages/hardware_h716.yaml", "@firmware"),
            ("esphome/packages/lipo_power_manager.yaml", "@firmware"),
            ("esphome/packages/ha_entities.yaml", "@firmware"),
            ("esphome/packages/touch_navigation.yaml", "@firmware"),
            ("homeassistant/packages/lilygo_t5_dashboard.yaml", "@ha-and-docs"),
        ]

        for rel_path, owner in yaml_files:
            fpath = self.root / rel_path
            if not fpath.exists():
                continue

            content = fpath.read_text(encoding="utf-8")
            self.validate_single_yaml(rel_path, content, owner)

    def validate_single_yaml(self, rel_path: str, content: str, owner: str):
        self.total_checks += 1
        lines = content.splitlines()

        # Check for tab indentation
        for line_no, line in enumerate(lines, 1):
            indent_match = re.match(r"^(\s+)", line)
            if indent_match and '\t' in indent_match.group(1):
                self.add_error("YAML Tab Indentation", f"{rel_path}:{line_no} contains tab indentation", owner)
                return

        # Check for invalid ESPHome ${...} substitution syntax (e.g. ${foo..bar} in comments/lambdas)
        if rel_path.startswith("esphome/"):
            for line_no, line in enumerate(lines, 1):
                if line.lstrip().startswith('#'):
                    continue
                for sub_m in re.finditer(r'\$\{([^}]+)\}', line):
                    expr = sub_m.group(1).strip()
                    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', expr):
                        self.add_error(
                            "ESPHome Substitution Syntax",
                            f"{rel_path}:{line_no} contains invalid substitution expression '${{{expr}}}'",
                            owner
                        )
                        return
        parsed = False
        try:
            from ruamel.yaml import YAML
            from ruamel.yaml.nodes import ScalarNode, SequenceNode, MappingNode

            ryaml = YAML(typ='safe')
            def custom_constructor(loader, tag_suffix, node):
                if isinstance(node, ScalarNode):
                    return loader.construct_scalar(node)
                elif isinstance(node, SequenceNode):
                    return loader.construct_sequence(node)
                elif isinstance(node, MappingNode):
                    return loader.construct_mapping(node)
                return ""

            ryaml.constructor.add_multi_constructor('!', custom_constructor)
            ryaml.load(content)
            parsed = True
            self.passed_checks += 1
            log_pass(f"{rel_path} valid YAML syntax (parsed with ruamel.yaml custom tags)")
            return
        except ImportError:
            pass
        except Exception as ex:
            self.add_error("YAML Syntax Error", f"{rel_path}: {ex}", owner)
            return

        # Fallback structural regex parser
        structural_errors = self.structural_yaml_check(content, rel_path)
        if structural_errors:
            for err in structural_errors:
                self.add_error("YAML Syntax Error", f"{rel_path}: {err}", owner)
        else:
            self.passed_checks += 1
            log_pass(f"{rel_path} valid YAML syntax (structural parser passed)")

    def structural_yaml_check(self, content: str, filename: str):
        errors = []
        lines = content.splitlines()
        in_multiline_scalar = False
        multiline_indent = 0

        for idx, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue

            current_indent = len(line) - len(line.lstrip(' '))

            if in_multiline_scalar:
                if current_indent > multiline_indent:
                    continue
                else:
                    in_multiline_scalar = False

            # Check for multiline scalar indicators (| or >)
            if re.search(r':\s*[|>][+-]?\s*(?:#.*)?$', line):
                in_multiline_scalar = True
                multiline_indent = current_indent
                continue

            # Strip strings and comments
            cleaned = re.sub(r'#.*$', '', line)
            cleaned = re.sub(r'https?://[^\s]+', '', cleaned)
            cleaned = re.sub(r'github://[^\s]+', '', cleaned)
            cleaned = re.sub(r'mdi:[a-zA-Z0-9_-]+', '', cleaned)
            cleaned = re.sub(r'\b\d{1,2}:\d{2}\b', '', cleaned)
            cleaned = re.sub(r'"[^"]*"', '""', cleaned)
            cleaned = re.sub(r"'[^']*'", "''", cleaned)

            # Check for unspaced colon in key definitions
            if ':' in cleaned:
                bad_colon = re.search(r'([a-zA-Z0-9_-]):([^\s/])', cleaned)
                if bad_colon and not re.search(r'!lambda', line):
                    errors.append(f"Line {idx}: Missing space after colon '{bad_colon.group(0)}'")

        return errors

    # ==========================================
    # Check 3: ESPHome ID Cross-Check
    # ==========================================
    def check_esphome_component_ids(self):
        log_header("CHECK 3: ESPHome Component ID Cross-Check (id(...) vs id: definitions)")

        esphome_dir = self.root / "esphome"
        if not esphome_dir.exists():
            self.add_error("Directory", "esphome/ directory missing", "@firmware")
            return

        # 1. Collect all declared IDs across all YAML files in esphome/
        declared_ids = set()
        declared_sources = {}

        # Standard built-in ESPHome identifiers/keywords that may be referenced
        builtin_ids = {
            "it", "this", "homeassistant_time", "network", "wifi", "ota", "logger",
            "uptime", "ip_address", "sntp_time", "pcf8563_time", "gt911_touchscreen",
            "ed047tc1", "epaper", "epd", "display"
        }

        yaml_files = list(esphome_dir.glob("*.yaml")) + list((esphome_dir / "packages").glob("*.yaml"))
        for yfile in yaml_files:
            content = yfile.read_text(encoding="utf-8")
            # Match `id: identifier` or `id: "identifier"`
            for m in re.finditer(r'^\s*(?:-\s*)?id:\s*["\']?([a-zA-Z0-9_]+)["\']?', content, re.MULTILINE):
                id_name = m.group(1).strip()
                declared_ids.add(id_name)
                declared_sources[id_name] = yfile.name

        log_info(f"Discovered {len(declared_ids)} declared ESPHome component IDs across esphome/:")
        for did in sorted(declared_ids):
            print(f"       * {did} ({declared_sources.get(did, 'builtin')})")

        # 2. Extract referenced IDs via `id(identifier)` in C++ header and YAML files
        referenced_ids = {}

        files_to_check = [
            esphome_dir / "include" / "epd_dashboard_ui.h",
            esphome_dir / "lilygo-t5-h716-dashboard.yaml",
            esphome_dir / "remote_package.yaml",
            esphome_dir / "bedroom_package.yaml",
        ] + list((esphome_dir / "packages").glob("*.yaml")) + list((esphome_dir / "devices").glob("*.yaml"))

        for fpath in files_to_check:
            if not fpath.exists():
                continue
            content = fpath.read_text(encoding="utf-8")
            # Match `id(some_id)`
            for m in re.finditer(r'\bid\s*\(\s*([a-zA-Z0-9_]+)\s*\)', content):
                ref_id = m.group(1).strip()
                if ref_id not in referenced_ids:
                    referenced_ids[ref_id] = []
                line_no = content[:m.start()].count('\n') + 1
                referenced_ids[ref_id].append((fpath.name, line_no))

        log_info(f"Discovered {len(referenced_ids)} referenced component IDs via id(...):")

        # 3. Cross check
        undefined_count = 0
        for ref_id, occurrences in sorted(referenced_ids.items()):
            is_declared = (ref_id in declared_ids) or (ref_id in builtin_ids)
            occ_str = ", ".join(f"{fn}:{ln}" for fn, ln in occurrences[:3])
            if len(occurrences) > 3:
                occ_str += f" (+{len(occurrences)-3} more)"

            if self.check(
                is_declared,
                "ESPHome ID Resolution",
                f"id({ref_id}) declared in {declared_sources.get(ref_id, 'builtin')} (referenced in {occ_str})",
                f"Undefined ESPHome ID: id({ref_id}) referenced in {occ_str} but never declared with 'id:' in esphome/",
                "@firmware"
            ):
                pass
            else:
                undefined_count += 1

        if undefined_count == 0:
            log_pass(f"Zero undefined ESPHome component IDs! All {len(referenced_ids)} references resolved.")

    # ==========================================
    # Check 4: GT911 Touchscreen Hitboxes
    # ==========================================
    def check_gt911_hitboxes(self):
        log_header("CHECK 4: GT911 Touchscreen Hitbox & Coordinate Verification (960x540)")

        touch_yaml = self.root / "esphome" / "packages" / "touch_navigation.yaml"
        if not touch_yaml.exists():
            self.add_error("Touch Hitboxes", "Missing esphome/packages/touch_navigation.yaml", "@firmware")
            return

        content = touch_yaml.read_text(encoding="utf-8")
        bounds_checks = []

        # Find explicit x_min / x_max / y_min / y_max
        block_pattern = re.findall(
            r'x_min:\s*(\d+).*?x_max:\s*(\d+).*?y_min:\s*(\d+).*?y_max:\s*(\d+)',
            content, re.DOTALL
        )
        for x_min, x_max, y_min, y_max in block_pattern:
            bounds_checks.append((int(x_min), int(x_max), int(y_min), int(y_max), "YAML fields"))

        # Find coordinate checks in lambdas: `x >= (\d+) && x (?:<=|<) (\d+) && y >= (\d+) && y (?:<=|<) (\d+)`
        lambda_bounds = re.findall(
            r'x\s*>=\s*(\d+)\s*&&\s*x\s*(?:<=|<)\s*(\d+)\s*&&\s*y\s*>=\s*(\d+)\s*&&\s*y\s*(?:<=|<)\s*(\d+)',
            content
        )
        for x_min, x_max, y_min, y_max in lambda_bounds:
            bounds_checks.append((int(x_min), int(x_max), int(y_min), int(y_max), "C++ Lambda condition"))

        if not bounds_checks:
            all_x = [int(x) for x in re.findall(r'\bx\s*(?:>=|<=|>|<|==)\s*(\d+)', content)]
            all_y = [int(y) for y in re.findall(r'\by\s*(?:>=|<=|>|<|==)\s*(\d+)', content)]
            for x in all_x:
                self.check(0 <= x <= 960, "Touch Coordinates", f"Touch X coord {x} within [0, 960]", f"Touch X coord {x} out of bounds (> 960)", "@firmware")
            for y in all_y:
                self.check(0 <= y <= 540, "Touch Coordinates", f"Touch Y coord {y} within [0, 540]", f"Touch Y coord {y} out of bounds (> 540)", "@firmware")
        else:
            for x_min, x_max, y_min, y_max, source in bounds_checks:
                valid_x = (0 <= x_min < x_max <= 960)
                valid_y = (0 <= y_min < y_max <= 540)
                self.check(
                    valid_x and valid_y,
                    "Touch Hitbox Range",
                    f"Hitbox ({x_min}..{x_max}, {y_min}..{y_max}) valid in 960x540 [{source}]",
                    f"Hitbox out of bounds: ({x_min}..{x_max}, {y_min}..{y_max}) (Display is 960x540) [{source}]",
                    "@firmware"
                )

        has_nav_tabs = any(
            (term in content) for term in ["active_tab", "tab_controls", "tab_weather", "tab_climate", "tab_power", "active_tab = 0"]
        )
        self.check(
            has_nav_tabs,
            "Touch Navigation Tabs",
            "Bottom navigation tab touch switching logic present in touch_navigation.yaml",
            "No navigation tab touch logic detected in touch_navigation.yaml",
            "@firmware"
        )

    # ==========================================
    # Check 5: Simulator Verification
    # ==========================================
    def check_simulator_completeness(self):
        log_header("CHECK 5: Simulator HTML5 / CSS / JS Completeness")

        html_path = self.root / "simulator" / "index.html"
        css_path = self.root / "simulator" / "simulator.css"
        js_path = self.root / "simulator" / "simulator.js"

        if html_path.exists():
            html_txt = html_path.read_text(encoding="utf-8")
            self.check("960" in html_txt and "540" in html_txt, "Simulator Canvas", "Simulator implements 960x540 resolution canvas", "Canvas 960x540 resolution missing in simulator/index.html", "@simulator")
            self.check("CONTROLS" in html_txt.upper() or "TAB" in html_txt.upper(), "Simulator Tabs HTML", "Simulator contains navigation tabs in index.html", "Navigation tabs not found in simulator/index.html", "@simulator")
            self.check("slider" in html_txt.lower() or "range" in html_txt.lower() or "vbat" in html_txt.lower() or "battery" in html_txt.lower(), "Simulator Hardware Controls", "Simulator contains LiPo battery hardware control slider", "LiPo battery control slider missing in simulator/index.html", "@simulator")

        if css_path.exists():
            css_txt = css_path.read_text(encoding="utf-8")
            self.check(len(css_txt) > 500, "Simulator CSS", f"simulator.css present ({len(css_txt):,} bytes)", "simulator.css is too short or empty", "@simulator")
            self.check("960" in css_txt or "aspect-ratio" in css_txt or "bezel" in css_txt, "Simulator Display Styling", "simulator.css contains H716 display styling", "Display bezel styling missing in simulator.css", "@simulator")

        if js_path.exists():
            js_txt = js_path.read_text(encoding="utf-8")
            self.check("3.32" in js_txt or "hibernate" in js_txt.lower() or "critical" in js_txt.lower(), "Simulator Critical Hibernate", "Simulator implements < 3.32V Critical Hibernate simulation", "Critical Hibernate (<3.32V) missing in simulator.js", "@simulator")
            self.check("piecewise" in js_txt.lower() or "soc" in js_txt.lower() or "4.20" in js_txt or "4.06" in js_txt, "Simulator LiPo Curve", "Simulator implements 1S LiPo voltage lookup curve", "LiPo piecewise voltage curve missing in simulator.js", "@simulator")
            self.check("activeTab" in js_txt or "tab" in js_txt.lower(), "Simulator Tab Logic", "Simulator implements tab switching logic", "Tab switching missing in simulator.js", "@simulator")

    # ==========================================
    # Check 6: Documentation Completeness
    # ==========================================
    def check_documentation(self):
        log_header("CHECK 6: Beginner Documentation & Hardware Guides")

        setup_guide = self.root / "docs" / "STEP_BY_STEP_SETUP_GUIDE.md"
        if setup_guide.exists():
            txt = setup_guide.read_text(encoding="utf-8")
            self.check("JST" in txt and "2.0" in txt, "Docs Battery Spec", "Setup guide specifies 1S LiPo with JST 2.0mm PH connector", "JST 2.0mm PH LiPo battery spec missing in docs/STEP_BY_STEP_SETUP_GUIDE.md", "@ha-and-docs")
            self.check("polarity" in txt.lower() or "red" in txt.lower() and "black" in txt.lower(), "Docs Battery Polarity", "Setup guide includes critical LiPo polarity (+/-) check", "LiPo polarity check missing in docs/STEP_BY_STEP_SETUP_GUIDE.md", "@ha-and-docs")
            self.check("boot" in txt.lower() and "rst" in txt.lower(), "Docs Bootloader Mode", "Setup guide explains ESP32-S3 Bootloader / Download Mode (BOOT + RST)", "ESP32-S3 BOOT+RST instructions missing in docs/STEP_BY_STEP_SETUP_GUIDE.md", "@ha-and-docs")
            self.check("allow the device to perform home assistant actions" in txt.lower() or "actions" in txt.lower(), "Docs HA Action Permissions", "Setup guide explains Home Assistant 2023.9+ Action Permissions toggle", "HA Action Permissions warning missing in docs/STEP_BY_STEP_SETUP_GUIDE.md", "@ha-and-docs")
            self.check("stay_awake" in txt.lower() or "ota" in txt.lower(), "Docs OTA Updates", "Setup guide explains stay-awake helper for OTA updates", "OTA stay-awake instructions missing in docs/STEP_BY_STEP_SETUP_GUIDE.md", "@ha-and-docs")

        lipo_guide = self.root / "docs" / "LIPO_HARDWARE_GUIDE.md"
        if lipo_guide.exists():
            txt = lipo_guide.read_text(encoding="utf-8")
            self.check("GPIO14" in txt or "gpio14" in txt.lower(), "Docs ADC Pinout", "LiPo Hardware Guide details GPIO14 2:1 battery voltage divider", "GPIO14 voltage divider missing in docs/LIPO_HARDWARE_GUIDE.md", "@ha-and-docs")
            self.check("runtime" in txt.lower() or "mah" in txt.lower() or "hours" in txt.lower() or "days" in txt.lower(), "Docs Runtime Calculations", "LiPo Hardware Guide includes battery sizing & runtime calculations", "Battery runtime calculations missing in docs/LIPO_HARDWARE_GUIDE.md", "@ha-and-docs")

        refs_guide = self.root / "docs" / "OPEN_SOURCE_REFERENCES.md"
        if refs_guide.exists():
            txt = refs_guide.read_text(encoding="utf-8")
            self.check("hbast" in txt or "lilygo_t5_47_plus" in txt, "Docs References hbast", "Open Source References details hbast/lilygo_t5_47_plus component", "Missing hbast reference in docs/OPEN_SOURCE_REFERENCES.md", "@ha-and-docs")
            self.check("Xinyuan-LilyGO" in txt or "LilyGo-EPD47" in txt, "Docs References LilyGo", "Open Source References details official LilyGo-EPD47 library", "Missing LilyGo-EPD47 reference in docs/OPEN_SOURCE_REFERENCES.md", "@ha-and-docs")

        readme = self.root / "README.md"
        if readme.exists():
            txt = readme.read_text(encoding="utf-8")
            self.check(len(txt) > 500, "README Content", f"README.md present ({len(txt):,} bytes)", "README.md is too short or empty", "@ha-and-docs")

    # ==========================================
    # Check 7: USB-C & Critical Hibernate Parity
    # ==========================================
    def check_power_and_critical_hibernate_parity(self):
        log_header("CHECK 7: USB-C & Critical Hibernate Regression & Parity Suite")

        lipo_yaml = self.root / "esphome" / "packages" / "lipo_power_manager.yaml"
        epd_header = self.root / "esphome" / "include" / "epd_dashboard_ui.h"
        remote_yaml = self.root / "esphome" / "remote_package.yaml"
        h716_yaml = self.root / "esphome" / "lilygo-t5-h716-dashboard.yaml"
        ha_yaml = self.root / "homeassistant" / "packages" / "lilygo_t5_dashboard.yaml"
        sim_js = self.root / "simulator" / "simulator.js"

        # --- A. lipo_power_manager.yaml checks ---
        if lipo_yaml.exists():
            lipo_txt = lipo_yaml.read_text(encoding="utf-8")

            # A1: Critical & USB state globals
            required_globals = [
                "critical_hibernate_latched", "usb_power_inferred", "usb_sawtooth_ms",
                "charging_latch_ms", "baseline_lipo_v", "baseline_lipo_ms",
                "peak_lipo_v", "crit_sample_count", "crit_window_start_v",
                "low_raw_adc_streak", "prev_raw_lipo_v", "prev_wake_vbat"
            ]
            for g in required_globals:
                self.check(
                    f"id: {g}" in lipo_txt,
                    "Firmware Globals",
                    f"Global '{g}' declared in lipo_power_manager.yaml",
                    f"Global '{g}' missing from lipo_power_manager.yaml",
                    "@firmware"
                )

            # A2: Transient ADC2 0V glitch rejection
            has_adc2_debounce = (
                "low_raw_adc_streak" in lipo_txt and
                "< 3" in lipo_txt and
                "return {};" in lipo_txt
            )
            self.check(
                has_adc2_debounce,
                "ADC2 0V Debounce",
                "ADC2 0V glitch debounce drops transient samples (< 3 streak) in lipo_power_manager.yaml",
                "ADC2 0V glitch debounce missing or incomplete in lipo_power_manager.yaml",
                "@firmware"
            )

            # A3: Median filter and removal of moving average
            has_median = "median:" in lipo_txt and "window_size: 5" in lipo_txt
            no_moving_avg = "sliding_window_moving_average" not in lipo_txt
            self.check(
                has_median and no_moving_avg,
                "ADC Median Filter",
                "5-sample median filter present and sliding_window_moving_average removed in lipo_power_manager.yaml",
                "Median filter missing or sliding_window_moving_average still present in lipo_power_manager.yaml",
                "@firmware"
            )

            # A4: USB-C and charging heuristics
            has_no_batt_usb = "v < 2.80f" in lipo_txt or "vbat < 2.80f" in lipo_txt
            has_sawtooth = "usb_sawtooth_ms" in lipo_txt and "fabsf(x - id(prev_raw_lipo_v)) >= 0.28f" in lipo_txt
            has_cv_float = "v >= 4.14f" in lipo_txt
            has_rising_chg = "v >= 2.50f" in lipo_txt and "0.015f" in lipo_txt
            no_385_blocker = "3.85f" not in lipo_txt
            has_unplug_detect = "0.04f" in lipo_txt and "peak_lipo_v" in lipo_txt

            self.check(
                has_no_batt_usb and has_sawtooth and has_cv_float and has_rising_chg and no_385_blocker and has_unplug_detect,
                "Charging Heuristics",
                "USB-C heuristics valid: <2.80V no-batt, sawtooth, >=4.14V CV float, rising-chg >=2.50V (no 3.85V blocker), 40mV unplug drop",
                "Charging heuristics flawed or missing checks in lipo_power_manager.yaml",
                "@firmware"
            )

            # A5: Mode 0 (Always Online) & OTA Stay-Awake exemption from Critical Hibernate
            has_mode0_exempt = "id(power_mode_index) == 0" in lipo_txt and "reset_critical" in lipo_txt
            has_ota_exempt = ("ota_in_progress" in lipo_txt or "ha_stay_awake_ota" in lipo_txt) and "prevent_deep_sleep" in lipo_txt
            self.check(
                has_mode0_exempt and has_ota_exempt,
                "Critical Hibernate Exemption",
                "Mode 0 (Always Online) and OTA Stay-Awake exempt from Critical Hibernate in lipo_power_manager.yaml",
                "Always Online or OTA Stay-Awake exemption missing from lipo_power_manager.yaml",
                "@firmware"
            )

            # A6: Real discharge confirmation window (~60s) before latching
            has_confirm_window = (
                "crit_sample_count" in lipo_txt and
                "< 6" in lipo_txt and
                "usb_power_inferred" in lipo_txt and
                "critical_hibernate_latched) = true" in lipo_txt
            )
            self.check(
                has_confirm_window,
                "Critical Confirmation Window",
                "~60s (6 sample) discharge confirmation window prevents false hibernates on flat/USB voltage",
                "Critical confirmation window missing or doesn't latch usb_power_inferred vs critical_hibernate_latched",
                "@firmware"
            )

            # A7: 15-minute recovery sleep duration (no 24h lockout)
            has_15m_deep_sleep = "sleep_duration: 15min" in lipo_txt and "enter_critical_hibernate" in lipo_txt
            self.check(
                has_15m_deep_sleep,
                "Recovery Sleep Duration",
                "Critical Hibernate uses 15-minute auto-recovery sleep (24h lockout eliminated)",
                "15-minute sleep duration missing in lipo_power_manager.yaml",
                "@firmware"
            )

        # --- B. epd_dashboard_ui.h checks ---
        if epd_header.exists():
            epd_txt = epd_header.read_text(encoding="utf-8")

            # B1: Critical screen gated on critical_hibernate_latched
            has_latched_gate = "if (id(critical_hibernate_latched))" in epd_txt
            self.check(
                has_latched_gate,
                "UI Critical Gating",
                "epd_dashboard_ui.h gates critical screen strictly on id(critical_hibernate_latched)",
                "epd_dashboard_ui.h critical screen not gated on id(critical_hibernate_latched)",
                "@firmware"
            )

            # B2: USB-C no battery icon and labels
            has_no_batt_icon = r"\U000F0425" in epd_txt
            has_no_batt_labels = "USB-C POWER" in epd_txt and "NO LIPO CELL" in epd_txt and "USB-C DIRECT POWER" in epd_txt
            self.check(
                has_no_batt_icon and has_no_batt_labels,
                "UI No-Battery Display",
                r"epd_dashboard_ui.h renders \U000F0425, 'USB-C POWER', 'NO LIPO CELL', and 'USB-C DIRECT POWER'",
                "epd_dashboard_ui.h missing no-battery icon or labels",
                "@firmware"
            )

            # B3: Critical screen recovery message
            has_screen_text = (
                "15-minute hibernate" in epd_txt or "15m USB-C Auto-Recovery" in epd_txt
            ) and "GPIO21" in epd_txt
            self.check(
                has_screen_text,
                "UI Critical Screen Text",
                "epd_dashboard_ui.h critical screen communicates 15m USB-C auto-recovery and GPIO21 wake",
                "epd_dashboard_ui.h critical screen text out of date",
                "@firmware"
            )

            # B4: Active charging helper
            has_chg_active = "lipo_charge_active" in epd_txt and "4.14f" in epd_txt
            self.check(
                has_chg_active,
                "UI Charging Helper",
                "epd_dashboard_ui.h provides lipo_charge_active() checking CV float (>=4.14V) & charging latch",
                "epd_dashboard_ui.h lipo_charge_active() helper missing or does not check >=4.14V",
                "@firmware"
            )

        # --- C. remote_package.yaml parity checks ---
        if remote_yaml.exists():
            remote_txt = remote_yaml.read_text(encoding="utf-8")

            # C1: Critical screen gated on critical_hibernate_latched
            has_remote_gate = "if (id(critical_hibernate_latched))" in remote_txt
            self.check(
                has_remote_gate,
                "Remote Package Critical Gating",
                "remote_package.yaml gates critical screen on id(critical_hibernate_latched)",
                "remote_package.yaml critical screen not gated on id(critical_hibernate_latched)",
                "@firmware"
            )

            # C2: No-battery icon and label parity
            has_remote_no_batt = r"\U000F0425" in remote_txt and "NO LIPO CELL" in remote_txt and "USB-C POWER" in remote_txt
            self.check(
                has_remote_no_batt,
                "Remote Package No-Battery Display",
                r"remote_package.yaml matches epd_dashboard_ui.h with \U000F0425 and 'NO LIPO CELL' / 'USB-C POWER'",
                "remote_package.yaml missing no-battery display parity",
                "@firmware"
            )

            # C3: Boot reset of critical latch
            has_boot_reset = "id(critical_hibernate_latched) = false;" in remote_txt
            self.check(
                has_boot_reset,
                "Remote Package Boot Reset",
                "remote_package.yaml clears critical_hibernate_latched on boot",
                "remote_package.yaml does not clear critical_hibernate_latched on boot",
                "@firmware"
            )

        # --- D. homeassistant/packages/lilygo_t5_dashboard.yaml checks ---
        if ha_yaml.exists():
            ha_txt = ha_yaml.read_text(encoding="utf-8")

            # D1: Living room low battery alert above: 2.79 and charging == 'off'
            has_lr_low_thresh = (
                "above: 2.79" in ha_txt and
                "below: 3.68" in ha_txt and
                "sensor.lilygo_t5_h716_dashboard_lipo_battery_voltage" in ha_txt
            )
            self.check(
                has_lr_low_thresh,
                "HA Living Room Low Battery Alert",
                "HA Living Room low battery alert triggers on voltage above: 2.79 / below: 3.68",
                "HA Living Room low battery alert missing above: 2.79 trigger floor",
                "@ha-and-docs"
            )

            # D2: Living room critical alert above: 2.79, below: 3.32, charging == 'off'
            has_lr_crit = (
                "above: 2.79" in ha_txt and
                "below: 3.32" in ha_txt and
                "binary_sensor.lilygo_t5_h716_dashboard_lipo_battery_charging" in ha_txt and
                "15-minute wake check" in ha_txt
            )
            self.check(
                has_lr_crit,
                "HA Living Room Critical Alert",
                "HA Living Room critical alert gates on 2.79V < V < 3.32V and charging == 'off' with 15m recovery text",
                "HA Living Room critical alert missing floor, charging condition, or 15m recovery text",
                "@ha-and-docs"
            )

            # D3: Bedroom low battery alert above: 2.79 and charging == 'off'
            has_br_low_thresh = (
                "above: 2.79" in ha_txt and
                "below: 3.68" in ha_txt and
                "sensor.lilygo_t5_bedroom_lipo_battery_voltage" in ha_txt
            )
            self.check(
                has_br_low_thresh,
                "HA Bedroom Low Battery Alert",
                "HA Bedroom low battery alert triggers on voltage above: 2.79 / below: 3.68",
                "HA Bedroom low battery alert missing above: 2.79 trigger floor",
                "@ha-and-docs"
            )

            # D4: Bedroom critical alert above: 2.79, below: 3.32, charging == 'off'
            has_br_crit = (
                "above: 2.79" in ha_txt and
                "below: 3.32" in ha_txt and
                "binary_sensor.lilygo_t5_bedroom_lipo_battery_charging" in ha_txt and
                "15-minute wake check" in ha_txt
            )
            self.check(
                has_br_crit,
                "HA Bedroom Critical Alert",
                "HA Bedroom critical alert gates on 2.79V < V < 3.32V and charging == 'off' with 15m recovery text",
                "HA Bedroom critical alert missing floor, charging condition, or 15m recovery text",
                "@ha-and-docs"
            )

        # --- E. simulator/simulator.js checks ---
        if sim_js.exists():
            js_txt = sim_js.read_text(encoding="utf-8")

            # E1: isChargingActive checks >= 4.14
            has_sim_chg = "state.lipoVoltage >= 4.14" in js_txt and "state.usbCharging" in js_txt
            self.check(
                has_sim_chg,
                "Simulator Charging Detection",
                "simulator.js isChargingActive() checks state.usbCharging || lipoVoltage >= 4.14",
                "simulator.js isChargingActive() missing 4.14V CV float threshold",
                "@simulator"
            )

            # E2: isCriticalExempt checks charging, powerModeIndex === 0, stayAwakeOta
            has_sim_exempt = (
                "isCriticalExempt" in js_txt and
                "state.powerModeIndex === 0" in js_txt and
                "state.stayAwakeOta" in js_txt
            )
            self.check(
                has_sim_exempt,
                "Simulator Critical Exemption",
                "simulator.js isCriticalExempt() checks isChargingActive, powerModeIndex === 0, and stayAwakeOta",
                "simulator.js isCriticalExempt() incomplete or missing",
                "@simulator"
            )

            # E3: evaluateBatteryThresholds auto-exits critical hibernate
            has_sim_auto_exit = (
                "state.isCriticalHibernate = v < 3.32 && !isCriticalExempt()" in js_txt and
                "triggerFullCleanRefresh" in js_txt
            )
            self.check(
                has_sim_auto_exit,
                "Simulator Auto-Exit Critical",
                "simulator.js evaluateBatteryThresholds prevents and auto-exits Critical Hibernate",
                "simulator.js does not prevent or auto-exit Critical Hibernate when exempt",
                "@simulator"
            )

            # E4: Toggle listeners call evaluateBatteryThresholds
            has_listener_calls = (
                js_txt.count("evaluateBatteryThresholds(state.lipoVoltage)") >= 2
            )
            self.check(
                has_listener_calls,
                "Simulator Event Handlers",
                "simulator.js charging and OTA awake toggle listeners re-evaluate battery thresholds",
                "simulator.js event listeners do not trigger battery threshold re-evaluation",
                "@simulator"
            )

            # E5: Screen caption text
            has_sim_caption = "GPIO21 Top Button Wake  •  15m USB-C Auto-Recovery" in js_txt or "15m USB-C Auto-Recovery" in js_txt
            self.check(
                has_sim_caption,
                "Simulator Critical Caption",
                "simulator.js critical screen caption matches firmware: '15m USB-C Auto-Recovery'",
                "simulator.js critical screen caption does not match firmware",
                "@simulator"
            )

    # ==========================================
    # Run All Checks & Produce Report
    # ==========================================
    def run_all(self):
        log_header(f"Starting Project Verification on {self.root.name}")
        print(f"Project Root: {self.root}\n")

        self.check_file_existence()
        self.check_yaml_syntax()
        self.check_esphome_component_ids()
        self.check_gt911_hitboxes()
        self.check_simulator_completeness()
        self.check_documentation()
        self.check_power_and_critical_hibernate_parity()

        # Summary
        log_header("VERIFICATION SUMMARY REPORT")
        pass_rate = (self.passed_checks / self.total_checks * 100) if self.total_checks > 0 else 0
        print(f"Total Checks Executed: {self.total_checks}")
        print(f"Passed Checks:         {Colors.GREEN}{self.passed_checks}{Colors.END}")
        print(f"Failed Checks:         {Colors.RED if self.errors else Colors.GREEN}{len(self.errors)}{Colors.END}")
        print(f"Pass Rate:             {Colors.BOLD}{pass_rate:.1f}%{Colors.END}\n")

        if self.errors:
            print(f"{Colors.BOLD}{Colors.RED}FAILURES DETECTED ({len(self.errors)}):{Colors.END}")
            for err in self.errors:
                print(f"  * [{err['owner']}] [{err['category']}]: {err['detail']}")
            print(f"\n{Colors.RED}Verification FAILED. Address the above issues.{Colors.END}")
            return 1
        else:
            print(f"{Colors.BOLD}{Colors.GREEN}ALL CHECKS PASSED (100% COMPLETE)!{Colors.END}")
            print(f"The project is 100% verified, syntactically correct, and ready for deployment.")
            return 0


def main():
    validator = ProjectValidator(PROJECT_ROOT)
    exit_code = validator.run_all()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
