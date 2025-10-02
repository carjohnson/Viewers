import * as cornerstone from '@cornerstonejs/core';
import { Enums } from '@cornerstonejs/tools';
import { arraysEqual } from '../utils/dataUtils';
import { annotation } from '@cornerstonejs/tools';
// import { resolveViewportIdForAnnotation } from '../utils/annotationUtils'

// ======== post annotations to Server
export const postAnnotations = ({
    allAnnotations,
    dropdownSelectionMap,
    patientName,
    measurementListRef,
    setIsSaved,
    suppressAlert = true,  //default
    pendingAlertUIDsRef,
}) => {

    // Filter valid annotations
    //    Some annotation objects do not include the cached stats
    //    These hold some metadata and are not needed
    const validAnnotations = allAnnotations.filter(
      ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
    );

    // Validate scores and prepare post payload


      const annotationsWithStats = [];
      const invalidUIDsMissingScore = [];
      console.log('************  suppressAlert:', suppressAlert);
      validAnnotations.forEach((ann) => {
        const uid = ann.annotationUID;
        const selectedScore = dropdownSelectionMap[uid]; // use current state

        if (typeof selectedScore === 'number' && selectedScore >= 1 && selectedScore <= 5) {
          (ann as any).suspicionScore = selectedScore;
          annotationsWithStats.push(ann);
        } else {
          invalidUIDsMissingScore.push(uid);
        }
      });

      // Update ref for post
      measurementListRef.current = [...annotationsWithStats];
      // console.log('🔁 Previous alert UIDs:', pendingAlertUIDsRef.current);
      // console.log('🔍 Current invalid UIDs:', invalidUIDsMissingScore);

      // Warn if needed
      if (invalidUIDsMissingScore.length > 0) {
        const unchanged = arraysEqual(
          pendingAlertUIDsRef.current,
          invalidUIDsMissingScore
        );
        
        if (!unchanged) {
          alert('⚠️ Please select a valid suspicion score (1–5) for all measurements.');
          pendingAlertUIDsRef.current = [...invalidUIDsMissingScore];

          // Reset after delay
          setTimeout(() => {
            pendingAlertUIDsRef.current = [];
          }, 3000); // 3 seconds

          // trigger another changed event to restart alert
          const firstAnn = measurementListRef.current?.[0];
          // don't bother dispatching an event if this is the first annotation
          if (firstAnn) {
            cornerstone.eventTarget.dispatchEvent({
              type: Enums.Events.ANNOTATION_MODIFIED,
              detail: {
                annotation: firstAnn,
                bContinueDelay: true,
              },
            });
          } else {
            // This case is when the user draws the first annotation
            const startingAnnotations = annotation.state.getAllAnnotations();
            console.log('************ Starting Annotations: ', startingAnnotations);
            const validFirstAnn = startingAnnotations.filter(
              ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
            );

            cornerstone.eventTarget.dispatchEvent({
              type: Enums.Events.ANNOTATION_MODIFIED,
              detail: {
                annotation: validFirstAnn[0],
                bContinueDelay: true,
              },
            });
            // const resolvedViewportId = resolveViewportIdForAnnotation(validFirstAnn[0]);
            // if (resolvedViewportId) {
            //   cornerstone.eventTarget.dispatchEvent({
            //     type: Enums.Events.ANNOTATION_MODIFIED,
            //     detail: {
            //       annotation: validFirstAnn[0],
            //       viewportId: resolvedViewportId,
            //       bContinueDelay: true,
            //     },
            //   });
            // }

          }

        }

        return;
      }

    // Post to server
    window.parent.postMessage({
      type: 'annotations',
      annotationObjects: measurementListRef.current,
      patientid: patientName
    }, '*');

    setIsSaved(true);
  
};
