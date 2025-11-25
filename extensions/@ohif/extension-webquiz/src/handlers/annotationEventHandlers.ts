// annotationEventHandlers.ts

import { annotation } from '@cornerstonejs/tools';
import { getLastIndexStored, buildDropdownSelectionMapFromState } from './../utils/annotationUtils';
import { getUserInfo } from '../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
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
  isSeriesAnnotationsCompletedRef,
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
  isSeriesAnnotationsCompletedRef: React.MutableRefObject<boolean>;
}) {

  if (isSeriesAnnotationsCompletedRef.current) {
    measurementService.remove(measurement?.uid);
    showModal({
      title: 'Series Locked',
      message: 'This series has been marked completed. No further annotations allowed.',
      showCancel: false,
    });
    return;
  }

  console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current,  measurement);
  setTimeout(() => {
    try {
      const uid = measurement?.uid;
      const seriesUID = measurement?.referenceSeriesUID;

      console.log('🕒 Delayed MEASUREMENT_ADDED check:', isSeriesValidRef, pendingAnnotationUIDRef.current, { uid, seriesUID });

      // Flatten all annotationUIDs with scores
      const annotationsObj = listOfUsersAnnotationsRef.current;
      const annotationGroups = annotationsObj ? Object.values(annotationsObj) : [];

      const scoredUIDs = annotationGroups
        .flatMap(group => group.data || [])
        .filter(a => a?.annotationUID && a?.data?.suspicionScore != null)
        .map(a => a.annotationUID);

      const isAlreadyScored = scoredUIDs.includes(uid);
      console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current, isAlreadyScored, listOfUsersAnnotationsRef.current, scoredUIDs);

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
        console.log(' *** IN MEASUREMENT ADDED HANDLER :', isSeriesValidRef, pendingAnnotationUIDRef.current, uid);

        setActiveUID(uid);

        if (!isAlreadyScored) {
          // debouncedShowScoreModal();
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
  debouncedUpdateStats,
  pendingAnnotationUIDRef,
  isSeriesAnnotationsCompletedRef,
}: {
  event: any;
  debouncedUpdateStats: () => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  isSeriesAnnotationsCompletedRef: React.MutableRefObject<boolean>;
}) => {
  const { annotation: changedAnnotation } = event.detail;
  if (!changedAnnotation) return;

  // 🔒 Guard: if series is completed, force lock and bail
  if (isSeriesAnnotationsCompletedRef.current) {
    changedAnnotation.isLocked = true;

    console.warn(
      `Blocked modification on locked annotation ${changedAnnotation.annotationUID}`
    );
    return;
  }

  pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
  debouncedUpdateStats();
};



//=========================================================
// this handler takes effect AFTER the removal of the measurement - it is reactive
export const handleAnnotationRemoved = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
  setDropdownSelectionMap,
  triggerPost,
  showModal,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
}) => {
    const userInfo = getUserInfo();
    if (userInfo?.role === 'admin') {
      // alert("Admins are not allowed to delete annotations.");
      // console.warn("🚫 Annotation deletion blocked for admin user:", userInfo.username);
      showModal({
        title: 'Deletion Blocked',
        message: 'Admins are not allowed to delete annotations.',
        showCancel: false,
      });
      console.warn('🚫 Annotation deletion blocked for admin:', userInfo.username);
      return;
    }

    setIsSaved(false);
    // debouncedUpdateStats();
    setTimeout(() => {
      const allAnnotations = annotation.state.getAllAnnotations?.() || [];
      const newMap = buildDropdownSelectionMapFromState(allAnnotations);
      setDropdownSelectionMap(newMap);

      const postArgs = { allAnnotations, dropdownSelectionMap: newMap };
      triggerPost(postArgs);
    }, 0);

};
