// src/handlers/guiHandlers.ts

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