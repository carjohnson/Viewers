// annotationEventHandlers.ts

import {  rebuildMapAndPostAnnotations} from './../utils/annotationUtils';
import { TriggerPostArgs } from '../models/TriggerPostArgs';



//=========================================================
export function handleMeasurementAdded({
  measurement,
  measurementService,
  showModal,
  setActiveUID,
  debouncedShowScoreModal,
  pendingAnnotationUIDRef,
  isSeriesValidRef,
  listOfUsersAnnotationsRef,
  isStudyCompletedRef,
}: {
  measurement: any;
  measurementService: any;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
  setActiveUID: (uid: string) => void;
  debouncedShowScoreModal: (uid: string) => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  isSeriesValidRef: React.MutableRefObject<boolean>;
  listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;
  isStudyCompletedRef: React.MutableRefObject<boolean>;
}) {

  if (isStudyCompletedRef.current) {
    measurementService.remove(measurement?.uid);
    showModal({
      title: 'Case Locked',
      message: 'This case has been marked completed. No further annotations allowed.',
      showCancel: false,
    });
    return;
  }

  // console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current,  measurement);
  setTimeout(() => {
    try {
      const uid = measurement?.uid;
      const seriesUID = measurement?.referenceSeriesUID;

      // console.log('🕒 Delayed MEASUREMENT_ADDED check:', isSeriesValidRef, pendingAnnotationUIDRef.current, { uid, seriesUID });

      // Flatten all annotationUIDs with scores
      const annotationsObj = listOfUsersAnnotationsRef.current;
      const annotationGroups = annotationsObj ? Object.values(annotationsObj) : [];

      const scoredUIDs = annotationGroups
        .flatMap(group => group.data || [])
        .filter(a => a?.annotationUID && a?.data?.suspicionScore != null)
        .map(a => a.annotationUID);

      const isAlreadyScored = scoredUIDs.includes(uid);
      // console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current, isAlreadyScored, listOfUsersAnnotationsRef.current, scoredUIDs);

      if (
        uid &&
        uid === pendingAnnotationUIDRef.current &&
        isSeriesValidRef.current === false
      ) {
        console.warn('🧹 Removing measurement on invalid series:', uid);
        measurementService.remove(uid);

        showModal({
          title: 'Invalid Series',
          message:
            'This series is not to be annotated.',
            showCancel: false,
          });

        pendingAnnotationUIDRef.current = null;

      } else {
        // console.log(' *** IN MEASUREMENT ADDED HANDLER :', isSeriesValidRef, pendingAnnotationUIDRef.current, uid);

        setActiveUID(uid);

        if (!isAlreadyScored) {
          debouncedShowScoreModal(uid);
        } else {
          console.log('🛑 Skipping score modal — annotation already scored:', uid);
        }

        pendingAnnotationUIDRef.current = null;

      }
    } catch (error) {
      console.error('🔥 Error in delayed MEASUREMENT_ADDED block:', error);
    }
  }, 50);
}
//=========================================================

export const handleAnnotationChanged = ({
  event,
}: {
  event: any;
}) => {
  try {
    const { annotation: changedAnnotation } = event?.detail ?? {};
    if (!changedAnnotation) return;
    console.log(' *** IN HANDLE ANNOTATION CHANGE ... changedAnnotation', changedAnnotation);
  } catch (err) {
    console.error('Error in handleAnnotationChanged:', err);
  }
};



//=========================================================
export const handleMeasurementUpdated = ({
  measurement,
  debouncedUpdateStats,
  pendingAnnotationUIDRef,
}: {
  measurement: any;
  debouncedUpdateStats: () => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
}) => {
  try {
    if (!measurement) return;

    // console.log(' *** IN HANDLE MEASURMENT CHANGE ... measurement', measurement);

    pendingAnnotationUIDRef.current = measurement.uid;

    if (typeof debouncedUpdateStats === 'function') {
      debouncedUpdateStats();
    }
  } catch (err) {
    console.error('Error in handleMeasurementUpdated:', err);
  }
};

//=========================================================
// this handler takes effect AFTER the removal of the measurement - it is reactive
export const handleMeasurementRemoved = ({
  measurement,
  setDropdownSelectionMap,
  triggerPost,
}: {
  measurement: any;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
}) => {

  // Backend does not 'remove' entries from the database.
  //    It updates the database based on the current list of annotations.
  //    If the list does not include an annotation that is in the database,
  //    the backend will remove it.
  // We let the rebuild map function remove an annotation from OHIF's list 
  //  of current annotations if the variable is not empty
  const annotationUID = measurement?.uid;

  // >>>>>>>> FOR DEBUG <<<<<<<<<<
  // console.log(' *** IN MEASUREMENT REMOVED HANDLER:' ,  annotationUID);
  // console.trace('handleMeasurementRemoved trace');

  rebuildMapAndPostAnnotations(setDropdownSelectionMap, triggerPost, annotationUID);
};

//=========================================================
