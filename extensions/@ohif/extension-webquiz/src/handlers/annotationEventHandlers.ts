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
  debouncedShowScoreModal: () => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  isSeriesValidRef: React.MutableRefObject<boolean>;
}) {
  setTimeout(() => {
    const uid = measurement?.uid;
    const seriesUID = measurement?.referenceSeriesUID;

    console.log('🕒 Delayed MEASUREMENT_ADDED check:', { uid, seriesUID });

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
      setActiveUID(uid);
      debouncedShowScoreModal();
      pendingAnnotationUIDRef.current = null;
    }
  }, 50);
}

//=========================================================
export const handleAnnotationChange = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
  setDropdownSelectionMap,
  setShowScoreModal,
  triggerPost,
  debouncedShowScoreModal,
  setActiveUID,
  pendingAnnotationUIDRef,
  isSeriesValidRef,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setShowScoreModal: (modalWindow: boolean) => void;
  triggerPost: (args: TriggerPostArgs) => void;
  debouncedShowScoreModal: () => void;
  setActiveUID: (activeUID: string | null) => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  isSeriesValidRef: React.MutableRefObject<boolean | null>;
}) => {
  const { annotation: changedAnnotation, bContinueDelay = false } = event.detail;
  if (!changedAnnotation) return;
  console.log('🔍 Annotation event detail:', event.detail);
  pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
  console.log('🧷 Annotation UID set:', changedAnnotation.annotationUID);
  
  if (isSeriesValidRef.current === false) {
    console.warn('🚫 Annotation created on invalid series. Skipping measurement update.');
    return;
  }

  const userInfo = getUserInfo();
  if (!userInfo?.username) {
    console.warn("⚠️ Username not available yet. Skipping label assignment.");
    return;
  }

  if (userInfo.role === 'admin') {
    console.log("👮‍♂️ Admin role detected. Skipping POST.");
    return;
  }

  setIsSaved(false);
  debouncedUpdateStats();

  const allAnnotations = annotation.state.getAllAnnotations?.() || [];
  console.log('🔁 Re-fired ANNOTATION_MODIFIED for UID:', changedAnnotation.annotationUID);

  const measurementIndex = getLastIndexStored(allAnnotations) + 1;
  const customLabel = `${userInfo.username}_${measurementIndex}`;

  if (changedAnnotation.data.label === "") {
    changedAnnotation.data.label = customLabel;
    pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
  }

  console.log('📦 changedAnnotation before map:', changedAnnotation);
  const newMap = buildDropdownSelectionMapFromState(allAnnotations);
  setDropdownSelectionMap(newMap);
  console.log('📊 dropdownSelectionMap before post:', newMap);

  const isScoreValid =
    typeof changedAnnotation.data.suspicionScore === 'number' &&
    changedAnnotation.data.suspicionScore >= 1 &&
    changedAnnotation.data.suspicionScore <= 5;

  const postArgs = { allAnnotations, dropdownSelectionMap: newMap };

  if (!isScoreValid || bContinueDelay) {
    setTimeout(() => triggerPost(postArgs), 500);
  } else {
    triggerPost(postArgs);
  }
};


//=========================================================
// no time delay when deleting a measurement
export const handleAnnotationRemove = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
  setDropdownSelectionMap,
  triggerPost,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
}) => {
    const userInfo = getUserInfo();
    if (userInfo?.role === 'admin') {
      alert("Admins are not allowed to delete annotations.");
      console.warn("🚫 Annotation deletion blocked for admin user:", userInfo.username);
      return;
    }
    setIsSaved(false);
    debouncedUpdateStats();
    setTimeout(() => {
      const allAnnotations = annotation.state.getAllAnnotations?.() || [];
      const newMap = buildDropdownSelectionMapFromState(allAnnotations);
      setDropdownSelectionMap(newMap);

      triggerPost({
          allAnnotations,
          dropdownSelectionMap: newMap,
      });
    }, 0);

};