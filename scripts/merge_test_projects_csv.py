from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path


FILE_PREFIX = "测试项目(1).xls - "
HEADER = ["序号", "项目", "测试结果及不合格点", "需求测试项目（√×）", "备注"]
STOP_KEYWORDS = ("成员签字", "成员签名")
INPUT_ENCODINGS = ("utf-8-sig", "utf-8", "gb18030", "gbk", "cp936")
DESKTOP_EXCEL_CANDIDATES = ("测试项目.xls", "测试项目.xlsx")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="合并“测试项目(1).xls - *.csv”文件并输出 master_test_projects.csv"
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path.cwd(),
        help="待扫描目录，默认是当前目录。",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("master_test_projects.csv"),
        help="输出文件路径，默认是 ./master_test_projects.csv",
    )
    return parser.parse_args()


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\ufeff", "")).strip()


def find_desktop_excel() -> Path | None:
    desktop = Path.home() / "Desktop"
    for name in DESKTOP_EXCEL_CANDIDATES:
        candidate = desktop / name
        if candidate.exists():
            return candidate
    return None


def list_target_csv_files(directory: Path) -> list[Path]:
    return sorted(
        path
        for path in directory.glob(f"{FILE_PREFIX}*.csv")
        if path.is_file() and not path.name.startswith("~$")
    )


def resolve_scan_dir(input_dir: Path) -> tuple[Path, Path | None]:
    desktop_excel = find_desktop_excel()
    current_matches = list_target_csv_files(input_dir)
    if current_matches:
        return input_dir, desktop_excel

    if desktop_excel is not None:
        desktop_matches = list_target_csv_files(desktop_excel.parent)
        if desktop_matches:
            return desktop_excel.parent, desktop_excel

    return input_dir, desktop_excel


def read_text_lines(csv_path: Path) -> list[str]:
    last_error: UnicodeDecodeError | None = None
    for encoding in INPUT_ENCODINGS:
        try:
            return csv_path.read_text(encoding=encoding).splitlines()
        except UnicodeDecodeError as error:
            last_error = error
    raise UnicodeDecodeError(
        last_error.encoding if last_error else "unknown",
        last_error.object if last_error else b"",
        last_error.start if last_error else 0,
        last_error.end if last_error else 0,
        f"无法解码文件: {csv_path}",
    )


def extract_category(csv_path: Path) -> str:
    name = csv_path.name
    if not name.startswith(FILE_PREFIX):
        raise ValueError(f"文件名不符合预期前缀: {name}")
    return clean_text(name[len(FILE_PREFIX) : -len(csv_path.suffix)])


def find_header_index(rows: list[list[str]], csv_path: Path) -> int:
    normalized_header = [clean_text(item) for item in HEADER]
    for index, row in enumerate(rows):
        normalized_row = [clean_text(item) for item in row[: len(HEADER)]]
        if normalized_row == normalized_header:
            return index
    raise ValueError(f"未找到目标表头: {csv_path}")


def should_stop(row: list[str]) -> bool:
    joined = " ".join(row)
    return any(keyword in joined for keyword in STOP_KEYWORDS)


def normalize_row(row: list[str]) -> list[str]:
    cleaned = [clean_text(cell) for cell in row]
    if len(cleaned) < len(HEADER):
        cleaned.extend([""] * (len(HEADER) - len(cleaned)))
    return cleaned[: len(HEADER)]


def parse_csv_file(csv_path: Path) -> list[dict[str, str]]:
    category = extract_category(csv_path)
    lines = read_text_lines(csv_path)
    rows = list(csv.reader(lines))
    header_index = find_header_index(rows, csv_path)

    parsed_rows: list[dict[str, str]] = []
    for raw_row in rows[header_index + 1 :]:
        row = normalize_row(raw_row)
        if not any(row):
            continue
        if should_stop(row):
            break
        if row == HEADER:
            continue

        record = dict(zip(HEADER, row, strict=True))
        record["类目"] = category
        parsed_rows.append(record)

    return parsed_rows


def write_output(records: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [*HEADER, "类目"]
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def build_missing_files_message(scan_dir: Path, desktop_excel: Path | None) -> str:
    message = [
        f"在目录 {scan_dir} 中没有找到匹配文件：{FILE_PREFIX}*.csv",
    ]
    if desktop_excel is not None:
        message.append(f"已定位桌面 Excel：{desktop_excel}")
        message.append("但桌面目录当前也没有找到同名前缀的 CSV 导出文件。")
    else:
        message.append("桌面上也没有找到“测试项目.xls”或“测试项目.xlsx”。")
    message.append("请先把 Excel 的各工作表导出为 CSV，或通过 --input-dir 指定 CSV 所在目录。")
    return "\n".join(message)


def main() -> int:
    args = parse_args()
    scan_dir, desktop_excel = resolve_scan_dir(args.input_dir.resolve())
    csv_files = list_target_csv_files(scan_dir)
    if not csv_files:
        print(build_missing_files_message(scan_dir, desktop_excel), file=sys.stderr)
        return 1

    all_records: list[dict[str, str]] = []
    for csv_file in csv_files:
        all_records.extend(parse_csv_file(csv_file))

    if not all_records:
        print("已找到目标 CSV，但没有解析出有效数据行。", file=sys.stderr)
        return 1

    output_path = args.output
    if not output_path.is_absolute():
        output_path = scan_dir / output_path

    write_output(all_records, output_path)
    print(f"桌面 Excel: {desktop_excel}" if desktop_excel else "桌面 Excel: 未找到")
    print(f"扫描目录: {scan_dir}")
    print(f"匹配文件数: {len(csv_files)}")
    print(f"合并行数: {len(all_records)}")
    print(f"输出文件: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
