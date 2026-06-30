from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import fitz


PEAK_ROW_PATTERN = re.compile(
    r"(?m)^\s*(\d+)\s*\n"
    r"\s*([0-9.]+)\s*\n"
    r"\s*([0-9.]+)\s*\n"
    r"\s*([0-9.]+)\s*\n"
    r"\s*([0-9.]+)\s*\n"
    r"\s*(准峰值|平均值)\s*$"
)


def normalize_text(text: str) -> str:
    normalized = text.replace("\u3000", " ")
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def extract_pdf_text(pdf_path: Path) -> str:
    document = fitz.open(pdf_path)
    pages: list[str] = []
    try:
        for page in document:
            pages.append(page.get_text("text"))
    finally:
        document.close()
    return normalize_text("\n".join(pages))


def extract_optional_string(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


def detect_band(text: str) -> str:
    if "300MHz" in text or "300 MHz" in text:
      return "radiated"
    return "conducted"


def detect_channel(project_no: str | None, file_name: str) -> str | None:
    candidates = [project_no or "", file_name]
    for candidate in candidates:
        match = re.search(r"\b([LNF])\b", candidate, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    return None


def build_points_from_peaks(peaks: list[dict[str, object]]) -> list[dict[str, object]]:
    points_by_freq: dict[float, dict[str, object]] = {}
    for peak in peaks:
        freq = float(peak["freq_mhz"])
        point = points_by_freq.setdefault(
            freq,
            {
                "freq": freq,
                "qp": None,
                "av": None,
                "qp_limit": None,
                "av_limit": None,
            },
        )

        detector = str(peak["detector"])
        if detector == "QP":
            point["qp"] = float(peak["reading_dbuv"])
            point["qp_limit"] = float(peak["limit_dbuv"])
        else:
            point["av"] = float(peak["reading_dbuv"])
            point["av_limit"] = float(peak["limit_dbuv"])

    return [points_by_freq[freq] for freq in sorted(points_by_freq)]


def parse_emc_report_file(pdf_path: str | Path) -> dict[str, object]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {path.name}")

    text = extract_pdf_text(path)
    project_no = extract_optional_string(text, r"项目编号[:：]\s*\n?([^\n]+)")
    standard = extract_optional_string(text, r"测试标准[:：]\s*\n?([^\n]+)")
    report_date = extract_optional_string(text, r"日期[:：]\s*\n?([0-9]{4}-[0-9]{2}-[0-9]{2})")
    report_time = extract_optional_string(text, r"时间[:：]\s*\n?([0-9:]{5,8})")
    band = detect_band(text)
    channel = detect_channel(project_no, path.name)

    peaks: list[dict[str, object]] = []
    for match in PEAK_ROW_PATTERN.finditer(text):
        reading_type = match.group(6)
        detector = "QP" if reading_type == "准峰值" else "AV"
        peaks.append(
            {
                "index": int(match.group(1)),
                "freq_mhz": float(match.group(2)),
                "reading_dbuv": float(match.group(3)),
                "limit_dbuv": float(match.group(4)),
                "margin_db": float(match.group(5)),
                "detector": detector,
                "remark": reading_type,
            }
        )

    points = build_points_from_peaks(peaks)

    return {
        "file_name": path.name,
        "project_no": project_no,
        "standard": standard,
        "date": report_date,
        "time": report_time,
        "band": band,
        "channel": channel,
        "peaks": peaks,
        "points": points,
        "raw_text": text,
    }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse EMC conducted/radiated PDF reports into structured telemetry."
    )
    parser.add_argument("pdf_path", help="Path to the EMC PDF report.")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON instead of pretty JSON.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    result = parse_emc_report_file(args.pdf_path)
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
