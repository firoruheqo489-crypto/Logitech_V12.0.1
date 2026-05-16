export type SIPStatus = "draft" | "active" | "obsolete";
export type SIPPrintTemplate = "portrait" | "landscape";

const SIP_EDITOR_PX_PER_MM = 10;

export interface SIPPrintTemplateLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  pagePaddingMm: number;
  visualHeightMm: number;
  criticalPanelWidthMm: number;
  illustrationPaddingMm: number;
}

export interface SIPIllustrationSceneConfig {
  width: number;
  height: number;
  label: string;
  slotWidthMm: number;
  slotHeightMm: number;
  pixelsPerMm: number;
}

export interface SIPIllustrationPrintCalibration {
  scaleX: number;
  scaleY: number;
  offsetXmm: number;
  offsetYmm: number;
}

export const SIP_PRINT_TEMPLATE_LAYOUT: Record<SIPPrintTemplate, SIPPrintTemplateLayout> = {
  portrait: {
    pageWidthMm: 210,
    pageHeightMm: 297,
    pagePaddingMm: 5,
    visualHeightMm: 112,
    criticalPanelWidthMm: 49,
    illustrationPaddingMm: 2,
  },
  landscape: {
    pageWidthMm: 297,
    pageHeightMm: 210,
    pagePaddingMm: 5,
    visualHeightMm: 76,
    criticalPanelWidthMm: 84,
    illustrationPaddingMm: 0,
  },
};

function buildIllustrationSceneConfig(
  template: SIPPrintTemplate,
  label: string,
): SIPIllustrationSceneConfig {
  const layout = SIP_PRINT_TEMPLATE_LAYOUT[template];
  const slotWidthMm =
    layout.pageWidthMm -
    layout.pagePaddingMm * 2 -
    layout.criticalPanelWidthMm -
    layout.illustrationPaddingMm * 2;
  const slotHeightMm = layout.visualHeightMm - layout.illustrationPaddingMm * 2;

  return {
    width: Math.round(slotWidthMm * SIP_EDITOR_PX_PER_MM),
    height: Math.round(slotHeightMm * SIP_EDITOR_PX_PER_MM),
    label,
    slotWidthMm,
    slotHeightMm,
    pixelsPerMm: SIP_EDITOR_PX_PER_MM,
  };
}

export const SIP_ILLUSTRATION_SCENE_CONFIG: Record<SIPPrintTemplate, SIPIllustrationSceneConfig> = {
  portrait: buildIllustrationSceneConfig("portrait", "\u7ad6\u5411 A4"),
  landscape: buildIllustrationSceneConfig("landscape", "\u6a2a\u5411 A4"),
};

export const SIP_ILLUSTRATION_PRINT_CALIBRATION: Record<
  SIPPrintTemplate,
  SIPIllustrationPrintCalibration
> = {
  portrait: {
    scaleX: 1.18,
    scaleY: 1.18,
    offsetXmm: 5,
    offsetYmm: 6,
  },
  landscape: {
    scaleX: 1,
    scaleY: 1,
    offsetXmm: 0,
    offsetYmm: 0,
  },
};

export interface SIPMetaData {
  productCode: string;
  productName: string;
  version: string;
  status: SIPStatus;
  author: string;
  effectiveDate: string;
}

export type DefectLevel = "CR" | "MA" | "MI" | "";

export interface InspectionItem {
  id: string;
  sequence: number;
  inspectionItem: string;
  specification: string;
  lsl: string;
  usl: string;
  measurementTool: string;
  defectLevel: DefectLevel;
  aqlLevel: string;
}

export interface SIPIllustration {
  scenes: Record<SIPPrintTemplate, SIPIllustrationScene>;
}

export interface SIPIllustrationScene {
  sceneJson: string;
  previewImageUrl: string;
  width: number;
  height: number;
}

export interface SIPManualPanelContent {
  title: string;
  content: string;
  footer: string;
}

export type SIPManualPanels = Record<SIPPrintTemplate, SIPManualPanelContent>;

export const initialSipMetaData: SIPMetaData = {
  productCode: "LUM-DRV-001",
  productName: "\u7167\u660e\u9a71\u52a8\u677f\u7ec4\u4ef6",
  version: "2.1",
  status: "draft",
  author: "\u5f20\u4e09",
  effectiveDate: "",
};

