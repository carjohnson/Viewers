// src/hooks/useAnnotationPosting.ts
import { postAnnotations } from '../handlers/postAnnotations';

// useAnnotationPosting.ts
export const useAnnotationPosting = ({
  patientName,
  measurementListRef,
  setIsSaved,
}) => {
  return ({ allAnnotations, selectionMap }) => {
    postAnnotations({
      allAnnotations,
      selectionMap,
      patientName,
      measurementListRef,
      setIsSaved,
    });
  };
};