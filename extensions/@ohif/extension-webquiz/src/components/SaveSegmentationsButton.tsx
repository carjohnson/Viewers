import React from 'react';
import {
  ImplementationClassUID,
  ImplementationVersionName,
  EXPLICIT_VR_LITTLE_ENDIAN,
} from '../init';
import { Button } from '@ohif/ui'; // or your preferred button source
import { postSegmentations } from '../handlers/postSegmentations';
import {UserInfo} from '../models/UserInfo';
import dcmjs from 'dcmjs';
import { useSegmentMetadataStore, OhifSegmentInfo } from './../stores/useSegmentMetadataStore';
import { SegmentationData } from './../models/SegmentationData';




// for creating the blob
const { DicomMetaDictionary, DicomDict } = dcmjs.data;


type Props = {
  getUserInfo: () => UserInfo | null;
  studyInstanceUID: string;
  segmentationService: any;
  viewportGridService: any;
  displaySetService: any;
  activeViewportId: string;
  commandsManager: any;
  showModal: (args: {
    title: string;
    message: string;
    onClose?: () => void;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
  closeModal: () => void;
};

const SaveSegmentationsButton: React.FC<Props> = ({
  getUserInfo,
  studyInstanceUID,
  segmentationService,
  viewportGridService,
  displaySetService,
  activeViewportId,
  commandsManager,
  showModal,
  closeModal,
}) => {

  const handleClick = () => {
      showModal({
        title: 'Confirm Save Segmentations',
        message: 'Are you sure?',
        showCancel: true,
        onCancel: () => {
          console.log('❌ Cancelled save segmentations to DB');
          closeModal();
        },
        onClose: confirmCompletion,
      });
    // confirmCompletion(); // if no modal pop-up needed - just run it
  };


  const confirmCompletion = async () => {
    
    const allSegmentations = segmentationService.getSegmentations();
    const allSegs: SegmentationData = segmentationService.getSegmentations();
    console.log(' *** In SaveSegmentationsButton ... all Segmentations', allSegmentations);
    
    let segmentationObjects = [];
    let updatedSeg;
    let lastSegIdForDebug = "";

    for (const seg of Object.values(allSegs) as SegmentationData[]) {

      let segmentLabels = useSegmentMetadataStore.getState().getMetadata(seg.segmentationId);
      console.log(`Seg ${seg.segmentationId}:`, segmentLabels?.length || 0, 'segments from CACHE', seg);

      // Capture segments from CURRENT service state (user-created in OHIF)
      const currentSegments = seg.segments || {};
      const segmentLabelsFromService = Object.entries(currentSegments).map(([index, segment]) => ({
        segmentIndex: Number(index),
        label: segment.label || `Segment ${index}`,
        cachedStats: segment.cachedStats,
      }));


      useSegmentMetadataStore.getState().clearMetadata(seg.segmentationId);
      useSegmentMetadataStore.getState().setMetadata(seg.segmentationId, segmentLabelsFromService);

      // Proceed with save logic for segmentations WITH metadata
      console.log(`💾 Saving ${seg.segmentationId} with ${segmentLabels?.length} segments`);

    
      let generatedSeg;
      try {
        // generating a SEG object that can be posted to backend as DICOM SEG with metadata

        // because this is a custom segmentation extension, 
        //      predecessorImage prop is missing from the seg
        segmentationService.addOrUpdateSegmentation({
            segmentationId: seg.segmentationId,
            type: seg.type,
            predecessorImageId: seg.representationData.Labelmap.referencedImageIds[0]
        });
        updatedSeg = segmentationService.getSegmentation(seg.segmentationId);
        // console.log('updatedSeg after update', updatedSeg);    // for debug

        const seriesUid = getSeriesUid(seg.representationData.Labelmap.referencedImageIds[0]);
        const displaySets = displaySetService.getDisplaySetsForSeries(seriesUid);
        const displaySetInstanceUID = displaySets[0]?.displaySetInstanceUID;

        await viewportGridService.setDisplaySetsForViewport({
            viewportId: activeViewportId,
            displaySetInstanceUIDs: [displaySetInstanceUID],
          });

          // Give OHIF a moment to render the new stack
          await new Promise(resolve => setTimeout(resolve, 50));

        if (!displaySetInstanceUID) {
          console.warn('No displaySet found for series', seriesUid);
          continue;
        }

        // Check all segments for non-zero volume - use stats from cached segment metadata
        //    At least one segment must have a volume in order to call function to generate a Seg
        const segmentIdsToRemove: string[] = [];
        let hasVolume = false;
        const segments = useSegmentMetadataStore.getState().getMetadata(seg.segmentationId);

        for (const [segIdxStr, segment] of Object.entries(segments)) {
          const volume = segment.cachedStats?.namedStats?.volume?.value;

          if (typeof volume !== 'number' || volume <=0) {
            console.log(`Marking unpainted segment ${segIdxStr} (volume=${volume}) for removal`);
            segmentIdsToRemove.push(segIdxStr);
          } else {
            // check that one of the segments has volume for generateSegmentation
            if (typeof volume === 'number' && volume > 0) {
              hasVolume = true;
            }
          }
        } // end for each segment

       
        // if any of the segments were painted, generate a segmentation object
        if (hasVolume) {

          generatedSeg = commandsManager.runCommand('generateSegmentation', {
            segmentationId: seg.segmentationId,
          });

          if (!generatedSeg || !generatedSeg.dataset) {
            console.warn(
              `Skipping segmentation ${seg.segmentationId}: generation failed`
            );
            continue;
          }


          console.log(' *** GENERATED SEG:', generatedSeg);

          // //////////// Create blob from generatedSeg ////////////
          // generate the meta data 
          let segBlob;
          const meta = {
                FileMetaInformationVersion: generatedSeg.dataset._meta?.FileMetaInformationVersion?.Value,
                MediaStorageSOPClassUID: generatedSeg.dataset.SOPClassUID,
                MediaStorageSOPInstanceUID: generatedSeg.dataset.SOPInstanceUID,
                TransferSyntaxUID: EXPLICIT_VR_LITTLE_ENDIAN,
                ImplementationClassUID,
                ImplementationVersionName,
              };

          const denaturalizedMetadata = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(meta);
          const denaturalizedDataset = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(generatedSeg.dataset);
          const dicomDict = new DicomDict(denaturalizedMetadata);
          dicomDict.dict = denaturalizedDataset;

          try {
            const arrayBuffer = dicomDict.write();
            segBlob = new Blob([arrayBuffer], { type: 'application/dicom' });
            console.log('Blob created successfully, size:', segBlob.size, 'type:', segBlob.type);
            console.log('segBlob:', segBlob);
          
          } catch (blobError) {
            console.warn(`Skipping segmentation ${seg.segmentationId}: blob creation failed`, blobError);
            console.warn('Stack:', blobError.stack);
            continue;
          }

          // segmentation and blob generation succeeded
          segmentationObjects.push({
              segmentationId: seg.segmentationId,
              sourceSeriesInstanceUid: seriesUid,
              label: seg.label,
              segments: buildSegmentList(seg.segments),
              segmentationDataRef: segBlob,
          });

          lastSegIdForDebug = seg.segmentationId;
          console.log(' *** END OF GENERATE LOOP ... segObjects to post:', segmentationObjects);


        } // end if hasVolume



      } catch (err) {
          console.warn(`Skipping segmentation ${seg.segmentationId}: generating seg failed`, err);
          console.warn('Stack:', err.stack);
          continue;
      }
    } // end for - to generate segmentation objects




    // // DEBUG - needs activeViewportImageIds as a prop
    // console.log('=== DEBUG BEFORE DOWNLOAD ===');
    // console.log('lastSegId:', lastSegIdForDebug);
    // const segData = segmentationService.getSegmentation(lastSegId);
    // console.log('segData.predecessorImageId:', segData?.predecessorImageId);
    // console.log('active imageId:', activeViewportImageIds[0]);
    // console.log('===========================');

    // // DEBUG ... trigger a download - needs activeViewportImageIds as a prop
    // //    - frontend download for testing import DICOM SEG into other viewer
    // commandsManager.runCommand("downloadSegmentation", {
    //     segmentationId: lastSegIdForDebug,
    //     predecessorImageId: activeViewportImageIds[0],
    // });

    let postSegmentationResult;
    if (segmentationObjects.length !== 0) {
      postSegmentationResult = await postSegmentations({
          segmentationObjects,
          studyUID: studyInstanceUID,
      });
    } else {
      postSegmentationResult = await postSegmentations({
          segmentationObjects: [],  // signal no objects to post to keep DB in sync
          studyUID: studyInstanceUID,
    });

    if (postSegmentationResult?.error) {
      console.warn('⚠️ Failed to post segmentations:', postSegmentationResult.error);
    } else {
      console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
    }
      
      console.log(`📬 Confirmed save segmentations to DB`);
    }

    closeModal();


  };  // end confirm completion

  return (
    <div className="p-2 text-center">
        {getUserInfo()?.role == 'admin' && (
            <Button
            onClick={handleClick}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded px-4 py-2"
            >
            { 'Save Segmentations' }
            </Button>
        )}
    </div>
  );
};

export default SaveSegmentationsButton;


// >>>>>>>>>>>>> Helper functions <<<<<<<<<<<<<



// =====================================
function buildSegmentList(segmentsObj) {
  if (!segmentsObj) return [];

  const segmentArray = Object.values(segmentsObj) as OhifSegmentInfo[]; // OHIF stores segments as an object

  return segmentArray.map((segment,i) => ({
    segmentIndex: i + 1,    // matches mask value
    label: segment.label,
    cachedStats: segment.cachedStats,
    groundTruth: "Unknown",
    referenceStandardMethod: "Biopsy",
    hepaticSegment: ["segment-1","segment-2"],
  }));
}

// =====================================
function getSeriesUid(imageId: string): string | null {
  try {
    const url = new URL(imageId);
    const parts = url.pathname.split('/').filter(Boolean);
    const seriesIndex = parts.indexOf('series');
    return seriesIndex !== -1 && seriesIndex + 1 < parts.length ? parts[seriesIndex + 1] : null;
  } catch {
    return null;
  }
}

// =====================================

