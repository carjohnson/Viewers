// ======== post annotations to Server

export const postAnnotations = ({
    allAnnotations,
    selectionMap,
    patientName,
    measurementListRef,
    setIsSaved,
}) => {

    // Filter valid annotations
    const validAnnotations = allAnnotations.filter(
      ann => ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0
    );

    // Validate scores and prepare post payload
    const annotationsWithStats = [];
    const invalidUIDsMissingScore = [];

    validAnnotations.forEach((ann) => {
      const uid = ann.annotationUID;
      const selectedScore = selectionMap[uid]; // use current state

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
    window.parent.postMessage({
      type: 'annotations',
      annotationObjects: measurementListRef.current,
      patientid: patientName
    }, '*');

    setIsSaved(true);
  
};