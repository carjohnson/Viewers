// src/hooks/useAnnotationPosting.ts
import { postAnnotations } from '../handlers/postAnnotations';

// useAnnotationPosting.ts
export const useAnnotationPosting = ({
  patientName,
  measurementListRef,
  setIsSaved,
}) => {
      console.log('🧠 patientName being sent:', patientName);

  return ({ allAnnotations, dropdownSelectionMap }) => {
    postAnnotations({
      allAnnotations,
      dropdownSelectionMap,
      patientName,
      measurementListRef,
      setIsSaved,
    });
  };
};