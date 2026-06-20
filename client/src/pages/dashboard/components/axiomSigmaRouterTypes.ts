export type StatDomain =
  | "MEANS"
  | "VARIANCES"
  | "PROPORTIONS"
  | "NON_PARAMETRIC"
  | "EQUIVALENCE";

export type TestVariant =
  | "1_SAMPLE_Z"
  | "1_SAMPLE_T"
  | "2_SAMPLE_T"
  | "PAIRED_T"
  | "1_WAY_ANOVA"
  | "2_WAY_ANOVA"
  | "1_VAR_CHI_SQ"
  | "2_VAR_F"
  | "MULTI_VAR_LEVENE"
  | "1_PROP_Z"
  | "2_PROP_Z"
  | "CHI_SQ_CONTINGENCY"
  | "1_SAMP_WILCOXON"
  | "MANN_WHITNEY"
  | "KRUSKAL_WALLIS"
  | "2_SAMP_EQUIVALENCE";

export type TailDirection = "TWO_TAILED" | "LEFT_TAILED" | "RIGHT_TAILED";
export type PayloadMode = "1_VECTOR" | "2_VECTORS" | "MULTI_VECTORS" | "SUMMARY_STATS" | "FACTOR_MATRIX";

export interface AdjudicationState {
  activeDomain: StatDomain;
  activeTest: TestVariant;
  tailDirection: TailDirection;
  payloadMode: PayloadMode;
}
