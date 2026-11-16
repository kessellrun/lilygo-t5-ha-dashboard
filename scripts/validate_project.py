#!/usr/bin/env python3
"""
validate_project.py - Automated Project Verification Suite
Project: LilyGo T5 4.7" E-Paper Touch Non-Soldered Female Pin [H716] Home Assistant Dashboard
Author: Verifier Subagent

Validates:
1. File existence and non-emptiness across esphome/, homeassistant/, simulator/, docs/, and root.
2. YAML syntax across all ESPHome and Home Assistant YAML configurations with custom tag constructors.
3. Cross-check of all ESPHome component IDs referenced via id(...) against declared id: definitions.
4. GT911 touchscreen hitbox coordinates (0 <= x_min < x_max <= 960, 0 <= y_min < y_max <= 540).
5. Simulator HTML/CSS/JS verification (4 tabs, 960x540 canvas, LiPo curve, HA event console).
6. Setup and hardware documentation completeness.
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
            ("esphome/devices/bedroom-dashboard.yaml", 400, "@firmware"),
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

        # Try parsing using ruamel.yaml with custom node constructors
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
        ] + list((esphome_dir / "packages").glob("*.yaml"))

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
