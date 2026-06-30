from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import fitz


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


def extract_optional_float(text: str, pattern: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1))


def parse_process_metrics(text: str) -> dict[str, float | None]:
    metrics: dict[str, float | None] = {}
    patterns = {
        "voltage_avg_v": r"电压\(V\):\s*([\d.]+)",
        "voltage_max_v": r"电压\(V\):\s*[\d.]+\s*([\d.]+)",
        "frequency_avg_hz": r"频率\(Hz\):\s*([\d.]+)",
        "frequency_max_hz": r"频率\(Hz\):\s*[\d.]+\s*([\d.]+)",
        "current_peak_avg_a": r"电流峰值\(A\):\s*([\d.]+)",
        "current_peak_max_a": r"电流峰值\(A\):\s*[\d.]+\s*([\d.]+)",
        "current_rms_avg_a": r"电流有效值\(A\):\s*([\d.]+)",
        "current_rms_max_a": r"电流有效值\(A\):\s*[\d.]+\s*([\d.]+)",
        "fundamental_current_avg_ma": r"基波电流\(mA\):\s*([\d.]+)",
        "fundamental_current_max_ma": r"基波电流\(mA\):\s*[\d.]+\s*([\d.]+)",
        "crest_factor": r"电流波峰比:\s*([\d.]+)",
        "power_avg_w": r"功率\(W\):\s*([\d.]+)",
        "power_max_w": r"功率\(W\):\s*[\d.]+\s*([\d.]+)",
        "power_factor_avg": r"功率因数:\s*([\d.]+)",
        "power_factor_max": r"功率因数:\s*[\d.]+\s*([\d.]+)",
    }
    for key, pattern in patterns.items():
        metrics[key] = extract_optional_float(text, pattern)
    return metrics


def parse_harmonic_rows(text: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    try:
        start_index = lines.index("谐波#")
    except ValueError:
        return []

    tokens = []
    for line in lines[start_index + 1 :]:
        if line.endswith("/2"):
            break
        if line in {"谐波(avg)", "谐波(max)", "100%Limit", "150%Limit", "%Limit", "状态", "%", "测试过程值:"}:
            continue
        tokens.append(line)

    rows: list[dict[str, object]] = []
    index = 0
    while index < len(tokens):
      token = tokens[index]
      if not re.fullmatch(r"\d+", token):
          index += 1
          continue
      if index + 7 >= len(tokens):
          break
      maybe_status = tokens[index + 7]
      number_slice = tokens[index + 1 : index + 7]
      if maybe_status not in {"Pass", "Fail"}:
          index += 1
          continue
      if not all(re.fullmatch(r"[\d.]+", value) for value in number_slice):
          index += 1
          continue

      order = int(token)
      avg_percent = float(tokens[index + 1])
      max_percent = float(tokens[index + 2])
      limit_100 = float(tokens[index + 3])
      limit_150 = float(tokens[index + 4])
      avg_limit_percent = float(tokens[index + 5])
      max_limit_percent = float(tokens[index + 6])
      status = tokens[index + 7]

      rows.append(
          {
              "order": order,
              "avg_percent": avg_percent,
              "max_percent": max_percent,
              "limit_100_percent": limit_100,
              "limit_150_percent": limit_150,
              "avg_limit_percent": avg_limit_percent,
              "max_limit_percent": max_limit_percent,
              "status": status,
          }
      )
      index += 8
    return rows


def parse_harmonic_report_file(pdf_path: str | Path) -> dict[str, object]:
    path = Path(pdf_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {path.name}")

    text = extract_pdf_text(path)

    product_name = extract_optional_string(text, r"名称:([^\n]+)")
    mode = extract_optional_string(text, r"工作模式:([^\n]+)")
    test_date = extract_optional_string(text, r"测试日期:([^\n]+)")
    start_time = extract_optional_string(text, r"开始时间:([^\n]+)")
    end_time = extract_optional_string(text, r"结束时间:([^\n]+)")
    standard = extract_optional_string(text, r"测试标准:([^\n]+)")
    duration_min = extract_optional_float(text, r"测试时长\(min\):([\d.]+)")
    remarks = extract_optional_string(text, r"备注:([^\n]+)")
    verdict = extract_optional_string(text, r"测试结果:(Pass|Fail)")

    thc_ma = extract_optional_float(text, r"THC\(mA\):([\d.]+)")
    ithd_percent = extract_optional_float(text, r"I-THD\(%\):([\d.]+)")
    pohc_ma = extract_optional_float(text, r"POHC\(mA\):([\d.]+)")
    pohc_limit_ma = extract_optional_float(text, r"POHC Limit\(mA\):([\d.]+)")
    distortion_factor = extract_optional_float(text, r"DF:([\d.]+)")

    process_metrics = parse_process_metrics(text)
    harmonic_rows = parse_harmonic_rows(text)

    return {
        "file_name": path.name,
        "product_name": product_name,
        "mode": mode,
        "test_date": test_date,
        "start_time": start_time,
        "end_time": end_time,
        "standard": standard,
        "duration_min": duration_min,
        "remarks": remarks,
        "verdict": verdict,
        "thc_ma": thc_ma,
        "ithd_percent": ithd_percent,
        "pohc_ma": pohc_ma,
        "pohc_limit_ma": pohc_limit_ma,
        "distortion_factor": distortion_factor,
        "process_metrics": process_metrics,
        "harmonics": harmonic_rows,
        "raw_text": text,
    }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Parse harmonic test PDF reports into structured telemetry."
    )
    parser.add_argument("pdf_path", help="Path to the harmonic PDF report.")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Print compact JSON instead of pretty JSON.",
    )
    return parser


def main() -> int:
    parser = build_argument_parser()
    args = parser.parse_args()

    result = parse_harmonic_report_file(args.pdf_path)
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
