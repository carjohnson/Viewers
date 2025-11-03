/**
 * Zustand store for managing study-level metadata within the WebQuiz extension.
 *
 * Centralizes access to:
 * - studyUID: Unique identifier for the current study
 * - frameUID: Frame of reference UID from the image plane module
 * - patientName: Patient's full name (from patientInfo service)
 * - patientId: Patient's ID (from patientInfo service)
 *
 * Populated reactively via:
 * - `useStudyInfo()` hook (polls for studyUID and frameUID)
 * - `usePatientInfo()` hook (provides patientName and patientId)
 *
 * Enables consistent access across tabs and OHIF modes (e.g. Custom extension, Measurements),
 * and replaces legacy stateService-based sync.
 *
 * Usage:
 *   const { studyInfo, setStudyInfo, clearStudyInfo } = useStudyInfoStore();
 *
 * Best Practices:
 * - Use selector syntax for reactive updates: useStudyInfoStore(state => state.studyInfo)
 * - Wrap `setStudyInfo()` in a `useEffect` to avoid stale or premature updates
 */
import { create } from 'zustand';

type StudyInfo = {
  patientName?: string;
  patientId?: string;
  studyUID?: string;
  frameUID?: string;
};

type StudyInfoStore = {
  studyInfo: StudyInfo | null;
  setStudyInfo: (info: StudyInfo) => void;
  clearStudyInfo: () => void;
};

export const useStudyInfoStore = create<StudyInfoStore>((set) => ({
  studyInfo: null,
  setStudyInfo: (info) => set({ studyInfo: info }),
  clearStudyInfo: () => set({ studyInfo: null }),
}));