// stores/useSegmentMetadataStore.ts
import { create } from 'zustand';
import { SegmentInfo } from './../models/SegmentationData';


export interface SegmentationMetadata {
  [segmentationId: string]: SegmentInfo[];
}

interface Store {
  metadata: SegmentationMetadata;
  setMetadata: (segmentationId: string, segmentLabels: SegmentInfo[]) => void;
  getMetadata: (segmentationId: string) => SegmentInfo[] | undefined;
}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  metadata: {},
  setMetadata: (segmentationId, segmentLabels) => 
    set((state) => ({
      metadata: { ...state.metadata, [segmentationId]: segmentLabels },
    })),
  getMetadata: (segmentationId) => get().metadata[segmentationId],
}));
