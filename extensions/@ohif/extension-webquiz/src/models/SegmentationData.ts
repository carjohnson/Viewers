// =====================================
export interface OhifSegmentInfo {
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
export type  SegmentationStats = {
  voxelCount: number;
  volume?: number; // in mm³, optional if not always calculated
  namedStats?: Record<string, any>; // e.g., { majorAxis: number, minorAxis: number }
  // Add other known stats properties from updateSegmentationStats
}

// =====================================
export type SegmentMetadata = {
  groundTruth: string;
  referenceStandardMethod: string;
  hepaticSegment: string[];
  isComplete: boolean;
}

