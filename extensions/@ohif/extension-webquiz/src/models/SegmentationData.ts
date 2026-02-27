export type SegmentationData = {
  segmentationId: string;
  label: string;
  type?: string;
  representationData: any;
  segments?: Record<number, any>;
};