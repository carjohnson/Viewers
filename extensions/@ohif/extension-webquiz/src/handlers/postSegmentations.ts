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
        console.log(`📬 Posting segmentations to Backend`);

    window.parent.postMessage(
      {
        type: 'segmentations',
        segmentationObjects,
        studyUID,
      },
      '*'
    );
  } catch (err) {
      console.error('postSegmentations :: Error posting segmentations:', err);
      return { error: err };

  }

};