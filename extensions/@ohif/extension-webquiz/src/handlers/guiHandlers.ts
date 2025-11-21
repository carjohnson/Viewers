// src/handlers/guiHandlers.ts
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';

//=========================================================
// Set up GUI so the user can click on an annotation in the panel list
//    and have the image jump to the corresponding slice
//    also - set up a visibility icon for each annotation
export const handleMeasurementClick = ({
  measurementId,
  annotation,
  measurementService,
  activeViewportId,
}: {
  measurementId: string;
  annotation: any;
  measurementService: any;
  activeViewportId: string;
}) => {
  const ohifAnnotation = annotation.state.getAnnotation(measurementId);
  if (ohifAnnotation) {
    measurementService.jumpToMeasurement(activeViewportId, measurementId);
  } else {
    console.warn('No annotation found for UID:', measurementId);
  }
};

//=========================================================
export const toggleVisibility = ({
  uid,
  visibilityMap,
  setVisibilityMap,
  measurementService,
}: {
  uid: string;
  visibilityMap: Record<string, boolean>;
  setVisibilityMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  measurementService: any;
}) => {
  const currentVisibility = visibilityMap[uid] ?? true;
  const newVisibility = !currentVisibility;

  measurementService.toggleVisibilityMeasurement(uid, newVisibility);

  setVisibilityMap(prev => ({
    ...prev,
    [uid]: newVisibility,
  }));
};

//=========================================================
export const closeScoreModal = ({
  activeUID,
  selectedScore,
  setSelectedScore,
  setDropdownSelectionMap,
  setShowScoreModal,
}:{
  activeUID: string,
  selectedScore: number | null;
  setSelectedScore: (score: number | null) => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setShowScoreModal:  (modalWindow: boolean) => void;
}) => {

  if (selectedScore !== null && activeUID) {
    setDropdownSelectionMap(prev => ({
      ...prev,
      [activeUID]: selectedScore,
    }));
  }
  setShowScoreModal(false);
  setSelectedScore(null);

  const allAnnotations = annotation.state.getAllAnnotations();
  const activeAnnotationObject = allAnnotations.find(
    ann => ann.annotationUID === activeUID
  );
  if (activeAnnotationObject?.data) {
    activeAnnotationObject.data.suspicionScore = selectedScore;
  }
  console.log('📣 Dispatching modified annotation:', activeAnnotationObject);

  cornerstone.eventTarget.dispatchEvent({
    type: cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED,
    detail: {
      annotation: activeAnnotationObject,
      bContinueDelay: true,
    },
  });

};

