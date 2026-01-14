// src/handlers/postAnnotations.ts
import { getSeriesUIDFromMeasurement } from './../utils/annotationUtils';

// ======== post annotations to Server
export const postAnnotations = ({
  allAnnotations,
  dropdownSelectionMap,
  studyUID,
  measurementListRef,
}: {
  allAnnotations: any[];
  dropdownSelectionMap: Record<string, number>;
  studyUID: string;
  measurementListRef: React.MutableRefObject<any[]>;
}) => {
  try {
    // Filter valid annotations
    //    Some annotation objects do not include the cached stats
    //    These hold some metadata and are not needed
    const validAnnotations = allAnnotations.filter(
      ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
    );

    // Validate scores and prepare post payload
    const annotationsWithStats: any[] = [];
    const invalidUIDsMissingScore: string[] = [];

    validAnnotations.forEach((ann) => {
      const uid = ann.annotationUID;
      const selectedScore = dropdownSelectionMap[uid];
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

    window.parent.postMessage(
      {
        type: 'annotations',
        annotationObjects: measurementListRef.current,
        studyUID,
      },
      '*'
    );
  } catch (err) {
      console.error('postAnnotation :: Error posting annotations:', err);
  }

};