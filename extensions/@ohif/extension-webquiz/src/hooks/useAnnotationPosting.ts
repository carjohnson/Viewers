// src/hooks/useAnnotationPosting.ts
import { postAnnotations } from '../handlers/postAnnotations';
import { TriggerPostArgs } from '../models/TriggerPostArgs';

export const useAnnotationPosting = ({
  patientName,
  measurementListRef,
  }) => {
  return ({ allAnnotations, dropdownSelectionMap  } : TriggerPostArgs) => {
    postAnnotations({
      allAnnotations,
      dropdownSelectionMap,
      patientName,
      measurementListRef,
    });
  };
};