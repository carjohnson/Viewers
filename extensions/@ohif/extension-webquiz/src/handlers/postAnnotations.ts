// src/handlers/postAnnotations.ts
import { getSeriesUIDFromMeasurement } from './../utils/annotationUtils';

// ======== post annotations to Server
export const postAnnotations = ({
    allAnnotations,
    dropdownSelectionMap,
    patientName,
    measurementListRef,
    setIsSaved,
}) => {

  // Filter valid annotations
  //    Some annotation objects do not include the cached stats
  //    These hold some metadata and are not needed
  const validAnnotations = allAnnotations.filter(
    ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
  );

  // Validate scores and prepare post payload
  const annotationsWithStats = [];
  const invalidUIDsMissingScore = [];
  validAnnotations.forEach((ann) => {
    const uid = ann.annotationUID;
    const selectedScore = dropdownSelectionMap[uid]; // use current state
    const selectedSeriesUID = getSeriesUIDFromMeasurement(ann);

    if (typeof selectedScore === 'number' && selectedScore >= 1 && selectedScore <= 5) {
      (ann as any).data.suspicionScore = selectedScore;
      (ann as any).seriesUID = selectedSeriesUID;
      annotationsWithStats.push(ann);
    } else {
      invalidUIDsMissingScore.push(uid);
    }
  });

  // Update ref for post
  measurementListRef.current = [...annotationsWithStats];

  // Post to server
  window.parent.postMessage({
    type: 'annotations',
    annotationObjects: measurementListRef.current,
    patientid: patientName
  }, '*');

  setIsSaved(true);

};
