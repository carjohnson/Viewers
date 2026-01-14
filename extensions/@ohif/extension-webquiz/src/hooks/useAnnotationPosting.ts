// src/hooks/useAnnotationPosting.ts
import { postAnnotations } from '../handlers/postAnnotations';
import { TriggerPostArgs } from '../models/TriggerPostArgs';
import { removeDuplicatesByUID } from '../utils/annotationUtils';

export const useAnnotationPosting = ({
  studyUID,
  measurementListRef,
  }) => {
  return ({ allAnnotations, dropdownSelectionMap  } : TriggerPostArgs) => {
    const uniqueAnnotations = removeDuplicatesByUID(allAnnotations);

    postAnnotations({
      allAnnotations: uniqueAnnotations,
      dropdownSelectionMap,
      studyUID,
      measurementListRef,
    });
  };
};