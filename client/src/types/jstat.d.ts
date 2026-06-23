declare module "jstat" {
  export const jStat: {
    sum(values: number[]): number;
    mean(values: number[]): number;
    variance(values: number[], flag?: boolean): number;
    normal: {
      cdf(x: number, mean: number, std: number): number;
      inv(p: number, mean: number, std: number): number;
      pdf(x: number, mean: number, std: number): number;
    };
    studentt: {
      cdf(x: number, dof: number): number;
      inv(p: number, dof: number): number;
      pdf(x: number, dof: number): number;
    };
    centralF: {
      cdf(x: number, df1: number, df2: number): number;
      inv(p: number, df1: number, df2: number): number;
      pdf(x: number, df1: number, df2: number): number;
    };
    chisquare: {
      cdf(x: number, dof: number): number;
      inv(p: number, dof: number): number;
      pdf(x: number, dof: number): number;
    };
  };
}
