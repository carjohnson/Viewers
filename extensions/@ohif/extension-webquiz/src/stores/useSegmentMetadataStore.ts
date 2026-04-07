// stores/useSegmentMetadataStore.ts
// Maintain segment metadata to persist between extensions
//
// NOTE: segmentIndex reflects the mask value in the DICOM Seg file (1-based indexing)
//

import { create } from 'zustand';
import { OhifSegmentInfo, SegmentMetadata } from './../models/SegmentationData';
import { computeSegmentDataIsComplete } from '../utils/segmentationUtils';

interface Store {
  // Quiz metadata: segmentationId → segmentIndex → SegmentMetadata
  // metadata: Record<string, Record<number, SegmentMetadata>>;

  // setMetadata: (
  //   segmentationId: string,
  //   segmentIndex: number,
  //   metadata: SegmentMetadata
  // ) => void;

  // updateMetadata: (
  //   segmentationId: string,
  //   segmentIndex: number,
  //   partial: Partial<SegmentMetadata>
  // ) => void;

  // getMetadata: (
  //   segmentationId: string,
  //   segmentIndex: number
  // ) => SegmentMetadata | undefined;

  // OHIF info: segmentationId → segmentIndex → OhifSegmentInfo
  ohifInfo: Record<string, Record<number, OhifSegmentInfo>>;

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

  // clearMetadata: (segmentationId: string) => void;
}

export const useSegmentMetadataStore = create<Store>((set, get) => ({
  // metadata: {},
  ohifInfo: {},

  // -----------------------------
  // QUIZ METADATA
  // -----------------------------
  // setMetadata: (segmentationId, segmentIndex, metadata) =>
  //   set(state => {
  //     const isComplete = computeSegmentDataIsComplete(metadata);

  //     return {
  //       metadata: {
  //         ...state.metadata,
  //         [segmentationId]: {
  //           ...(state.metadata[segmentationId] || {}),
  //           [segmentIndex]: { ...metadata, isComplete },
  //         },
  //       },
  //     };
  //   }),

  // updateMetadata: (segmentationId, segmentIndex, partial) =>
  //   set(state => {
  //     const existing = state.metadata[segmentationId]?.[segmentIndex];
  //     if (!existing) return state;

  //     const merged: SegmentMetadata = {
  //       ...existing,
  //       ...partial,
  //     };

  //     const isComplete = computeSegmentDataIsComplete(merged);

  //     return {
  //       metadata: {
  //         ...state.metadata,
  //         [segmentationId]: {
  //           ...(state.metadata[segmentationId] || {}),
  //           [segmentIndex]: { ...merged, isComplete },
  //         },
  //       },
  //     };
  //   }),

  // getMetadata: (segmentationId, segmentIndex) =>
  //   get().metadata[segmentationId]?.[segmentIndex],


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

  getAllSegments: segmentationId =>
    get().ohifInfo[segmentationId],


  // -----------------------------
  // CLEAR METADATA FOR ONE SEGMENTATION
  // -----------------------------
  // clearMetadata: segmentationId =>
  //   set(state => {
  //     if (!state.metadata[segmentationId]) return state;

  //     const newMetadata = { ...state.metadata };
  //     delete newMetadata[segmentationId];

  //     return { metadata: newMetadata };
  //   }),
}));



interface Store {

  ohifInfo: Record<string, Record<number, OhifSegmentInfo>>;

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

}

// export const useSegmentMetadataStore = create<Store>((set, get) => ({
//   // metadata: {},
//   ohifInfo: {},

//   // -----------------------------
//   // QUIZ METADATA
//   // -----------------------------
//   // setMetadata: (segmentationId, segmentIndex, metadata) =>
//   //   set(state => {
//   //     const isComplete = computeSegmentDataIsComplete(metadata);

//   //     return {
//   //       metadata: {
//   //         ...state.metadata,
//   //         [segmentationId]: {
//   //           ...(state.metadata[segmentationId] || {}),
//   //           [segmentIndex]: { ...metadata, isComplete },
//   //         },
//   //       },
//   //     };
//   //   }),

//   // updateMetadata: (segmentationId, segmentIndex, partial) =>
//   //   set(state => {
//   //     const existing = state.metadata[segmentationId]?.[segmentIndex];
//   //     if (!existing) return state;

//   //     const merged: SegmentMetadata = {
//   //       ...existing,
//   //       ...partial,
//   //     };

//   //     const isComplete = computeSegmentDataIsComplete(merged);

//   //     return {
//   //       metadata: {
//   //         ...state.metadata,
//   //         [segmentationId]: {
//   //           ...(state.metadata[segmentationId] || {}),
//   //           [segmentIndex]: { ...merged, isComplete },
//   //         },
//   //       },
//   //     };
//   //   }),

//   // getMetadata: (segmentationId, segmentIndex) =>
//   //   get().metadata[segmentationId]?.[segmentIndex],


//   // -----------------------------
//   // OHIF SEGMENT INFO
//   // -----------------------------
//   setSegmentInfo: (segmentationId, segmentIndex, ohif) =>
//     set(state => ({
//       ohifInfo: {
//         ...state.ohifInfo,
//         [segmentationId]: {
//           ...(state.ohifInfo[segmentationId] || {}),
//           [segmentIndex]: ohif,
//         },
//       },
//     })),

//   getSegmentInfo: (segmentationId, segmentIndex) =>
//     get().ohifInfo[segmentationId]?.[segmentIndex],

//   getAllSegments: segmentationId =>
//     get().ohifInfo[segmentationId],


//   // -----------------------------
//   // CLEAR METADATA FOR ONE SEGMENTATION
//   // -----------------------------
//   // clearMetadata: segmentationId =>
//   //   set(state => {
//   //     if (!state.metadata[segmentationId]) return state;

//   //     const newMetadata = { ...state.metadata };
//   //     delete newMetadata[segmentationId];

//   //     return { metadata: newMetadata };
//   //   }),
// }));