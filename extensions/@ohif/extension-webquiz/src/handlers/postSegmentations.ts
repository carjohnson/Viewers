// src/handlers/postSegmentations.ts


// ======== post segmentations to Server
export const postSegmentations = ({
  segmentationObjects,
  studyUID,
  deleteAll,
}: {
  segmentationObjects: any[];
  studyUID: string;
  deleteAll?: boolean;
}) => {
  try {
    // Allow empty array if deleteAll is true
    if (
      !Array.isArray(segmentationObjects) ||
      (segmentationObjects.length === 0 && !deleteAll)
    ) {
      console.warn(
        'postSegmentations :: Refusing to post empty segmentationObjects array',
        { studyUID, segmentationObjects, deleteAll }
      );

      return {
        success: false,
        error: new Error('Refusing to post empty segmentationObjects array'),
      };
    }

    if (segmentationObjects.length === 0 && deleteAll) {
      console.log(
        '🗑️  Posting delete-all segmentations for study',
        studyUID
      );
    } else {
      console.log('📬 Posting segmentations to Backend', segmentationObjects);
    }

    window.parent.postMessage(
      {
        type: 'segmentations',
        segmentationObjects,
        studyUID,
        deleteAll: deleteAll ?? false,
      },
      '*'
    );

    return { success: true };
  } catch (err) {
    console.error('postSegmentations :: Error posting segmentations:', err);
    return { success: false, error: err };
  }
};