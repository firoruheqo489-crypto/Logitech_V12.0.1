from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


def normalize_text(text: str) -> str:
    normalized = text.replace("\u3000", " ")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{2,}", "\n", normalized)
    return normalized.strip()


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


def extract_pdf_text(pdf_path: Path) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        pages = [page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in pdf.pages]
    return normalize_text("\n".join(pages))


def parse_flicker_report_file(pdf_path: str | Path) -> dict[str, object]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {path.name}")

    text = extract_pdf_text(path)

    sample_name = extract_optional_string(text, r"样品名称:\s*(.+?)\s+样品型号:")
    measurement_time = extract_optional_string(text, r"测量时间:\s*([0-9:/\-\s]+)")
    average_lx = extract_optional_float(text, r"平均值\(lx\):\s*([\d.]+)")
    flicker_index = extract_optional_float(text, r"闪烁指数:([\d.]+)")
    flicker_percent = extract_optional_float(text, r"闪烁百分比:([\d.]+)%")
    frequency_hz = extract_optional_float(text, r"频率:([\d.]+)Hz")
    sample_rate_ks = extract_optional_float(text, r"采样速率:([\d.]+)kS/s")
    sample_time_s = extract_optional_float(text, r"采样时间:([\d.]+)s")
    voltage_v = extract_optional_float(path.name, r"(\d+)V")

    return {
      "file_name": path.name,
      "sample_name": sample_name,
      "measurement_time": measurement_time,
      "average_lx": average_lx,
      "flicker_index": flicker_index,
      "flicker_percent": flicker_percent,
      "frequency_hz": frequency_hz,
      "sample_rate_ks": sample_rate_ks,
      "sample_time_s": sample_time_s,
      "voltage_v": voltage_v,
      "raw_text": text,
    }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse FP3000 flicker PDF reports into structured telemetry.",
    )
    parser.add_argument("pdf_path", help="Path to the flicker PDF report.")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON instead of pretty JSON.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    result = parse_flicker_report_file(args.pdf_path)
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
