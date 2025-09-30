import * as cornerstone from '@cornerstonejs/core';

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
        console.log('🔁 Previous alert UIDs:', pendingAlertUIDsRef.current);
        console.log('🔍 Current invalid UIDs:', invalidUIDsMissingScore);

      // Warn if needed
      if (invalidUIDsMissingScore.length > 0) {
        const unchanged = arraysEqual(
          pendingAlertUIDsRef.current,
          invalidUIDsMissingScore
        );
        
        if (!unchanged) {
          alert('⚠️ Please select a valid suspicion score (1–5) for all measurements before submitting.');
          pendingAlertUIDsRef.current = [...invalidUIDsMissingScore];

          // Reset after delay
          setTimeout(() => {
            pendingAlertUIDsRef.current = [];
          }, 3000); // 3 seconds
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

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((val, i) => val === b[i]);


  //   setTimeout(() => {
  //     const annotationsWithStats = [];
  //     const invalidUIDsMissingScore = [];
  //     console.log('************  suppressAlert:', suppressAlert);
  //     validAnnotations.forEach((ann) => {
  //       const uid = ann.annotationUID;
  //       const selectedScore = dropdownSelectionMap[uid]; // use current state

  //       if (typeof selectedScore === 'number' && selectedScore >= 1 && selectedScore <= 5) {
  //         (ann as any).suspicionScore = selectedScore;
  //         annotationsWithStats.push(ann);
  //       } else {
  //         invalidUIDsMissingScore.push(uid);
  //       }
  //     });

  //     // Update ref for post
  //     measurementListRef.current = [...annotationsWithStats];

  //     // Warn if needed
  //     if (invalidUIDsMissingScore.length > 0) {
  //       if (!suppressAlert) 
  //       alert('⚠️ Please select a valid suspicion score (1–5) for all measurements before submitting.');
  //       return;
  //     }
  // },5000);
