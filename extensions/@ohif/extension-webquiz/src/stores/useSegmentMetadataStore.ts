// stores/useSegmentMetadataStore.ts
// Maintain segment metadata to persist between extensions
//

import { create } from 'zustand';
import { SegmentRecord } from './../models/SegmentationData';

interface Store {

  // SegmentRecord info: segmentationId → segmentIndex → SegmentRecord
  segmentRecord: Record<string, Record<number, SegmentRecord>>;

  getAllSegmentationsIds: () => string[];

  clearSegmentation: (segmentationId: string) => void;

  setSegmentInfo: (
    segmentationId: string,
    segmentIndex: number,
    segmentRecord: SegmentRecord
  ) => void;

  getSegmentInfo: (
    segmentationId: string,
    segmentIndex: number
  ) => SegmentRecord | undefined;

  removeSegmentInfo: (
    segmentationId: string,
    segmentIndex: number,
  ) => void;

  getAllSegments: (
    segmentationId: string
  ) => Record<number, SegmentRecord> | undefined;

  clearAllSegmentInfo: (
    segmentationId: string,
  ) => void;

}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  segmentRecord: {},

  // -----------------------------
  // STORED SEGMENTATIONS
  // -----------------------------
  getAllSegmentationsIds: () => Object.keys(get().segmentRecord),

  clearSegmentation: segmentationId => {
    set(state => {
      const updated = { ...state.segmentRecord };
      delete updated[segmentationId];
      return { segmentRecord: updated };
    })
  },


  // -----------------------------
  // SEGMENT RECORD INFO
  // -----------------------------
  setSegmentInfo: (segmentationId, segmentIndex, segmentRecord) =>
    set(state => ({
      segmentRecord: {
        ...state.segmentRecord,
        [segmentationId]: {
          ...(state.segmentRecord[segmentationId] || {}),
          [segmentIndex]: segmentRecord,
        },
      },
    })),

  getSegmentInfo: (segmentationId, segmentIndex) =>
    get().segmentRecord[segmentationId]?.[segmentIndex],

  removeSegmentInfo: (segmentationId, segmentIndex) =>
    set(state => {
      const seg = state.segmentRecord[segmentationId];
      if (!seg) return state;

      const updatedSeg = { ...seg };
      delete updatedSeg[segmentIndex];

      return {
        segmentRecord: {
          ...state.segmentRecord,
          [segmentationId]: updatedSeg,
        },
      };
    }),

  getAllSegments: segmentationId =>
    get().segmentRecord[segmentationId],


  clearAllSegmentInfo: segmentationId =>
  set(state => ({
    segmentRecord: {
      ...state.segmentRecord,
      [segmentationId]: {}   // keep the key, wipe the segments
    }
  })),

}));

