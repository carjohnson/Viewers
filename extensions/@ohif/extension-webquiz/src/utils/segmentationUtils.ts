import { adaptersSEG } from '@cornerstonejs/adapters';
import { imageLoader } from '@cornerstonejs/core';
import { metaData } from '@cornerstonejs/core';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { OhifSegmentInfo, SegmentationData, SegmentMetadata } from './../models/SegmentationData';
import {
  ImplementationClassUID,
  ImplementationVersionName,
  EXPLICIT_VR_LITTLE_ENDIAN,
} from '../init';
import dcmjs from 'dcmjs';
import { postSegmentations } from '../handlers/postSegmentations';


// for creating the blob when saving a segment
const { DicomMetaDictionary, DicomDict } = dcmjs.data;



// =====================================
export async function loadDicomSegIntoOHIF({
//   dicomSegSeriesUID,
  segmentationId,
  referencedSeriesInstanceUID,
  segmentationLabel,
  segmentMetadata,
  arrayBuffer,
  servicesManager,
}) {

  // ~~~~~~~~~~
  const {
        segmentationService,
        displaySetService,
        viewportGridService,
  } = servicesManager.services;

  // ~~~~~~~~~~
  // get referenced display sets and image ids
  const referencedDisplaySets =
    displaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
  const referencedDisplaySet = referencedDisplaySets?.[0];

  if (!referencedDisplaySet) {
    // console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
    console.warn('No referenced displaySet for SEG', segmentationId);
    return;
  }

  const imageIds = referencedDisplaySet.images?.map(i => i.imageId) ?? [];
  if (!imageIds.length) {
    console.warn('No imageIds found for referenced displaySet', referencedSeriesInstanceUID);
    return;
  }

  // ~~~~~~~~~~
  // generate the tool state - and get the segmentation labelmap buffer
  const segToolState =
    await adaptersSEG.Cornerstone3D.Segmentation.generateToolState(
      imageIds,
      arrayBuffer,
      metaData
    );
    // console.log('segToolState:', segToolState);
    // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);
    const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);

    // ~~~~~~~~~~
    // create one empty labelmap segmentation
    await segmentationService.createLabelmapForDisplaySet(
        referencedDisplaySet,  // ← Pass the displaySet object directly
        {
        // label: `SEG ${dicomSegSeriesUID.slice(-8)}`,
        segmentationId: segmentationId,
        label: segmentationLabel,
        },
    );

    segmentMetadata.forEach(s => {
      const isComplete = computeSegmentDataIsComplete(s)
      useSegmentMetadataStore.getState().setMetadata(
        segmentationId,
        s.segmentMaskValue,
        {
          groundTruth: s.groundTruth,
          referenceStandardMethod: s.referenceStandardMethod,
          hepaticSegment: s.hepaticSegment,
          isComplete: isComplete,
        }
      );      

      const ohifInfo: OhifSegmentInfo = {
      segmentIndex: s.segmentMaskValue,   // matches backend schema
      label: s.label,
      cachedStats: s.cachedStats,
      quizSegmentMetadata: {
        groundTruth: s.groundTruth,
        referenceStandardMethod: s.referenceStandardMethod,
        hepaticSegment: s.hepaticSegment,
        isComplete: isComplete,
      }
    };

    segmentationService.addSegment(segmentationId, ohifInfo);

    useSegmentMetadataStore
      .getState()
      .setSegmentInfo(
        segmentationId,
        s.segmentMaskValue, //1-based
        ohifInfo,
      );
    })
    const cachedStore = useSegmentMetadataStore.getState().getAllSegments(segmentationId);
    console.log('🔥 CACHED:', segmentationId, cachedStore);


    // // for debug
    // const startingSeg = segmentationService.getSegmentation(segmentationId);
    // console.log(' *** STARTING SEG', startingSeg);
    // console.log('segToolState:', segToolState);
    // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);

    // ~~~~~~~~~~
    // get labelmap ids and split the buffer into per Slice arrays
    const segmentationData = segmentationService.getSegmentation(segmentationId) as SegmentationData;
    console.log(' *** IN LOAD DICOM SEG INTO OHIF ... segmentationData:', segmentationData);

    const labelmapRep = segmentationData.representationData.Labelmap;
    const labelmapImageIds = labelmapRep.imageIds; //derived images from representation data

    const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;
    const labelmapBufferArray: Uint8Array[] = [];
    for (let i = 0; i < labelmapImageIds.length; i++) {
    const sliceStart = i * bytesPerSlice;
    const sliceEnd = sliceStart + bytesPerSlice;
    labelmapBufferArray.push(segLabelmap.subarray(sliceStart, sliceEnd));
    }

    // bufferCounter(labelmapBufferArray, '*** LabelmapBufferArray - AFTER load subarrays');   // for debug

    // ~~~~~~~~~~
    // load each labelmap image and replace its scalar data
    const labelmapImages = await Promise.all(
        labelmapImageIds.map(id => imageLoader.loadAndCacheImage(id))
    );
    labelmapBufferArray.forEach((buffer, i) => {
        labelmapImages[i].getPixelData().set(buffer);
    });


    // ~~~~~~~~~~
    // Add to active viewport(s)
    const updatedSeg = segmentationService.getSegmentation(segmentationId);
    console.log(' *** UPDATED SEG', updatedSeg);
    const viewportId = viewportGridService.getActiveViewportId();
    await segmentationService.addSegmentationRepresentation(viewportId, updatedSeg);

    console.log('🎉 Loaded SEG:', segmentationId);

}

