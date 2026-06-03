// stores/useSegmentMetadataStore.ts
// Maintain segment metadata to persist between extensions
//

import { create } from 'zustand';
import { OhifSegmentInfo } from './../models/SegmentationData';

interface Store {

  // OHIF info: segmentationId → segmentIndex → OhifSegmentInfo
  ohifInfo: Record<string, Record<number, OhifSegmentInfo>>;

  getAllSegmentationsIds: () => string[];

  clearSegmentation: (segmentationId: string) => void;

  setSegmentInfo: (
    segmentationId: string,
    segmentIndex: number,
    ohif: OhifSegmentInfo
  ) => void;

  getSegmentInfo: (
    segmentationId: string,
    segmentIndex: number
  ) => OhifSegmentInfo | undefined;

  removeSegmentInfo: (
    segmentationId: string,
    segmentIndex: number,
  ) => void;

  getAllSegments: (
    segmentationId: string
  ) => Record<number, OhifSegmentInfo> | undefined;

  clearAllSegmentInfo: (
    segmentationId: string,
  ) => void;

}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  // metadata: {},
  ohifInfo: {},

  // -----------------------------
  // STORED SEGMENTATIONS
  // -----------------------------
  getAllSegmentationsIds: () => Object.keys(get().ohifInfo),

  clearSegmentation: segmentationId => {
    set(state => {
      const updated = { ...state.ohifInfo };
      delete updated[segmentationId];
      return { ohifInfo: updated };
    })
  },


  // -----------------------------
  // OHIF SEGMENT INFO
  // -----------------------------
  setSegmentInfo: (segmentationId, segmentIndex, ohif) =>
    set(state => ({
      ohifInfo: {
        ...state.ohifInfo,
        [segmentationId]: {
          ...(state.ohifInfo[segmentationId] || {}),
          [segmentIndex]: ohif,
        },
      },
    })),

  getSegmentInfo: (segmentationId, segmentIndex) =>
    get().ohifInfo[segmentationId]?.[segmentIndex],

  removeSegmentInfo: (segmentationId, segmentIndex) =>
    set(state => {
      const seg = state.ohifInfo[segmentationId];
      if (!seg) return state;

      const updatedSeg = { ...seg };
      delete updatedSeg[segmentIndex];

      return {
        ohifInfo: {
          ...state.ohifInfo,
          [segmentationId]: updatedSeg,
        },
      };
    }),

  getAllSegments: segmentationId =>
    get().ohifInfo[segmentationId],


  clearAllSegmentInfo: segmentationId =>
  set(state => ({
    ohifInfo: {
      ...state.ohifInfo,
      [segmentationId]: {}   // keep the key, wipe the segments
    }
  })),

}));

