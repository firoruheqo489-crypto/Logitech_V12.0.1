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


def parse_phase_checks(text: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    rows: list[dict[str, object]] = []
    index = 0
    while index < len(lines):
        token = lines[index]
        if not re.fullmatch(r"Q[1-6]", token):
            index += 1
            continue
        if index + 3 >= len(lines):
            break
        measured = lines[index + 1]
        limit = lines[index + 2]
        status = lines[index + 3]
        if not re.fullmatch(r"[\d.]+", measured) or status not in {"Pass", "Fail"}:
            index += 1
            continue
        rows.append(
            {
                "checkpoint": token,
                "measured_deg": float(measured),
                "limit_expression": limit,
                "status": status,
            }
        )
        index += 4
    return rows


def parse_structural_checks(text: str) -> list[dict[str, object]]:
    patterns = [
        (
            "Ipeak_phase_angle",
            r"峰值电流最大相位角=([\d.]+)\s*deg\s*(Pass|Fail)",
            None,
        ),
        (
            "I60_90pMin",
            r"60-90度正半波最小电流\(I60_90pMin\)=([-\d.]+)\s*mA\s*限值=([-\d.]+)\s*mA\s*(Pass|Fail)",
            "mA",
        ),
        (
            "I60_90nMax",
            r"60-90度负半波最大电流\(I60_90nMax\)=([-\d.]+)\s*mA\s*限值=([-\d.]+)\s*mA\s*(Pass|Fail)",
            "mA",
        ),
    ]

    checks: list[dict[str, object]] = []
    for code, pattern, unit in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue
        if code == "Ipeak_phase_angle":
            checks.append(
                {
                    "code": code,
                    "value": float(match.group(1)),
                    "limit": None,
                    "unit": "deg",
                    "status": match.group(2),
                }
            )
        else:
            checks.append(
                {
                    "code": code,
                    "value": float(match.group(1)),
                    "limit": float(match.group(2)),
                    "unit": unit,
                    "status": match.group(3),
                }
            )
    return checks


def parse_harmonic_rows(text: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    try:
        start_index = lines.index("谐波#")
    except ValueError:
        return []

    ignored_tokens = {
        "谐波(avg)",
        "谐波(max)",
        "100%Limit",
        "150%Limit",
        "%Limit",
        "100%限值",
        "150%限值",
        "限值",
        "状态",
        "%",
        "mA",
        "测试过程值:",
    }

    tokens: list[str] = []
    for line in lines[start_index + 1 :]:
        if line.endswith("/2"):
            break
        if line in ignored_tokens:
            continue
        tokens.append(line)

    rows: list[dict[str, object]] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]
        if not re.fullmatch(r"\d+", token):
            index += 1
            continue

        order = int(token)
        cursor = index + 1
        numeric_values: list[float] = []
        while cursor < len(tokens) and re.fullmatch(r"[\d.]+", tokens[cursor]):
            numeric_values.append(float(tokens[cursor]))
            cursor += 1

        if cursor >= len(tokens):
            break

        status = tokens[cursor]
        if status not in {"Pass", "Fail", "N/A"}:
            index += 1
            continue

        row: dict[str, object] = {
            "order": order,
            "avg_ma": None,
            "max_ma": None,
            "limit_100_ma": None,
            "limit_150_ma": None,
            "ratio_percent": None,
            "avg_percent": None,
            "limit_percent": None,
            "max_percent": None,
            "max_limit_percent": None,
            "status": status,
        }

        # Current real format:
        # order, avg_mA, limit100_mA, ratio_percent, harmonic_percent, limit_percent, status
        if len(numeric_values) == 5:
            row["avg_ma"] = numeric_values[0]
            row["limit_100_ma"] = numeric_values[1]
            row["ratio_percent"] = numeric_values[2]
            row["avg_percent"] = numeric_values[3]
            row["limit_percent"] = numeric_values[4]
            row["max_percent"] = numeric_values[3]
            row["max_limit_percent"] = numeric_values[4]
        # Legacy fallback
        elif len(numeric_values) >= 6:
            row["avg_percent"] = numeric_values[0]
            row["max_percent"] = numeric_values[1]
            row["limit_100_ma"] = numeric_values[2]
            row["limit_150_ma"] = numeric_values[3]
            row["ratio_percent"] = numeric_values[4]
            row["limit_percent"] = numeric_values[5]
            row["max_limit_percent"] = numeric_values[5]
        else:
            index += 1
            continue

        rows.append(row)
        index = cursor + 1

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
    phase_checks = parse_phase_checks(text)
    structural_checks = parse_structural_checks(text)
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
        "phase_checks": phase_checks,
        "structural_checks": structural_checks,
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
