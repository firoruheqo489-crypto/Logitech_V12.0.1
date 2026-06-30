from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path

import pdfplumber

RESULT_TEMPLATE = {
    "name": None,
    "filename": None,
    "machine": None,
    "test_date": None,
    "rated_flux_lm": None,
    "luminaire_flux_lm": None,
    "beam_lumens_lm": None,
    "beam_efficiency_percent": None,
    "field_lumens_lm": None,
    "field_efficiency_percent": None,
    "tested_power_w": None,
    "luminaire_eer_lm_per_w": None,
    "max_candela_cd": None,
    "max_candela_angle_h": None,
    "max_candela_angle_v": None,
    "tested_voltage_v": None,
    "tested_current_a": None,
    "tested_pf": None,
    "beam_angle_v_deg": None,
    "beam_angle_h_deg": None,
    "field_angle_v_deg": None,
    "field_angle_h_deg": None,
    "erp_phiuse_lm": None,
    "irf_percent": None,
    "plane_max_illuminance_lx": None,
    "plane_max_position_h": None,
    "plane_max_position_v": None,
    "space_max_illuminance_lx": None,
    "space_max_angle_deg": None,
    "plane_max_intensity_cd": None,
    "plane_max_intensity_angle_deg": None,
    "attenuation_slots": [],
    "raw_pages": [],
}


def normalize_text(text: str) -> str:
    normalized = text.replace("\u3000", " ")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{2,}", "\n", normalized)
    return normalized.strip()


def extract_pages(pdf_path: Path) -> list[str]:
    page_texts: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            page_texts.append(normalize_text(page_text))
    return page_texts


def extract_optional_float(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1))


