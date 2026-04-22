// stores/useSegmentationLoadStore.ts
import { create } from 'zustand';

interface SegmentationLoadState {
  hasLoadedInitialSegmentations: Record<string, boolean>;
  lastStudyUID: string | null; // Track across components
  setLoaded: (studyUID: string, loaded: boolean) => void;
  resetForNewStudy: (studyUID: string) => boolean; // Returns true if actually reset
  getLoadedForStudy: (studyUID?: string) => boolean;
  clearAllLoaded: () => void;
}

export const useSegmentationLoadStore = create<SegmentationLoadState>((set, get) => ({
  hasLoadedInitialSegmentations: {},
  lastStudyUID: null,
  setLoaded: (studyUID, loaded) => set((state) => ({
    hasLoadedInitialSegmentations: { ...state.hasLoadedInitialSegmentations, [studyUID]: loaded }
  })),
  resetForNewStudy: (studyUID: string) => {
    const state = get();
    if (state.lastStudyUID === studyUID) return false; // No change
    
    console.log(`🔄 Store reset for NEW studyUID: ${studyUID}`);
    set({
      lastStudyUID: studyUID,
      hasLoadedInitialSegmentations: { ...state.hasLoadedInitialSegmentations, [studyUID]: false }
    });
    return true;
  },
  getLoadedForStudy: (studyUID?: string) => {
    if (!studyUID) return false;
    return get().hasLoadedInitialSegmentations[studyUID] ?? false;
  },
  clearAllLoaded: () => {
    console.log('🧹 Store: Cleared ALL hasLoaded flags');
        set({ 
      hasLoadedInitialSegmentations: {},
      lastStudyUID: null 
    });
  },
}));