export const initialSipIllustration: SIPIllustration = {
  scenes: {
    portrait: {
      sceneJson: "",
      previewImageUrl: "",
      width: SIP_ILLUSTRATION_SCENE_CONFIG.portrait.width,
      height: SIP_ILLUSTRATION_SCENE_CONFIG.portrait.height,
    },
    landscape: {
      sceneJson: "",
      previewImageUrl: "",
      width: SIP_ILLUSTRATION_SCENE_CONFIG.landscape.width,
      height: SIP_ILLUSTRATION_SCENE_CONFIG.landscape.height,
    },
  },
};

export const initialSipManualPanels: SIPManualPanels = {
  portrait: {
    title: "\u0043\u0052 \u9879\u76ee 100% \u5168\u68c0",
    content:
      "1  \u677f\u539a\u5c3a\u5bf8\n1.6mm \u00b1 0.1mm\n\n2  \u6d6a\u6d8c\u9632\u62a4\u9a8c\u8bc1\n\u901a\u8fc7 4KV \u6d6a\u6d8c\u6d4b\u8bd5",
    footer: "\u0043\u0052 \u9879\u76ee\u9700 100% \u5168\u68c0\n\u4e0d\u5f97\u6d41\u5165\u4e0b\u4e00\u5de5\u5e8f\u6216\u5ba2\u6237\u7aef",
  },
  landscape: {
    title: "\u0043\u0052 \u9879\u76ee 100% \u5168\u68c0",
    content:
      "1  \u677f\u539a\u5c3a\u5bf8\n1.6mm \u00b1 0.1mm\n\n2  \u6d6a\u6d8c\u9632\u62a4\u9a8c\u8bc1\n\u901a\u8fc7 4KV \u6d6a\u6d8c\u6d4b\u8bd5",
    footer: "\u0043\u0052 \u9879\u76ee\u9700 100% \u5168\u68c0\n\u4e0d\u5f97\u6d41\u5165\u4e0b\u4e00\u5de5\u5e8f\u6216\u5ba2\u6237\u7aef",
  },
};

export const initialInspectionItems: InspectionItem[] = [
  {
    id: "1",
    sequence: 1,
    inspectionItem: "\u5916\u89c2\u68c0\u67e5",
    specification: "\u65e0\u5212\u4f24\u3001\u65e0\u6c61\u6e0d\u3001\u65e0\u660e\u663e\u53d8\u5f62",
    lsl: "",
    usl: "",
    measurementTool: "\u76ee\u68c0",
    defectLevel: "MA",
    aqlLevel: "1.0",
  },
  {
    id: "2",
    sequence: 2,
    inspectionItem: "\u677f\u539a\u5c3a\u5bf8",
    specification: "1.6mm \u00b1 0.1mm",
    lsl: "1.5",
    usl: "1.7",
    measurementTool: "\u5361\u5c3a",
    defectLevel: "CR",
    aqlLevel: "0.065",
  },
  {
    id: "3",
    sequence: 3,
    inspectionItem: "\u710a\u76d8\u5bbd\u5ea6",
    specification: "\u2265 0.8mm",
    lsl: "0.8",
    usl: "",
    measurementTool: "\u663e\u5fae\u955c",
    defectLevel: "MA",
    aqlLevel: "0.25",
  },
  {
    id: "4",
    sequence: 4,
    inspectionItem: "\u6d6a\u6d8c\u9632\u62a4\u9a8c\u8bc1",
    specification: "\u901a\u8fc7 4KV \u6d6a\u6d8c\u6d4b\u8bd5",
    lsl: "4",
    usl: "",
    measurementTool: "\u6d6a\u6d8c\u6d4b\u8bd5\u4eea",
    defectLevel: "CR",
    aqlLevel: "0.1",
  },
  {
    id: "5",
    sequence: 5,
    inspectionItem: "\u70b9\u4eae\u4e0e\u9891\u95ea\u68c0\u67e5",
    specification: "\u53d1\u5149\u6b63\u5e38\uff0c\u65e0\u5f02\u5e38\u9891\u95ea",
    lsl: "",
    usl: "",
    measurementTool: "\u901a\u7535\u6cbb\u5177 + \u9891\u95ea\u4eea",
    defectLevel: "MI",
    aqlLevel: "2.5",
  },
];
