from __future__ import annotations

import argparse
import copy
import json
import re
from pathlib import Path

import fitz

REPORT_TEMPLATE = {
    "sdcm": None,
    "chromaticity_x": None,
    "chromaticity_y": None,
    "u_prime": None,
    "v_prime": None,
    "duv": None,
    "cct_k": None,
    "ra": None,
    "avg_r": None,
    "flux_lm": None,
    "efficacy_lm_per_w": None,
    "radiant_power_mw": None,
    "voltage_v": None,
    "current_a": None,
    "power_w": None,
    "power_factor": None,
    "dominant_wavelength_nm": None,
    "peak_wavelength_nm": None,
    "fwhm_nm": None,
    "color_purity_percent": None,
    "model": None,
    "report_datetime": None,
    "energy_efficiency_class": None,
    "cqs_tm30_metrics": None,
    "render_indices": [{f"R{index}": None} for index in range(1, 16)],
}


def extract_pdf_text(pdf_path: Path) -> str:
    with fitz.open(pdf_path) as document:
        pages = [page.get_text("text") for page in document]
    return "\n".join(pages)


def normalize_extracted_text(text: str) -> str:
    normalized = text.replace("\u3000", " ")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    return normalized.strip()


def extract_optional_float(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1))


def extract_optional_int(text: str, pattern: str) -> int | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def extract_optional_string(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def build_render_indices(text: str) -> list[dict[str, float | None]]:
    ordered_values: dict[str, float | None] = {
        f"R{index}": None for index in range(1, 16)
    }

    for index_text, value_text in re.findall(r"R(\d+)\s*=\s*([\d.]+)", text, re.IGNORECASE):
        label = f"R{index_text}"
        if label in ordered_values:
            ordered_values[label] = float(value_text)

    return [{label: value} for label, value in ordered_values.items()]


def parse_laboratory_report_text(text: str) -> dict[str, object]:
    normalized_text = normalize_extracted_text(text)
    result = copy.deepcopy(REPORT_TEMPLATE)

    chromaticity_match = re.search(
        r"Chromaticity Coordinate:x=([\d.]+)\s*y=([\d.]+)/u'=([\d.]+)\s*v'=([\d.]+)",
        normalized_text,
        re.IGNORECASE,
    )
    if chromaticity_match:
        result["chromaticity_x"] = float(chromaticity_match.group(1))
        result["chromaticity_y"] = float(chromaticity_match.group(2))
        result["u_prime"] = float(chromaticity_match.group(3))
        result["v_prime"] = float(chromaticity_match.group(4))

    result["sdcm"] = extract_optional_float(normalized_text, r"SDCM\s*:\s*([\d.]+)")
    result["duv"] = extract_optional_float(normalized_text, r"Duv=([-\d.]+)")
    result["cct_k"] = extract_optional_int(normalized_text, r"CCT=(\d+)K")
    result["ra"] = extract_optional_float(normalized_text, r"Render\s+Index:Ra=([\d.]+)")
    result["avg_r"] = extract_optional_float(normalized_text, r"AvgR=([\d.]+)")
    result["flux_lm"] = extract_optional_float(normalized_text, r"Flux\s*=\s*([\d.]+)\s*lm")
    result["efficacy_lm_per_w"] = extract_optional_float(normalized_text, r"Eff\.\s*:\s*([\d.]+)\s*lm/W")
    radiant_power_w = extract_optional_float(normalized_text, r"Fe\s*=\s*([\d.]+)\s*W")
    result["radiant_power_mw"] = round(radiant_power_w * 1000, 3) if radiant_power_w is not None else None
    result["voltage_v"] = extract_optional_float(normalized_text, r"\bV\s*=\s*([\d.]+)\s*V\b")
    result["current_a"] = extract_optional_float(normalized_text, r"\bI\s*=\s*([\d.]+)\s*A\b")
    result["power_w"] = extract_optional_float(normalized_text, r"\bP\s*=\s*([\d.]+)\s*W\b")
    result["power_factor"] = extract_optional_float(normalized_text, r"\bPF\s*=\s*([\d.]+)\b")
    result["dominant_wavelength_nm"] = extract_optional_float(normalized_text, r"Dominant WL:Ld\s*=\s*([\d.]+)nm")
    result["peak_wavelength_nm"] = extract_optional_float(normalized_text, r"Peak WL:Lp=([\d.]+)nm")
    result["fwhm_nm"] = extract_optional_float(normalized_text, r"FWHM=([\d.]+)nm")
    result["color_purity_percent"] = extract_optional_float(normalized_text, r"Purity=([\d.]+)%")
    result["model"] = extract_optional_string(normalized_text, r"Model:\s*([^\n]+?)(?:\s+Number:|$)")
    result["report_datetime"] = extract_optional_string(normalized_text, r"Date:\s*([0-9:-]+\s+[0-9:]+)")
    result["render_indices"] = build_render_indices(normalized_text)

    return result


def parse_laboratory_report_file(pdf_path: str | Path) -> dict[str, object]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {path.name}")

    text = extract_pdf_text(path)
    result = parse_laboratory_report_text(text)
    result["file_path"] = str(path)
    return result


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Deterministically extract laboratory report values from a PDF."
    )
    parser.add_argument("pdf_path", help="Path to the laboratory PDF report.")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print JSON without indentation.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    result = parse_laboratory_report_file(args.pdf_path)
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=None if args.compact else 2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
