// stores/useSegmentMetadataStore.ts
// Maintain segment metadata to persist between extensions
//
// segmentIndex reflects the mask value in the DICOM Seg file (1-based indexing)
//

import { create } from 'zustand';
import { OhifSegmentInfo, SegmentationMetadataStore } from './../models/SegmentationData';


interface Store {
  metadata: SegmentationMetadataStore;

  setSegmentInfo: (
    segmentationId: string,
    segmentIndex: number,
    ohif: OhifSegmentInfo
  ) => void;

  getSegmentInfo: (
    segmentationId: string,
    segmentIndex: number
  ) => OhifSegmentInfo | undefined;

  getAllSegments: (
    segmentationId: string
  ) => Record<number, OhifSegmentInfo> | undefined;

  clearMetadata: (segmentationId: string) => void;
}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  metadata: {},

  setSegmentInfo: (segmentationId, segmentIndex, ohif) =>
    set(state => ({
      metadata: {
        ...state.metadata,
        [segmentationId]: {
          ...(state.metadata[segmentationId] || {}),
          [segmentIndex]: ohif,
        },
      },
    })),

  getSegmentInfo: (segmentationId, segmentIndex) =>
    get().metadata[segmentationId]?.[segmentIndex],

  getAllSegments: segmentationId =>
    get().metadata[segmentationId],

  clearMetadata: segmentationId =>
    set(state => {
      if (!state.metadata[segmentationId]) return state;
      const newMetadata = { ...state.metadata };
      delete newMetadata[segmentationId];
      return { metadata: newMetadata };
    }),
}));
