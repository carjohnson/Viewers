// src/hooks/useAnnotationPosting.ts
import { postAnnotations } from '../handlers/postAnnotations';

// useAnnotationPosting.ts
export const useAnnotationPosting = ({
  patientName,
  measurementListRef,
  setIsSaved,
}) => {
  return ({ allAnnotations, dropdownSelectionMap, suppressAlert, pendingAlertUIDsRef  }) => {
    postAnnotations({
      allAnnotations,
      dropdownSelectionMap,
      patientName,
      measurementListRef,
      setIsSaved,
      suppressAlert,
      pendingAlertUIDsRef,
    });
  };
};