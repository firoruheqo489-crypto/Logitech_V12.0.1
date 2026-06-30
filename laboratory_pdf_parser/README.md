# Laboratory PDF Parser

Deterministic PDF parser for laboratory reports that contain stable anchor text.

## Runtime

```bash
python -m laboratory_pdf_parser "C:\path\to\report.pdf"
```

## Output

The script prints JSON with these fields:

- `cct_k`
- `ra`
- `flux_lm`
- `efficacy_lm_per_w`
- `voltage_v`
- `current_a`
- `power_w`
- `power_factor`
- `model`
- `report_datetime`
- `file_path`

## Anchor Rules

- `CCT=` -> `CCT=\s*(\d+)K`
- `Render Index:Ra=` -> `Render\s+Index:Ra=\s*([\d.]+)`
- `Flux =` -> `Flux\s*=\s*([\d.]+)\s*lm`
- `Eff. :` -> `Eff\.\s*:\s*([\d.]+)\s*lm/W`
- `V =` -> `V\s*=\s*([\d.]+)\s*V`
- `I =` -> `I\s*=\s*([\d.]+)\s*A`
- `P =` -> `P\s*=\s*([\d.]+)\s*W`
- `PF =` -> `PF\s*=\s*([\d.]+)`

Each anchor must resolve to exactly one unique match. Missing or repeated values raise an error.
