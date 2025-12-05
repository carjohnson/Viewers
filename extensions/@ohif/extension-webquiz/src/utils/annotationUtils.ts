// src/utils/annotationUtils.ts
import { AnnotationStats } from '../models/AnnotationStats';
import { annotation } from '@cornerstonejs/tools';
import { debounce } from './debounce';

import {  getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { TriggerPostArgs } from '../models/TriggerPostArgs';



//=========================================================
export const buildDropdownSelectionMapFromFetched = (lFetchedAnnotations: any[]) => {
  const newDropdownSelectionMap: Record<string, number> = {};

  lFetchedAnnotations.forEach(({ data }) => {
    data.forEach(annotationObj => {
      if (
        annotationObj &&
        typeof annotationObj.annotationUID === 'string' &&
        annotationObj.annotationUID.length > 0 &&
        typeof annotationObj.data.suspicionScore === 'number'
      ) {
        newDropdownSelectionMap[annotationObj.annotationUID] = annotationObj.data.suspicionScore;
      }
    });
  });

  return newDropdownSelectionMap;
};

//=========================================================
export const buildDropdownSelectionMapFromState = (annotations: any[]) => {
  const newDropdownSelectionMap: Record<string, number> = {};

  annotations.forEach(annotationObj => {
    const { annotationUID, data } = annotationObj;
    const suspicionScore = data?.suspicionScore;

    if (
      typeof annotationUID === 'string' &&
      annotationUID.length > 0 &&
      typeof suspicionScore === 'number'
    ) {
      newDropdownSelectionMap[annotationUID] = suspicionScore;
    }
  });
  return newDropdownSelectionMap;
};

//=========================================================
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

//=========================================================
// debounced wrapper for getAnnotationStats
// delay acquiring stats to let ohif complete the add of the annotation
export const createDebouncedStatsUpdater = (
  setAnnotationData: (data: any) => void,
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  triggerPost: (args: TriggerPostArgs) => void
) =>
  debounce(() => {
    // 1. Update stats
    const stats = getAnnotationsStats();
    setAnnotationData(stats);

    // 2. Rebuild dropdown map
    const allAnnotations = annotation.state.getAllAnnotations?.() || [];
    const newMap = buildDropdownSelectionMapFromState(allAnnotations);
    setDropdownSelectionMap(newMap);

    // 3. Trigger POST
    triggerPost({ allAnnotations, dropdownSelectionMap: newMap });
  }, 300); 

//=========================================================
// debounced wrapper for modal trigger
// delay showing modal to ensure annotations have settled
export const createDebouncedShowScoreModalTrigger = (
  setShowScoreModal: (show: boolean) => void,
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>
) =>
  debounce((uid: string) => {
    // set UID then open modal
    pendingAnnotationUIDRef.current = uid;
    setShowScoreModal(true);
  }, 300);
//=========================================================
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

//=========================================================
export const customizeAnnotationLabel = (
  uid: string,
) => {
  const allAnnotations = annotation.state.getAllAnnotations?.() || [];

  // Label assignment
  const userInfo = getUserInfo();
  const measurementIndex = getLastIndexStored(allAnnotations) + 1;
  const customLabel = `${userInfo.username}_${measurementIndex}`;

  const target = allAnnotations.find(a => a.annotationUID === uid);
  if (target && target.data.label === "") {
    target.data.label = customLabel;
  }
};

//=========================================================
export const rebuildMapAndPostAnnotations = (
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  triggerPost: (args: TriggerPostArgs) => void,
  removedAnnotationUID?: string,
) => {
  const allAnnotations = annotation.state.getAllAnnotations?.() || [];

  // create adjusted list of annotations if the triggerPost args have 
  // a valid sRemovedAnnotationUID string
  // Filter out the removed annotation if UID is provided
  const adjustedAnnotationsList =
    removedAnnotationUID && removedAnnotationUID.trim().length > 0
      ? allAnnotations.filter(a => a.annotationUID !== removedAnnotationUID)
      : allAnnotations;
  
  // Dropdown map
  const newMap = buildDropdownSelectionMapFromState(adjustedAnnotationsList);
  setDropdownSelectionMap(newMap);
  // console.log(' *** IN REBUILD:', removedAnnotationUID, allAnnotations, adjustedAnnotationsList, newMap);

  // Trigger POST
  triggerPost({ allAnnotations: adjustedAnnotationsList, dropdownSelectionMap: newMap });
};

//=========================================================
/**
 * Extracts the Series UID from a measurement object's cachedStats.imageId
 * @param measurement - The measurement object containing cachedStats.imageId
 * @returns The Series UID string, or null if not found
 */
export function getSeriesUIDFromMeasurement(measurement: any): string | null {
  try {
    const cachedStats = measurement?.data?.cachedStats;
    if (!cachedStats) return null;

    // Grab the first key that starts with "imageId:"
    const keyWithImageId = Object.keys(cachedStats).find(k => k.startsWith('imageId:'));
    if (!keyWithImageId) return null;

    // Strip off the "imageId:" prefix
    const imageId = keyWithImageId.replace(/^imageId:/, '');

    // Extract the series UID
    const match = imageId.match(/\/series\/([^/]+)\//);
    return match ? match[1] : null;
  } catch (err) {
    console.error('Error extracting series UID:', err);
    return null;
  }
}

//=========================================================
// utility to lock the annotations when rehydrating after changing studies
//  or when the study is marked as complete.
export const lockAllAnnotations = ({
  annotation,
  userInfo,
  isStudyCompletedRef,
}: {
  annotation: any;
  userInfo: { role?: string };
  isStudyCompletedRef: React.MutableRefObject<boolean>;
}) => {
  // console.log(' *** IN UTILS LOCK', userInfo?.role, isStudyCompletedRef.current, annotation)
  const allAnnotations = annotation.state.getAllAnnotations();
  allAnnotations.forEach(ann => {
    ann.isLocked = userInfo?.role === 'admin' || isStudyCompletedRef.current;
  });

  console.log(
    `${isStudyCompletedRef.current ? '🔒' : '🔓'} In utils - Locked state annotations for study`
  );
};