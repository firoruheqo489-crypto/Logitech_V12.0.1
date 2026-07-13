export const FLICKER_COMPLIANCE_RULES = {
  flickerPercent: {
    noRiskMax: 1,
    lowRiskMax: 8,
    unit: "%",
    standard: "IEEE 1789 low-risk reference",
  },
  pst: {
    acceptablePattern: /pass|可接受/i,
    standard: "IEC TR 61547-1:2015",
  },
  svm: {
    erpPassPattern: /pass/i,
    standard: "CIE TN:006-2016",
  },
} as const;

export type FlickerEvidenceInput = {
  flickerPercent?: number | null;
  pstResult?: string | null;
  svmErp?: string | null;
};

export type FlickerEvidenceEvaluation = {
  verdict: "PASS" | "FAIL";
  status: "parsed" | "fail";
  fail: boolean;
  flickerFail: boolean;
  pstFail: boolean;
  svmFail: boolean;
  lowRisk: boolean;
};

export function isPstAcceptable(result: string | null | undefined) {
  return !result || FLICKER_COMPLIANCE_RULES.pst.acceptablePattern.test(result);
}

export function isSvmErpPass(erp: string | null | undefined) {
  return !erp || FLICKER_COMPLIANCE_RULES.svm.erpPassPattern.test(erp);
}

export function evaluateFlickerEvidence(evidence: FlickerEvidenceInput): FlickerEvidenceEvaluation {
  const flickerPercent = evidence.flickerPercent;
  const flickerFail =
    flickerPercent != null && flickerPercent > FLICKER_COMPLIANCE_RULES.flickerPercent.lowRiskMax;
  const pstFail = !isPstAcceptable(evidence.pstResult);
  const svmFail = !isSvmErpPass(evidence.svmErp);
  const fail = flickerFail || pstFail || svmFail;
  const lowRisk =
    !fail &&
    flickerPercent != null &&
    flickerPercent > FLICKER_COMPLIANCE_RULES.flickerPercent.noRiskMax;

  return {
    verdict: fail ? "FAIL" : "PASS",
    status: fail ? "fail" : "parsed",
    fail,
    flickerFail,
    pstFail,
    svmFail,
    lowRisk,
  };
}
