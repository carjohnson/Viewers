// stores/useSegmentMetadataStore.ts
// Maintain segment metadata to persist between extensions

import { create } from 'zustand';
import { SegmentationStats } from './../models/SegmentationData';


export interface OhifSegmentInfo {
  segmentIndex: number;
  label: string;
  cachedStats?: SegmentationStats;
}

export interface SegmentationMetadata {
  [segmentationId: string]: OhifSegmentInfo[];
}

interface Store {
  metadata: SegmentationMetadata;
  setMetadata: (segmentationId: string, segmentLabels: OhifSegmentInfo[]) => void;
  getMetadata: (segmentationId: string) => OhifSegmentInfo[] | undefined;
  clearMetadata: (segmentationId: string) => void; 
}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  metadata: {},

  setMetadata: (segmentationId, segmentLabels) => 
    set((state) => ({
      metadata: { ...state.metadata, [segmentationId]: segmentLabels },
    })),
  
  getMetadata: (segmentationId) => get().metadata[segmentationId],

  clearMetadata: (segmentationId) =>
    set(state => {
      if (!state.metadata[segmentationId]) {
        return state;
      }
      const newMetadata = { ...state.metadata };
      delete newMetadata[segmentationId];
      return { metadata: newMetadata };
    }),

}));
