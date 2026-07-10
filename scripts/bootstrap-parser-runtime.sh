#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="${1:-$(pwd)}"
VENV_DIR="$REPO_ROOT/.venv"
REQUIREMENTS_FILE="$REPO_ROOT/laboratory_pdf_parser/requirements.txt"

cd "$REPO_ROOT"

if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo "Missing parser requirements file: $REQUIREMENTS_FILE" >&2
  exit 1
fi

install_python311() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y python3.11 python3.11-pip
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    yum install -y python3.11 python3.11-pip
    return
  fi

  echo "Unable to install python3.11 automatically: no dnf/yum found" >&2
  exit 1
}

if ! command -v python3.11 >/dev/null 2>&1; then
  install_python311
fi

PYTHON_BIN="$(command -v python3.11)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "python3.11 is not available after installation" >&2
  exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  rm -rf "$VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip wheel
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS_FILE"

"$VENV_DIR/bin/python" - <<'PY'
import importlib.util
import sys

required = ("fitz", "pdfplumber", "laboratory_pdf_parser")
missing = [name for name in required if importlib.util.find_spec(name) is None]
if missing:
    raise SystemExit(f"Missing parser runtime modules: {', '.join(missing)}")
print(sys.executable)
PY
