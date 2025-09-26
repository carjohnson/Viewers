export type AnnotationStats = {
  uid: string;
  area?: number;
  length?: number;
  mean?: number;
  stdDev?: number;
  [key: string]: unknown;
};