"""Deterministic laboratory PDF report parser."""

__all__ = [
    "parse_laboratory_report_file",
    "parse_laboratory_report_text",
]


def parse_laboratory_report_file(*args, **kwargs):
    from .parser import parse_laboratory_report_file as implementation

    return implementation(*args, **kwargs)


def parse_laboratory_report_text(*args, **kwargs):
    from .parser import parse_laboratory_report_text as implementation

    return implementation(*args, **kwargs)