def extract_optional_string(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def parse_attenuation_slots(page_text: str) -> list[dict[str, float | str]]:
    slots: list[dict[str, float | str]] = []
    pattern = re.compile(
        r"(?:(\d+(?:\.\d+)?)m)\s+([\d.]+)lx\s+([\d.]+)lx\s+([\d.]+)m",
        re.IGNORECASE,
    )
    for height, center_lx, average_lx, diameter_m in pattern.findall(page_text):
        slots.append(
            {
                "height": f"{height}m",
                "centerLux": float(center_lx),
                "averageLux": float(average_lx),
                "diameter": float(diameter_m),
            }
        )
    return slots


def parse_darkroom_report_text(page_texts: list[str]) -> dict[str, object]:
    result = copy.deepcopy(RESULT_TEMPLATE)
    result["raw_pages"] = page_texts

    if not page_texts:
        return result

    page1 = page_texts[0]
    page9 = page_texts[8] if len(page_texts) >= 9 else ""
    page11 = page_texts[10] if len(page_texts) >= 11 else ""
    page12 = page_texts[11] if len(page_texts) >= 12 else ""

    result["filename"] = extract_optional_string(page1, r"Photometric Filename:([^\n]+)")
    result["name"] = extract_optional_string(page1, r"Luminary Name:\s*(.+?)\s+Lum\.")
    result["test_date"] = extract_optional_string(page1, r"Test Date:\s*([0-9/]+)")
    result["machine"] = extract_optional_string(page1, r"Test Machine:([^\n]+)")

    result["rated_flux_lm"] = extract_optional_float(page1, r"Rated Flux\(lm\):\s*([\d.]+)")
    result["luminaire_flux_lm"] = extract_optional_float(page1, r"Luminary Flux\(lm\):\s*([\d.]+)")
    result["beam_lumens_lm"] = extract_optional_float(page1, r"Beam Lumens\(lm\):\s*([\d.]+)")
    result["beam_efficiency_percent"] = extract_optional_float(page1, r"Beam Efficiency\(%\):\s*([\d.]+)")
    result["field_lumens_lm"] = extract_optional_float(page1, r"Field Lumens\(lm\):\s*([\d.]+)")
    result["field_efficiency_percent"] = extract_optional_float(page1, r"Field Efficiency\(%\):\s*([\d.]+)")
    result["tested_power_w"] = extract_optional_float(page1, r"Tested Power\(W\):\s*([\d.]+)")
    result["luminaire_eer_lm_per_w"] = extract_optional_float(page1, r"Luminary EER\(lm/W\):\s*([\d.]+)")
    result["max_candela_cd"] = extract_optional_float(page1, r"Max\.Candela\(cd\):\s*([\d.]+)")

    max_angle_match = re.search(r"Max Cand@Ang\.\(°\):\s*B=([\d.]+)\s*β=([\d.]+)", page1, re.IGNORECASE)
    if max_angle_match:
        result["max_candela_angle_h"] = float(max_angle_match.group(1))
        result["max_candela_angle_v"] = float(max_angle_match.group(2))

    electrics_match = re.search(r"Tested Electrics\(V,A,pf\):\s*([\d.]+),([\d.]+),([\d.]+)", page1, re.IGNORECASE)
    if electrics_match:
        result["tested_voltage_v"] = float(electrics_match.group(1))
        result["tested_current_a"] = float(electrics_match.group(2))
        result["tested_pf"] = float(electrics_match.group(3))

    beam_angle_match = re.search(r"Beam Angle\(50%\)\(V,H\):\s*([\d.]+)\(°\),([\d.]+)\(°\)", page1, re.IGNORECASE)
    if beam_angle_match:
        result["beam_angle_v_deg"] = float(beam_angle_match.group(1))
        result["beam_angle_h_deg"] = float(beam_angle_match.group(2))

    field_angle_match = re.search(r"Field Angle\(10%\)\(V,H\):\s*([\d.]+)\(°\),([\d.]+)\(°\)", page1, re.IGNORECASE)
    if field_angle_match:
        result["field_angle_v_deg"] = float(field_angle_match.group(1))
        result["field_angle_h_deg"] = float(field_angle_match.group(2))

    result["erp_phiuse_lm"] = extract_optional_float(page1, r"ErP φuse\(120°\):\s*([\d.]+)lm")
    result["irf_percent"] = extract_optional_float(page1, r"IRF\(%\):\s*([\d.]+)")

    result["plane_max_illuminance_lx"] = extract_optional_float(page9, r"Working Plane Maximum Illuminance\(lx\):\s*([\d.]+)")
    plane_position_match = re.search(r"Working Plane Maximum Illuminance Position\(d/h\):H\s*([\d.]+)\s*V([\d.]+)", page9, re.IGNORECASE)
    if plane_position_match:
        result["plane_max_position_h"] = float(plane_position_match.group(1))
        result["plane_max_position_v"] = float(plane_position_match.group(2))

    result["space_max_illuminance_lx"] = extract_optional_float(page11, r"Space Plane Maximum Illuminance and @Angle:\s*([\d.]+)lx")
    result["space_max_angle_deg"] = extract_optional_float(page11, r"Space Plane Maximum Illuminance and @Angle:\s*[\d.]+lx,([\d.]+)deg")
    result["plane_max_intensity_cd"] = extract_optional_float(page11, r"Plane Maximum Lighting Intensity and @Angle:\s*([\d.]+)cd")
    result["plane_max_intensity_angle_deg"] = extract_optional_float(page11, r"Plane Maximum Lighting Intensity and @Angle:\s*[\d.]+cd,([\d.]+)eg")

    result["attenuation_slots"] = parse_attenuation_slots(page12)

    return result


def parse_darkroom_report_file(pdf_path: str | Path) -> dict[str, object]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {path.name}")

    return parse_darkroom_report_text(extract_pages(path))


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse darkroom photometric PDF reports into structured telemetry.",
    )
    parser.add_argument("pdf_path", help="Path to the darkroom photometric PDF report.")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON instead of pretty JSON.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    result = parse_darkroom_report_file(args.pdf_path)
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=None if args.compact else 2,
            sort_keys=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
