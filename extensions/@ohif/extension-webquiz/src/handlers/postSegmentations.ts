// src/handlers/postSegmentations.ts


// ======== post segmentations to Server
export const postSegmentations = ({
  segmentationObjects,
  studyUID,
}: {
  segmentationObjects: any[];
  studyUID: string;

}) => {
  try {
      if (!Array.isArray(segmentationObjects) || segmentationObjects.length === 0) {
        console.warn(
          'postSegmentations :: Refusing to post empty segmentationObjects array',
          { studyUID, segmentationObjects }
        );
      return {
        success: false,
        error: new Error('Refusing to post empty segmentationObjects array'),
      };
    }

    console.log(`📬 Posting segmentations to Backend`,  segmentationObjects);

    window.parent.postMessage(
      {
        type: 'segmentations',
        segmentationObjects,
        studyUID,
      },
      '*'
    );
    return { success: true}
  } catch (err) {
      console.error('postSegmentations :: Error posting segmentations:', err);
      return { success: false, error: err };

  }

};