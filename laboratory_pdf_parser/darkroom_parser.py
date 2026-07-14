from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path

import pdfplumber

SIGNED_NUMBER = r"[-+]?\d+(?:\.\d+)?"

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
    "erp_phiuse_angle_deg": None,
    "irf_percent": None,
    "mounting_height_m": None,
    "plane_max_illuminance_lx": None,
    "plane_max_position_h": None,
    "plane_max_position_v": None,
    "space_max_illuminance_lx": None,
    "space_max_angle_deg": None,
    "plane_max_intensity_cd": None,
    "plane_max_intensity_angle_deg": None,
    "attenuation_slots": [],
    "candela_plane": [],
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


def extract_optional_float(text: str, pattern: str, group: int = 1) -> float | None:
    try:
        match = re.search(pattern, text, re.IGNORECASE)
    except re.error:
        return None
    if not match:
        return None
    return float(match.group(group))


def extract_optional_string(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def find_page(page_texts: list[str], *needles: str) -> str:
    lowered_needles = [needle.lower() for needle in needles]
    for page_text in page_texts:
        lowered_page = page_text.lower()
        if all(needle in lowered_page for needle in lowered_needles):
            return page_text
    return ""


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


def parse_legacy_candela_plane(page_texts: list[str]) -> list[dict[str, float]]:
    samples: dict[float, float] = {}

    for page_text in page_texts:
        if "Candela Tabulation" not in page_text:
            continue

        header_angles: list[float] = []
        for line in page_text.splitlines():
            stripped = line.strip()
            if stripped.startswith("V/H"):
                header_angles = [
                    float(value)
                    for value in re.findall(r"[β尾]\s*(" + SIGNED_NUMBER + r")", stripped)
                ]
                continue

            row_match = re.match(r"^B0\.0\s+(.+)$", stripped)
            if not row_match or not header_angles:
                continue

            values = [float(value) for value in re.findall(SIGNED_NUMBER, row_match.group(1))]
            for angle, cd in zip(header_angles, values):
                samples[angle] = cd

    return [
        {"theta": angle, "cd": cd}
        for angle, cd in sorted(samples.items(), key=lambda item: item[0])
    ]


def parse_candela_plane(page_texts: list[str]) -> list[dict[str, float]]:
    b_plane_samples: dict[float, float] = {}
    c_plane_samples: dict[float, float] = {}

    for page_text in page_texts:
        if "Candela Tabulation" not in page_text:
            continue

        header_angles: list[float] = []
        c0_column_index: int | None = None
        for line in page_text.splitlines():
            stripped = line.strip()
            if stripped.startswith("V/H"):
                header_angles = [float(value) for value in re.findall(SIGNED_NUMBER, stripped)]
                tokens = stripped.split()[1:]
                for index, token in enumerate(tokens):
                    if re.match(r"^C\s*0(?:\.0+)?$", token, re.IGNORECASE):
                        c0_column_index = index
                        break
                continue

            b_row_match = re.match(r"^B0\.0\s+(.+)$", stripped)
            if b_row_match and header_angles:
                values = [float(value) for value in re.findall(SIGNED_NUMBER, b_row_match.group(1))]
                for angle, cd in zip(header_angles, values):
                    b_plane_samples[angle] = cd
                continue

            gamma_match = re.match(
                r"^(?:γ|gama|gamma)\s*(" + SIGNED_NUMBER + r")\s+(.+)$",
                stripped,
                re.IGNORECASE,
            )
            if gamma_match and c0_column_index is not None:
                row_values = [float(value) for value in re.findall(SIGNED_NUMBER, gamma_match.group(2))]
                if c0_column_index < len(row_values):
                    c_plane_samples[float(gamma_match.group(1))] = row_values[c0_column_index]

    samples = c_plane_samples or b_plane_samples
    return [
        {"theta": angle, "cd": cd}
        for angle, cd in sorted(samples.items(), key=lambda item: item[0])
    ]


def parse_c_plane_angles(page_texts: list[str]) -> dict[str, float | None]:
    result: dict[str, float | None] = {
        "beam_v": None,
        "beam_h": None,
        "field_v": None,
        "field_h": None,
    }
    c0_pattern = re.compile(
        r"C0\.0_180\.0\s*:\s*(" + SIGNED_NUMBER + r")\s+(" + SIGNED_NUMBER + r")",
        re.IGNORECASE,
    )
    c90_pattern = re.compile(
        r"C90\.0_270\.0\s*:\s*(" + SIGNED_NUMBER + r")\s+(" + SIGNED_NUMBER + r")",
        re.IGNORECASE,
    )

    for page_text in page_texts:
        c0_match = c0_pattern.search(page_text)
        if c0_match:
            result["beam_v"] = float(c0_match.group(1))
            result["field_v"] = float(c0_match.group(2))

        c90_match = c90_pattern.search(page_text)
        if c90_match:
            result["beam_h"] = float(c90_match.group(1))
            result["field_h"] = float(c90_match.group(2))

        if all(value is not None for value in result.values()):
            break

    return result


def parse_darkroom_report_text(page_texts: list[str]) -> dict[str, object]:
    result = copy.deepcopy(RESULT_TEMPLATE)
    result["raw_pages"] = page_texts

    if not page_texts:
        return result

    page1 = page_texts[0]
    legacy_working_plane_page = page_texts[8] if len(page_texts) >= 9 else ""
    legacy_space_plane_page = page_texts[10] if len(page_texts) >= 11 else ""
    legacy_attenuation_page = page_texts[11] if len(page_texts) >= 12 else ""
    working_plane_page = find_page(page_texts, "Working Plane Maximum Illuminance") or legacy_working_plane_page
    space_plane_page = find_page(page_texts, "Space Plane Maximum Illuminance") or legacy_space_plane_page
    attenuation_page = find_page(page_texts, "Illuminance-Distance") or legacy_attenuation_page

    result["filename"] = extract_optional_string(page1, r"Photometric Filename:([^\n]+)")
    result["name"] = extract_optional_string(page1, r"Luminary Name:\s*(.+?)\s+Lum\.")
    result["test_date"] = extract_optional_string(page1, r"Test Date:\s*([0-9/]+)")
    result["machine"] = extract_optional_string(page1, r"Test Machine:([^\n]+)")

    result["rated_flux_lm"] = extract_optional_float(page1, r"Rated Flux\(lm\):\s*(" + SIGNED_NUMBER + r")")
    result["luminaire_flux_lm"] = extract_optional_float(page1, r"Luminary Flux\(lm\):\s*(" + SIGNED_NUMBER + r")")
    result["beam_lumens_lm"] = extract_optional_float(page1, r"Beam Lumens\(lm\):\s*(" + SIGNED_NUMBER + r")")
    result["beam_efficiency_percent"] = extract_optional_float(page1, r"Beam Efficiency\(%\):\s*(" + SIGNED_NUMBER + r")")
    result["field_lumens_lm"] = extract_optional_float(page1, r"Field Lumens\(lm\):\s*(" + SIGNED_NUMBER + r")")
    result["field_efficiency_percent"] = extract_optional_float(page1, r"Field Efficiency\(%\):\s*(" + SIGNED_NUMBER + r")")
    result["tested_power_w"] = extract_optional_float(page1, r"Tested Power\(W\):\s*(" + SIGNED_NUMBER + r")")
    result["luminaire_eer_lm_per_w"] = extract_optional_float(page1, r"Luminary EER\(lm/W\):\s*(" + SIGNED_NUMBER + r")")
    result["max_candela_cd"] = extract_optional_float(page1, r"Max\.Candela\(cd\):\s*(" + SIGNED_NUMBER + r")")

    max_angle_match = re.search(
        r"Max\s*Cand@Ang\.\(\s*(?:°|掳|deg)?\s*\):\s*B\s*=\s*("
        + SIGNED_NUMBER
        + r")\s*(?:β|尾|beta)\s*=\s*("
        + SIGNED_NUMBER
        + r")",
        page1,
        re.IGNORECASE,
    )
    if max_angle_match:
        result["max_candela_angle_h"] = float(max_angle_match.group(1))
        result["max_candela_angle_v"] = float(max_angle_match.group(2))
    else:
        c_gamma_match = re.search(
            r"Max\s*Cand@Ang\.\([^)]+\):\s*C\s*=\s*("
            + SIGNED_NUMBER
            + r")\s*γ\s*=\s*("
            + SIGNED_NUMBER
            + r")",
            page1,
            re.IGNORECASE,
        )
        if c_gamma_match:
            result["max_candela_angle_h"] = float(c_gamma_match.group(1))
            result["max_candela_angle_v"] = float(c_gamma_match.group(2))

    electrics_match = re.search(
        r"Tested Electrics\(V,A,pf\):\s*("
        + SIGNED_NUMBER
        + r"),("
        + SIGNED_NUMBER
        + r"),("
        + SIGNED_NUMBER
        + r")",
        page1,
        re.IGNORECASE,
    )
    if electrics_match:
        result["tested_voltage_v"] = float(electrics_match.group(1))
        result["tested_current_a"] = float(electrics_match.group(2))
        result["tested_pf"] = float(electrics_match.group(3))

    beam_angle_match = re.search(
        r"Beam\s*Angle\(50%\)\(V,H\):\s*("
        + SIGNED_NUMBER
        + r")\((?:°|掳|deg)?\),\s*("
        + SIGNED_NUMBER
        + r")\((?:°|掳|deg)?\)",
        page1,
        re.IGNORECASE,
    )
    if beam_angle_match:
        result["beam_angle_v_deg"] = float(beam_angle_match.group(1))
        result["beam_angle_h_deg"] = float(beam_angle_match.group(2))

    field_angle_match = re.search(
        r"Field\s*Angle\(10%\)\(V,H\):\s*("
        + SIGNED_NUMBER
        + r")\((?:°|掳|deg)?\),\s*("
        + SIGNED_NUMBER
        + r")\((?:°|掳|deg)?\)",
        page1,
        re.IGNORECASE,
    )
    if field_angle_match:
        result["field_angle_v_deg"] = float(field_angle_match.group(1))
        result["field_angle_h_deg"] = float(field_angle_match.group(2))

    c_plane_angles = parse_c_plane_angles(page_texts)
    if result["beam_angle_v_deg"] is None:
        result["beam_angle_v_deg"] = c_plane_angles["beam_v"]
    if result["beam_angle_h_deg"] is None:
        result["beam_angle_h_deg"] = c_plane_angles["beam_h"]
    if result["field_angle_v_deg"] is None:
        result["field_angle_v_deg"] = c_plane_angles["field_v"]
    if result["field_angle_h_deg"] is None:
        result["field_angle_h_deg"] = c_plane_angles["field_h"]

    erp_match = re.search(
        r"ErP\s*(?:φ|Φ|蠁|Phi|phi)?use\(\s*("
        + SIGNED_NUMBER
        + r")\s*(?:°|掳|deg)?\s*\):\s*("
        + SIGNED_NUMBER
        + r")\s*lm",
        page1,
        re.IGNORECASE,
    )
    if erp_match:
        result["erp_phiuse_angle_deg"] = float(erp_match.group(1))
        result["erp_phiuse_lm"] = float(erp_match.group(2))
    result["irf_percent"] = extract_optional_float(page1, r"IRF\(%\):\s*(" + SIGNED_NUMBER + r")")

    result["mounting_height_m"] = extract_optional_float(
        working_plane_page,
        r"Working Plane Luminaire Mounting Height\(m\):\s*(" + SIGNED_NUMBER + r")",
    )
    result["plane_max_illuminance_lx"] = extract_optional_float(
        working_plane_page,
        r"Working Plane Maximum Illuminance\(lx\):\s*(" + SIGNED_NUMBER + r")",
    )
    plane_position_match = re.search(
        r"Working Plane Maximum Illuminance Position\(d/h\):H\s*("
        + SIGNED_NUMBER
        + r")\s*V\s*("
        + SIGNED_NUMBER
        + r")",
        working_plane_page,
        re.IGNORECASE,
    )
    if plane_position_match:
        result["plane_max_position_h"] = float(plane_position_match.group(1))
        result["plane_max_position_v"] = float(plane_position_match.group(2))

    result["space_max_illuminance_lx"] = extract_optional_float(
        space_plane_page,
        r"Space Plane Maximum Illuminance and @Angle:\s*(" + SIGNED_NUMBER + r")lx",
    )
    result["space_max_angle_deg"] = extract_optional_float(
        space_plane_page,
        r"Space Plane Maximum Illuminance and @Angle:\s*" + SIGNED_NUMBER + r"lx,\s*(" + SIGNED_NUMBER + r")(?:deg|°|掳)",
    )
    result["plane_max_intensity_cd"] = extract_optional_float(
        space_plane_page,
        r"Plane Maximum Lighting Intensity and @Angle:\s*(" + SIGNED_NUMBER + r")cd",
    )
    result["plane_max_intensity_angle_deg"] = extract_optional_float(
        space_plane_page,
        r"Plane Maximum Lighting Intensity and @Angle:\s*" + SIGNED_NUMBER + r"cd,\s*(" + SIGNED_NUMBER + r")(?:deg|eg|°|掳)",
    )

    space_angle_match = re.search(
        r"Space Plane Maximum Illuminance and @Angle:\s*"
        + SIGNED_NUMBER
        + r"lx,\s*("
        + SIGNED_NUMBER
        + r")",
        space_plane_page,
        re.IGNORECASE,
    )
    if space_angle_match:
        result["space_max_angle_deg"] = float(space_angle_match.group(1))

    intensity_angle_match = re.search(
        r"Plane Maximum Lighting Intensity and @Angle:\s*"
        + SIGNED_NUMBER
        + r"cd,\s*("
        + SIGNED_NUMBER
        + r")",
        space_plane_page,
        re.IGNORECASE,
    )
    if intensity_angle_match:
        result["plane_max_intensity_angle_deg"] = float(intensity_angle_match.group(1))

    result["attenuation_slots"] = parse_attenuation_slots(attenuation_page)
    result["candela_plane"] = parse_candela_plane(page_texts)

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