// =====================================
// export async function saveSegmentation (seg: SegmentationData, segmentMetadata: SegmentMetadata, activeViewportId: string ) {
export async function saveSegmentation({
  seg,
  segmentMetadata,
  segmentArrayIndex,  //0-based
  segmentIndex,       //1-based
  activeViewportId,
  servicesManager,
  commandsManager,
  studyInstanceUID,
}: {
  seg: SegmentationData;
  segmentMetadata: SegmentMetadata;
  segmentArrayIndex: number;
  segmentIndex: number;
  activeViewportId: string;
  servicesManager: any;
  commandsManager: any;
  studyInstanceUID: string;
}) {
  const {
    displaySetService,
    viewportGridService,
    segmentationService,
  } = servicesManager.services;


    let segmentationObjects = [];


    // Capture segments from CURRENT service state (user-created in OHIF)
    const currentSegments = seg.segments || {};

    // synchronize the stored segment info with the current segments displayed in OHIF  (in case one has been deleted)
    const segmentInfoFromService = Object.entries(currentSegments).map(([arrayIndexStr, segment]) => {

      return {
        segmentIndex: segmentIndex,
        label: segment.label || `Segment ${segmentIndex}`,
        cachedStats: segment.cachedStats,
        quizSegmentMetadata: segment.quizSegmentMetadata,
      };
    });
              // refreshStoredSegmentMetadata(seg.segmentationId, segmentInfoFromService);


              // // update the store with the clicked segment metadata
              // const segmentArray = Object.values(currentSegments);
              // const segmentIndexToUpdate = segmentIndex;

              // const clickedSegmentInfoFromService = {
              //   ...segmentArray[segmentArrayIndex],
              //   segmentIndex: segmentIndexToUpdate,
              // };

              // useSegmentMetadataStore
              //   .getState()
              //   .setSegmentInfo(seg.segmentationId, segmentIndexToUpdate, clickedSegmentInfoFromService);
              // useSegmentMetadataStore.getState().setMetadata(seg.segmentationId, segmentIndexToUpdate, segmentMetadata);
    console.log(' *** IN Utils SAVESEGMENTATION ... store', useSegmentMetadataStore.getState())
    
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
        const updatedSeg = segmentationService.getSegmentation(seg.segmentationId);
        console.log('updatedSeg after update', updatedSeg);    // for debug

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
          // continue;
        }

        // Check all segments for non-zero volume - use stats from cached segment metadata
        //    At least one segment must have a volume in order to call function to generate a Seg
        let hasVolume = false;
        const segments = useSegmentMetadataStore.getState().getAllSegments(seg.segmentationId);

        for (const [segIdxStr, segment] of Object.entries(segments)) {
          const volume = segment.cachedStats?.namedStats?.volume?.value;

          // check that one of the segments has volume for generateSegmentation
          if (typeof volume === 'number' && volume > 0) {
            hasVolume = true;
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
            // continue;
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
            // continue;
          }

          // segmentation and blob generation succeeded
          segmentationObjects.push({
              segmentationId: seg.segmentationId,
              sourceSeriesInstanceUid: seriesUid,
              label: seg.label,
              segments: buildSegmentList(seg.segmentationId, segmentMetadata, segmentArrayIndex),
              segmentationDataRef: segBlob,
          });

          console.log(' *** END OF GENERATE SEG ... segObjects to post:', segmentationObjects);
        } // end if hasVolume



      } catch (err) {
          console.warn(`Skipping segmentation ${seg.segmentationId}: generating seg failed`, err);
          console.warn('Stack:', err.stack);
          // continue;
      }


    // post to backend
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

}




