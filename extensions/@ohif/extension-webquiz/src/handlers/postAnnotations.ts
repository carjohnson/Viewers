// ======== post annotations to Server

export const postAnnotations = ({
    allAnnotations,
    dropdownSelectionMap,
    patientName,
    measurementListRef,
    setIsSaved,
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

    // Warn if needed
    if (invalidUIDsMissingScore.length > 0) {
      alert('⚠️ Please select a valid suspicion score (1–5) for all measurements before submitting.');
      return;
    }

    // Post to server
    console.log('📤 Payload being posted:', {
      type: 'annotations',
      annotationObjects: measurementListRef.current,
      patientid: patientName,
    });
    window.parent.postMessage({
      type: 'annotations',
      annotationObjects: measurementListRef.current,
      patientid: patientName
    }, '*');

    setIsSaved(true);
  
};


// export const postAnnotations = ({
//   allAnnotations,
//   dropdownSelectionMap,
//   patientName,
//   measurementListRef,
//   setIsSaved,
// }) => {
//   console.log('🔍 Starting postAnnotations');
//   console.log('📦 Received allAnnotations:', allAnnotations);
//   console.log('📊 Current dropdownSelectionMap:', dropdownSelectionMap);

//   const validAnnotations = allAnnotations.filter(
//     ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
//   );

//   console.log('✅ Valid annotations with cachedStats:', validAnnotations);

//   const annotationsWithStats = [];
//   const invalidUIDsMissingScore = [];

//   validAnnotations.forEach((ann) => {
//     const uid = ann.annotationUID;
//     const selectedScore = dropdownSelectionMap?.[uid];

//     console.log(`🔎 Checking UID ${uid} → selectedScore:`, selectedScore);

//     if (typeof selectedScore === 'number' && selectedScore >= 1 && selectedScore <= 5) {
//       (ann as any).suspicionScore = selectedScore;
//       annotationsWithStats.push(ann);
//     } else {
//       console.warn(`⚠️ UID ${uid} is missing a valid score`);
//       invalidUIDsMissingScore.push(uid);
//     }
//   });

//   console.log('📋 Final annotationsWithStats:', annotationsWithStats);
//   console.log('🚫 Invalid UIDs missing score:', invalidUIDsMissingScore);

//   measurementListRef.current = [...annotationsWithStats];

//   if (invalidUIDsMissingScore.length > 0) {
//     alert('⚠️ Please select a valid suspicion score (1–5) for all measurements before submitting.');
//     return;
//   }

//   console.log('📤 Posting annotations to server…');
//   window.parent.postMessage({
//     type: 'annotations',
//     annotationObjects: measurementListRef.current,
//     patientid: patientName
//   }, '*');

//   setIsSaved(true);
//   console.log('✅ Post complete, annotations saved.');
// };