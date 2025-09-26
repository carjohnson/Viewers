// src/utils/annotationUtils.ts
import { AnnotationStats } from '../models/AnnotationStats';
import { annotation } from '@cornerstonejs/tools';


export const buildSelectionMap = (lAnnotations: any[]) => {
  const newSelectionMap: Record<string, number> = {};

  lAnnotations.forEach(({ data }) => {
    data.forEach(annotationObj => {
      if (
        annotationObj &&
        typeof annotationObj.annotationUID === 'string' &&
        annotationObj.annotationUID.length > 0 &&
        typeof annotationObj.suspicionScore === 'number'
      ) {
        newSelectionMap[annotationObj.annotationUID] = annotationObj.suspicionScore;
      }
    });
  });

  return newSelectionMap;
};

// function to get list of all cached annotation stats
//  also store the annotation uid
export const getAnnotationsStats = (
//   annotation: any
): AnnotationStats[] => {
  const lo_annotationStats: AnnotationStats[] = [];
  const allAnnotations = annotation.state.getAllAnnotations();

  allAnnotations.forEach((ann) => {
    const stats = ann.data?.cachedStats as AnnotationStats;
    const uid = ann.annotationUID;

    if (
      stats &&
      Object.keys(stats).length > 0 &&
      uid &&
      !lo_annotationStats.some(existing => existing.uid === uid)
    ) {
      lo_annotationStats.push({ ...stats, uid });
    }
  });

  return lo_annotationStats;
};

// src/utils/annotationUtils.ts

export const getLastIndexStored = (allAnnotations: any[]): number => {
  let iLastIndex = 0;

  allAnnotations.forEach((oAnnotation) => {
    const sLabel = oAnnotation?.data?.label;
    if (sLabel) {
      let iCurrentIndex = parseInt(sLabel.split('_').pop() ?? '0', 10);
      if (isNaN(iCurrentIndex)) {
        iCurrentIndex = 99;
      }
      iLastIndex = Math.max(iLastIndex, iCurrentIndex);
    }
  });

  return iLastIndex;
};