// =====================================
function buildSegmentList(
  segmentationId: string,
  updatedMetadata: SegmentMetadata,
  arrayIndexToUpdate: number
) {
  const allSegments = useSegmentMetadataStore
    .getState()
    .getAllSegments(segmentationId);

  return Object.entries(allSegments).map(([segmentIndexStr, stored]) => {
    const segmentIndex = Number(segmentIndexStr); // 1-based
    const arrayIndex = segmentIndex - 1;           // convert to 0-based

    const base = {
      segmentIndex,
      label: stored.label,
      cachedStats: stored.cachedStats,
    };

    const quizSegmentMetadata =
      arrayIndex === arrayIndexToUpdate
        ? updatedMetadata
        : stored.quizSegmentMetadata;

    return {
      ...base,
      ...quizSegmentMetadata, // flatten for backend
    };
  });
}

// =====================================
export function getSeriesUid(imageId: string): string | null {
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
export function refreshStoredSegmentMetadata(segmentationId: string, currentSegments: any[]) {
  const store = useSegmentMetadataStore.getState();

  store.clearMetadata(segmentationId);

  currentSegments.forEach((segment, arrayIndex) => {
    const segmentIndex = arrayIndex + 1;

    const ohifInfo: OhifSegmentInfo = {
      segmentIndex,
      label: segment.label,
      cachedStats: segment.cachedStats,
      quizSegmentMetadata: segment.quizSegmentMetadata,
    };

    store.setSegmentInfo(segmentationId, segmentIndex, ohifInfo);
  });
}

// =====================================
export function computeSegmentDataIsComplete(m: SegmentMetadata) {
  return (
    m.groundTruth.trim() !== "" &&
    m.referenceStandardMethod.trim() !== "" &&
    m.hepaticSegment.length > 0
  );
};

///////////////////////////////////////////////
//////////////  DEBUG HELPERS /////////////////
///////////////////////////////////////////////


function bufferCounter(buf, timePoint) {
  const valueStats = new Map(); 
  // Structure:
  // valueStats.set(value, {
  //   count: number,
  //   firstSlice: number,
  //   firstIndex: number
  // });

  let nonZeroCount = 0;

  for (let i = 0; i < buf.length; i++) {
    const perSliceChunk = buf[i];

    for (let j = 0; j < perSliceChunk.length; j++) {
      const value = perSliceChunk[j];

      if (value !== 0) {
        nonZeroCount++;

        if (!valueStats.has(value)) {
          valueStats.set(value, {
            count: 1,
            firstSlice: i,
            firstIndex: j
          });
        } else {
          valueStats.get(value).count++;
        }
      }
    }
  }

  // Debug output
  console.log("***** DEBUG ACTUAL Buffer contents ... TIMEPOINT:", timePoint);
  console.log("Non-zero voxels:", nonZeroCount);
  console.log("Unique non-zero values:", [...valueStats.keys()]);

  for (const [value, stats] of valueStats.entries()) {
    console.log(
      `Value ${value}: count=${stats.count}, firstSlice=${stats.firstSlice}, firstIndex=${stats.firstIndex}`
    );
  }

  console.log("Buffer type:", buf.constructor.name, "length:", buf.length);

  return valueStats;
}

