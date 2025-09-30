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
  pendingAlertUIDsRef,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  pendingAlertUIDsRef: React.RefObject<string[]>;
}) => {
  const userInfo = getUserInfo();
  if (!userInfo?.username) {
    console.warn("⚠️ Username not available yet. Skipping label assignment.");
    return;
  }

  setTimeout(() => {
    const allAnnotations = annotation.state.getAllAnnotations();
    // const measurementIndex = getLastIndexStored(allAnnotations) + 1;
    // const customLabel = `${userInfo.username}_${measurementIndex}`;

    // const { annotation: newAnnotation } = event.detail;
    // if (newAnnotation.data.label === "") {
    //   newAnnotation.data.label = customLabel;
    // }

    // auto save the new annotation
    const newMap = buildDropdownSelectionMapFromState(allAnnotations);
    setDropdownSelectionMap(newMap);
    // delay triggerPost to allow n seconds before alert to select a score
    setTimeout(() => {
        triggerPost({
            allAnnotations,
            dropdownSelectionMap: newMap,
            suppressAlert: false,
            pendingAlertUIDsRef,
        });
        }, 4000);
    }, 200);
    debouncedUpdateStats(); // wait for system to settle after add
};


export const handleAnnotationChange = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
  setDropdownSelectionMap,
  triggerPost,
  pendingAlertUIDsRef,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
  pendingAlertUIDsRef: React.RefObject<string[]>;
}) => {
    setIsSaved(false);
    debouncedUpdateStats();
    const allAnnotations = annotation.state.getAllAnnotations?.() || [];


      const userInfo = getUserInfo();
  if (!userInfo?.username) {
    console.warn("⚠️ Username not available yet. Skipping label assignment.");
    return;
  }
    const measurementIndex = getLastIndexStored(allAnnotations) + 1;
    const customLabel = `${userInfo.username}_${measurementIndex}`;

    const { annotation: newAnnotation } = event.detail;
    if (newAnnotation.data.label === "") {
      newAnnotation.data.label = customLabel;
    }

    const newMap = buildDropdownSelectionMapFromState(allAnnotations);
    setDropdownSelectionMap(newMap);

    setTimeout(() => {
    triggerPost({
        allAnnotations,
        dropdownSelectionMap: newMap,
        suppressAlert: false,
        pendingAlertUIDsRef,
    });
    }, 4000); // ⏳ Give the UI/state time to settle    
};

