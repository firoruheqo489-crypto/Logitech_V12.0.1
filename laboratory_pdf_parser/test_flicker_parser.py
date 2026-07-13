from __future__ import annotations

import unittest

from laboratory_pdf_parser.flicker_parser import parse_flicker_report_text


class FlickerParserTextTests(unittest.TestCase):
    def test_parses_standard_flicker_report_fields(self) -> None:
        text = """
        测量结果
        平均值(lx): 638.94 闪烁指数:0.003 闪烁百分比:2.793%
        频率:200.000Hz
        样品名称: BL212SA-10W2 样品型号:
        测量时间: 2026-07-10 15:07:34
        备注: 标准： IESNA 2000,CIE TN 006
        """

        result = parse_flicker_report_text(text, "BL212SA-10W2.pdf")

        self.assertEqual(result["report_type"], "flicker")
        self.assertEqual(result["sample_name"], "BL212SA-10W2")
        self.assertEqual(result["measurement_time"], "2026-07-10 15:07:34")
        self.assertEqual(result["average_lx"], 638.94)
        self.assertEqual(result["flicker_index"], 0.003)
        self.assertEqual(result["flicker_percent"], 2.793)
        self.assertEqual(result["frequency_hz"], 200.0)
        self.assertEqual(result["standard"], "IESNA 2000,CIE TN 006")

    def test_parses_pst_report_with_chinese_colons_and_spacing(self) -> None:
        text = """
        采样速率：10 kS/s 采样时间：60.0 s
        平均值(lx)： 634.24 Pst ： 0.008 Result：可接受
        频率(Hz)：99.995 Hz
        样品名称： BL212SA-10W2 样品型号：
        测量时间： 2026-07-10 15:09:49
        备注: 标准： IEC TR 61547-1:2015
        """

        result = parse_flicker_report_text(text, "BL212SA-10W2 PST.pdf")

        self.assertEqual(result["report_type"], "pst")
        self.assertEqual(result["pst"], 0.008)
        self.assertEqual(result["result"], "可接受")
        self.assertEqual(result["frequency_hz"], 99.995)
        self.assertEqual(result["sample_rate_ks"], 10.0)
        self.assertEqual(result["sample_time_s"], 60.0)
        self.assertEqual(result["standard"], "IEC TR 61547-1:2015")

    def test_parses_svm_report_with_erp_and_visibility_variants(self) -> None:
        text = """
        采样速率:20kS/s 采样时间:2.0s
        平均值(lx): 637.93 频率:99.995Hz SVM： 0.034
        可见性：频闪不可见 ERP：PASS
        样品名称: BL212SA-10W2 样品型号:
        备注: 标准： CIE TN:006-2016
        """

        result = parse_flicker_report_text(text, "BL212SA-10W2 SVM.pdf")

        self.assertEqual(result["report_type"], "svm")
        self.assertEqual(result["svm"], 0.034)
        self.assertEqual(result["erp"], "PASS")
        self.assertEqual(result["visibility"], "频闪不可见")
        self.assertEqual(result["frequency_hz"], 99.995)
        self.assertEqual(result["standard"], "CIE TN:006-2016")

    def test_voltage_is_only_read_from_explicit_voltage_token(self) -> None:
        self.assertIsNone(parse_flicker_report_text("Pst:0.008", "BL212SA-10W2 PST.pdf")["voltage_v"])
        self.assertEqual(parse_flicker_report_text("Pst:0.008", "sample 230V.pdf")["voltage_v"], 230.0)
        self.assertEqual(parse_flicker_report_text("Pst:0.008", "sample 12.5 V.pdf")["voltage_v"], 12.5)


if __name__ == "__main__":
    unittest.main()
