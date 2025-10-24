// annotationEventHandlers.ts

import { annotation } from '@cornerstonejs/tools';
import { getLastIndexStored, buildDropdownSelectionMapFromState } from './../utils/annotationUtils';
import { getUserInfo } from '../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { TriggerPostArgs } from '../models/TriggerPostArgs';


//=========================================================
export const handleAnnotationAdd = ({
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
  if (!userInfo?.username) {
    console.warn("⚠️ Username not available yet. Skipping label assignment.");
    return;
  }

  setTimeout(() => {
    const allAnnotations = annotation.state.getAllAnnotations();
    const measurementIndex = getLastIndexStored(allAnnotations) + 1;
    const customLabel = `${userInfo.username}_${measurementIndex}`;

    const { annotation: newAnnotation } = event.detail;
    if (newAnnotation.data.label === "") {
      newAnnotation.data.label = customLabel;
    }

    // auto save the new annotation
    const newMap = buildDropdownSelectionMapFromState(allAnnotations);
    setDropdownSelectionMap(newMap);
    // delay triggerPost to allow n seconds before alert to select a score
    setTimeout(() => {

        triggerPost({
            allAnnotations,
            dropdownSelectionMap: newMap,
        });
        }, 5000);
    }, 200);
    debouncedUpdateStats(); // wait for system to settle after add
};


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
}) => {
  setIsSaved(false);
  debouncedUpdateStats();
  const allAnnotations = annotation.state.getAllAnnotations?.() || [];
  console.log('🔁 Re-fired ANNOTATION_MODIFIED for UID:', event.detail.annotation.annotationUID);

    const userInfo = getUserInfo();
    if (!userInfo?.username) {
        console.warn("⚠️ Username not available yet. Skipping label assignment.");
        return;
    }
    const measurementIndex = getLastIndexStored(allAnnotations) + 1;
    const customLabel = `${userInfo.username}_${measurementIndex}`;

    const { annotation: changedAnnotation , bContinueDelay = false } = event.detail;
    if (!changedAnnotation) return; // no annotation guard - just exit

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

    if (!isScoreValid || bContinueDelay) {
      setTimeout(() => {
        triggerPost({ allAnnotations, dropdownSelectionMap: newMap });
      }, 500);
    } else {
      triggerPost({ allAnnotations, dropdownSelectionMap: newMap });
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