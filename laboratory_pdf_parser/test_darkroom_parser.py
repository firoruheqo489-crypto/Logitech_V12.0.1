from __future__ import annotations

import unittest

from laboratory_pdf_parser.darkroom_parser import parse_darkroom_report_text


class DarkroomParserTest(unittest.TestCase):
    def test_parses_photometric_evidence_from_flood_report(self) -> None:
        page1 = """
        Photometric Filename:HL222C-200W2-G3(单极驱动） -1.IES
        Luminary Name: HL222C-200W2-G3(单极驱动）-1 Lum. Catelog: Test ID:
        Lamp Name: LED Lamp Catelog: LED Test Date: 2026/07/13
        Manufacture: Shld.Ang(°): Test Machine:GON-2000
        Rated Flux(lm): 26682.039 Luminary Flux(lm): 26682.037 Beam Lumens(lm): 18559.42
        Luminary EER(lm/W): 139.114 Field Lumens(lm): 25255.46
        Tested Power(W): 191.800 Max.Candela(cd): 14829.717 Field Efficiency(%): 94.65
        Max Cand@Ang.(°): B=0.0 β=1.0 ErP φuse(90°): 20550.295lm
        Beam Efficiency(%): 69.56
        Tested Electrics(V,A,pf):229.9,0.868,0.961Beam Angle(50%)(V,H): 82.0(°),81.1(°) IRF(%): 136.940
        Field Angle(10%)(V,H): 123.9(°),125.4(°)
        """
        page9 = """
        Working Plane Luminaire Mounting Height(m): 3.00
        Working Plane Maximum Illuminance(lx): 1646.99
        Working Plane Maximum Illuminance Position(d/h):H 0.0 V-0.0
        """
        page11 = """
        Space Plane Maximum Illuminance and @Angle: 14814.48lx,1.5deg
        Plane Maximum Lighting Intensity and @Angle: 14829.717cd,0eg
        """
        page12 = """
        1.0m 14801lx 8069.565lx 1.711m
        2.0m 3700.2lx 2017.391lx 3.422m
        """
        page13 = """
        Candela Tabulation
        V/H β-90.0 β-45.0 β0.0 β45.0 β90.0
        B0.0 0.0 5529.5 14801.0 5340.5 0.0
        """

        pages = [page1, "", "", "", "", "", "", "", page9, "", page11, page12, page13]
        result = parse_darkroom_report_text(pages)

        self.assertEqual(result["name"], "HL222C-200W2-G3(单极驱动）-1")
        self.assertEqual(result["machine"], "GON-2000")
        self.assertEqual(result["test_date"], "2026/07/13")
        self.assertEqual(result["luminaire_flux_lm"], 26682.037)
        self.assertEqual(result["tested_power_w"], 191.8)
        self.assertEqual(result["luminaire_eer_lm_per_w"], 139.114)
        self.assertEqual(result["beam_lumens_lm"], 18559.42)
        self.assertEqual(result["beam_efficiency_percent"], 69.56)
        self.assertEqual(result["field_lumens_lm"], 25255.46)
        self.assertEqual(result["field_efficiency_percent"], 94.65)
        self.assertEqual(result["erp_phiuse_lm"], 20550.295)
        self.assertEqual(result["erp_phiuse_angle_deg"], 90.0)
        self.assertEqual(result["irf_percent"], 136.94)
        self.assertEqual(result["mounting_height_m"], 3.0)
        self.assertEqual(result["plane_max_position_v"], -0.0)
        self.assertEqual(result["attenuation_slots"][0]["centerLux"], 14801.0)
        self.assertEqual(result["candela_plane"][2], {"theta": 0.0, "cd": 14801.0})

    def test_parses_indoor_c_gamma_report_fields(self) -> None:
        page1 = """
        IES Indoor Report
        Photometric Filename:BL212SA-10W2.IES
        Indoor Luminaire Photometric Data
        Luminary Name: BL212SA-10W2 Lum. Catelog: Test ID:
        Lamp Name: Lamp Catelog: Test Date: 2026/07/10
        Manufacture: Shld.Ang(°): Test Machine:GON-2000
        Rated Flux(lm): 1022.790 Luminary Flux(lm): 1022.785 Field Angle(10%Imax): 202.9(°)
        Luminary EER(lm/W): 104.869 Up Lumens&Percent: 56.320lm 5.51%
        Tested Power(W): 9.753 Max.Candela(cd): 304.378 S/MH: C0_a180=1.284 C90_270=1.230
        Lamps' Inside: 1 Max Cand@Ang.(°): C=0.0 γ=1.0 CIE Type: Semi-Direct
        Tested Electrics(V,A,pf):230.0,0.053,0.793Beam Angle(50%Imax): 123.7(°) ErP φuse(120°): 690.024lm
        Lamp Size(W*L*H):0.095m*0.185m*0.000m Left=-61.9°,Right=61.9° IRF(%): 108.243
        C Plane [50%MaxAng.][10%MaxAng.]
        C0.0_180.0 : 123.7 202.9
        C90.0_270.0 : 111.8 177.3
        """
        working_plane_page = """
        Plane ISO-Illuminance Diagram
        Working Plane Luminaire Mounting Height(m): 3.00
        Working Plane Maximum Illuminance(lx): 33.80
        Working Plane Maximum Illuminance Position(d/h):H 0.0 V0.0
        """
        space_plane_page = """
        Space ISO Illuminance Diagram
        Space Plane Maximum Illuminance and @Angle: 304.24lx,1.0deg
        Plane Maximum Lighting Intensity and @Angle: 304.378cd,0eg
        """
        attenuation_page = """
        Illuminance-Distance Diagram
        1.0m 302.12lx 65.138lx 3.740m
        2.0m 75.530lx 16.285lx 7.479m
        """
        candela_page = """
        Candela Tabulation
        V/H C0.0 C30.0 C60.0 C90.0
        γ0.0 302.12 302.12 302.12 302.12
        γ1.0 304.38 301.63 301.49 300.66
        γ2.0 304.23 301.55 301.25 300.43
        """

        result = parse_darkroom_report_text(
            [page1, working_plane_page, space_plane_page, attenuation_page, candela_page],
        )

        self.assertEqual(result["name"], "BL212SA-10W2")
        self.assertEqual(result["max_candela_angle_h"], 0.0)
        self.assertEqual(result["max_candela_angle_v"], 1.0)
        self.assertEqual(result["beam_angle_v_deg"], 123.7)
        self.assertEqual(result["beam_angle_h_deg"], 111.8)
        self.assertEqual(result["field_angle_v_deg"], 202.9)
        self.assertEqual(result["field_angle_h_deg"], 177.3)
        self.assertEqual(result["mounting_height_m"], 3.0)
        self.assertEqual(result["space_max_angle_deg"], 1.0)
        self.assertEqual(result["attenuation_slots"][1]["diameter"], 7.479)
        self.assertEqual(result["candela_plane"][1], {"theta": 1.0, "cd": 304.38})


if __name__ == "__main__":
    unittest.main()
