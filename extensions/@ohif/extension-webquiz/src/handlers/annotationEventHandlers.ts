// annotationEventHandlers.ts

import { annotation } from '@cornerstonejs/tools';
import { getLastIndexStored } from './../utils/annotationUtils';
import { getUserInfo } from '../../../../../modes/@ohif/mode-webquiz/src/userInfoService';


//=========================================================
export const handleAnnotationAdd = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
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
  }, 200);
    debouncedUpdateStats(); // wait for system to settle after add
};


//=========================================================
export const handleAnnotationChange = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
}) => {
    setIsSaved(false);
    debouncedUpdateStats();
};


