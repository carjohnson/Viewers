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
