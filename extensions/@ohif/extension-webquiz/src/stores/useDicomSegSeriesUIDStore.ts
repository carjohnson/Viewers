import { create } from 'zustand';

// Set up global reactive store for mapping the DICOM SEG series UID with the segmentation UID

interface DicomSegSeriesUIDState {
  dicomSegSeriesUIDMap: Map<string, string>;
  getDicomSegSeriesUIDMap: (segmentationId: string) => string | undefined;
  setDicomSegSeriesUIDMap: (segmentationId: string, uid: string) => void;
}

export const useDicomSegSeriesUIDStore = create<DicomSegSeriesUIDState>((set, get) => ({
  dicomSegSeriesUIDMap: new Map<string, string>(),

  getDicomSegSeriesUIDMap: (segmentationId: string) => {
    return get().dicomSegSeriesUIDMap.get(segmentationId);
  },

  setDicomSegSeriesUIDMap: (segmentationId: string, uid: string) =>
    set(state => {
      const newMap = new Map(state.dicomSegSeriesUIDMap);
      newMap.set(segmentationId, uid);
      return { dicomSegSeriesUIDMap: newMap };
    }),
}));
