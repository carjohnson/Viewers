// =====================================
export interface SegmentRecord {
  segmentIndex: number;
  label: string;
  cachedStats?: SegmentationStats;
  quizSegmentMetadata?: SegmentMetadata;
}

// =====================================
export type SegmentationData = {
  segmentationId: string;
  label: string;
  type?: string;
  representationData: any;
  segments?: Record<number, any>;
}

// =====================================
export interface SegmentServiceState {
  label?: string;
  color?: [number, number, number, number];
  active?: boolean;
  cachedStats?: Record<string, any>;
  visibility?: boolean;
  locked?: boolean;
};

// =====================================
export type SegmentMetadata = {
  groundTruth: string;
  referenceStandardMethod: string;
  hepaticSegment: string[];
  isComplete: boolean;
  dicomSegMaskValue?: number;
}

// =====================================
export const DEFAULT_SEGMENT_METADATA: SegmentMetadata = {
  groundTruth: "",
  referenceStandardMethod: "",
  hepaticSegment: [],
  isComplete: false,
};

// =====================================

// =====================================
