import { adaptersSEG } from '@cornerstonejs/adapters';
import { imageLoader } from '@cornerstonejs/core';
import { metaData } from '@cornerstonejs/core';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { OhifSegmentInfo, SegmentationData, SegmentMetadata, DEFAULT_SEGMENT_METADATA } from './../models/SegmentationData';
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
   

      const ohifInfo: OhifSegmentInfo = {
      segmentIndex: s.segmentMaskValue,   // matches backend schema on load
      label: s.label,
      cachedStats: s.cachedStats,
      quizSegmentMetadata: {
        groundTruth: s.groundTruth,
        referenceStandardMethod: s.referenceStandardMethod,
        hepaticSegment: s.hepaticSegment,
        isComplete: isComplete,
        dicomSegMaskValue: s.segmentMaskValue,
      }
    };

    segmentationService.addSegment(segmentationId, ohifInfo);

    useSegmentMetadataStore
      .getState()
      .setSegmentInfo(
        segmentationId,
        s.segmentMaskValue, //1-based - match to backend on load
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


    // // Capture segments from CURRENT service state (user-created in OHIF)
    // const currentSegments = seg.segments || {};

    // // synchronize the stored segment info with the current segments displayed in OHIF  (in case one has been deleted)
    // const segmentInfoFromService = Object.entries(currentSegments).map(([arrayIndexStr, segment]) => {

    //   return {
    //     segmentIndex: segmentIndex,
    //     label: segment.label || `Segment ${segmentIndex}`,
    //     cachedStats: segment.cachedStats,
    //     quizSegmentMetadata: segment.quizSegmentMetadata,
    //   };
    // });

    // console.log(' *** IN SAVESEGMENTATION after segment clicked', segmentInfoFromService);
    
//     refreshStoredSegmentMetadata(seg.segmentationId, segmentInfoFromService);


//               // update the store with the clicked segment metadata
//               const segmentArray = Object.values(currentSegments);
//               const segmentIndexToUpdate = segmentIndex;

//               const clickedSegmentInfoFromService = {
//                 ...segmentArray[segmentArrayIndex],
//                 segmentIndex: segmentIndexToUpdate,
//               };

//                     const ohifInfo: OhifSegmentInfo = {
//         segmentIndex,
//         label: segmentArray[segmentArrayIndex].label,
//         cachedStats: segmentArray[segmentArrayIndex].cachedStats,
//         quizSegmentMetadata: segmentMetadata,
//       };
 
//     // ///// FOR DEBUG
// console.log('segmentArrayIndex', segmentArrayIndex);
// console.log('segmentArray', segmentArray);
// console.log('segmentArray[segmentArrayIndex]', segmentArray[segmentArrayIndex]);
// console.log('currentSegments', currentSegments);
 
//               useSegmentMetadataStore
//                 .getState()
//                 .setSegmentInfo(seg.segmentationId, segmentIndexToUpdate, ohifInfo);
//               // useSegmentMetadataStore.getState().setMetadata(seg.segmentationId, segmentIndexToUpdate, segmentMetadata);
    
    
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
function buildAllSegmentsList( segmentationId: string) {

  const allSegments = useSegmentMetadataStore
    .getState()
    .getAllSegments(segmentationId);

  if (!allSegments) return [];

  return Object.entries(allSegments).map(([segmentIndexStr, stored]) => {
    // const segmentIndex = Number(segmentIndexStr); 
    const segMaskValue = stored.quizSegmentMetadata.dicomSegMaskValue;

    const base = {
      segmentIndex: segMaskValue,
      label: stored.label,
      cachedStats: stored.cachedStats,
    };

    const {groundTruth, referenceStandardMethod, hepaticSegment,} = stored.quizSegmentMetadata || DEFAULT_SEGMENT_METADATA;

    return {
      ...base,
      groundTruth,
      referenceStandardMethod,
      hepaticSegment,
    };
  });    
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
    // const arrayIndex = segmentIndex - 1;           // convert to 0-based
    const arrayIndex = stored.quizSegmentMetadata.dicomSegMaskValue;

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
export function refreshSegmentMetadataStore (segmentationService: any) {

  // get all segmentations from the service and from the store
  // compare each array 
  //    - collect id's that match, unmatched from service, and unmatched from store
  //    - if unmatched arrays lengths > 0 
  //           - remove unmatched store id's from store
  //           - add unmatched service ids into store
  //           - signal that a save to db is required
  //    - if matched array > 0 
  //           - check for mismatched segments service to store
  //           - replace all segments in store with those in the service
  //             This ensures that any changes to the segments (add or delete) is captured

  let bDatabaseUpdateRequired = false;

  const lSegmentationsFromService = segmentationService.getSegmentations();
  let lIdsFromService = [];
  lSegmentationsFromService.forEach(s => {
    lIdsFromService.push(s.segmentationId);
  })
  const lIdsFromStore = useSegmentMetadataStore.getState().getAllSegmentationsIds();
  
  let lUnmatchedIdsFromService = [];
  let lUnmatchedIdsFromStore = [];
  let lMatchedIds = [];

  // look for segmentations missing in each list
  lUnmatchedIdsFromService = lIdsFromService.filter(s => !lIdsFromStore.includes(s));
  lUnmatchedIdsFromStore = lIdsFromStore.filter(s => !lIdsFromService.includes(s));
  lMatchedIds = lIdsFromService.filter(s => lIdsFromStore.includes(s));

  const store = useSegmentMetadataStore.getState();

  // remove segmentation items from store if there is no match in the service
  lUnmatchedIdsFromStore.forEach( segmentationId => {
    store.clearSegmentation(segmentationId);
    bDatabaseUpdateRequired = true;
  });

  // add segmentations and segments from service to store
  lUnmatchedIdsFromService.forEach( segmentationId => {
    const segmentation = lSegmentationsFromService.find(s => s.segmentationId === segmentationId);
    if (!segmentation) return;

    const oSegments = segmentation?.segments || {};

    Object.values(oSegments as Record<number, OhifSegmentInfo>).forEach((segment, arrayIndex) => {
      // const segmentIndex = arrayIndex + 1;
      const segmentIndex = segment.segmentIndex;

      const ohifInfo: OhifSegmentInfo = {
        segmentIndex,
        label: segment.label,
        cachedStats: segment.cachedStats,
        quizSegmentMetadata: normalizeSegmentMetadata(segment, arrayIndex),
      };

      store.setSegmentInfo(segmentationId, segmentIndex, ohifInfo);
      bDatabaseUpdateRequired = true;
    });

  });

  
  // for segmentations that are in both service and store - make sure the segments match
  //    clear segment metadata from store and replace it with that from the service 

  lMatchedIds.forEach(segmentationId => {
    const segmentation = lSegmentationsFromService.find(
      s => s.segmentationId === segmentationId
    );

    const serviceSegments = Object.values(
      (segmentation?.segments || {}) as Record<number, OhifSegmentInfo>
    );

    const storeState = useSegmentMetadataStore.getState();
    const storeSegments = storeState.getAllSegments(segmentationId) || {};

    const serviceCount = serviceSegments.length;
    const storeCount = Object.keys(storeSegments).length;

    let needsRefresh = serviceCount !== storeCount;

    if (!needsRefresh) {
      for (const [arrayIndex, segmentFromService] of serviceSegments.entries()) {
        const expectedStoreIndex = arrayIndex + 1;
        const segmentFromStore = storeState.getSegmentInfo(
          segmentationId,
          expectedStoreIndex
        );

        if (!segmentFromStore) {
          needsRefresh = true;
          break;
        }

        const serviceLabel = segmentFromService.label;
        const storeLabel = segmentFromStore.label;

        if (serviceLabel !== storeLabel) {
          needsRefresh = true;
          break;
        }
      }
    }

    if (needsRefresh) {
      bDatabaseUpdateRequired = rebuildSegmentsFromService(segmentationId, serviceSegments);
    }
  });

  return bDatabaseUpdateRequired;

}

// =====================================

const rebuildSegmentsFromService = (
  segmentationId: string,
  serviceSegments: OhifSegmentInfo[]
) => {
  useSegmentMetadataStore.getState().clearAllSegmentInfo(segmentationId);

  for (const [arrayIndex, segment] of serviceSegments.entries()) {
    const ohifInfo: OhifSegmentInfo = {
      segmentIndex: segment.segmentIndex,
      label: segment.label,
      cachedStats: segment.cachedStats,
      quizSegmentMetadata: normalizeSegmentMetadata(segment, arrayIndex),
    };

    const maskValue = ohifInfo.quizSegmentMetadata?.dicomSegMaskValue;
    if (maskValue == null) {
      continue;
    }

    useSegmentMetadataStore
      .getState()
      .setSegmentInfo(segmentationId, maskValue, ohifInfo);
  }

  return true;
};

// =====================================
export function refreshStoredSegmentMetadata(segmentationId: string, currentSegments: any[]) {
  const store = useSegmentMetadataStore.getState();

  store.clearAllSegmentInfo(segmentationId);

  currentSegments.forEach((segment, arrayIndex) => {
    // const segmentIndex = arrayIndex + 1;

    const updatedQuizSegmentMetadata: SegmentMetadata = {
      ...segment.quizSegmentMetadata,
      dicomSegMaskValue: arrayIndex + 1,
    };

    const ohifInfo: OhifSegmentInfo = {
      segmentIndex: segment.segmentIndex,
      label: segment.label,
      cachedStats: segment.cachedStats,
      quizSegmentMetadata: updatedQuizSegmentMetadata,
    };

    const indexToUpdate = updatedQuizSegmentMetadata.dicomSegMaskValue;
    // store.setSegmentInfo(segmentationId, segmentIndex, ohifInfo);
    store.setSegmentInfo(segmentationId, indexToUpdate, ohifInfo);
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

// =====================================
export async function saveAllSegmentations ( {  
  segmentationService,
  viewportGridService,
  displaySetService,
  activeViewportId,
  commandsManager,
  studyInstanceUID,
}: {
  segmentationService: any;
  viewportGridService: any;
  displaySetService: any;
  activeViewportId: string;
  commandsManager: any;
  studyInstanceUID: string;
}) {
    const allSegmentations: SegmentationData = segmentationService.getSegmentations();
    console.log(' *** In saveAllSegmentations ... all Segmentations', allSegmentations);
    let updatedSeg;
    let segmentationObjects = [];

    for (const seg of Object.values(allSegmentations) as SegmentationData[]) {

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
        // const segmentIdsToRemove: string[] = [];
        let hasVolume = false;
        const segments = useSegmentMetadataStore.getState().getAllSegments(seg.segmentationId);
        

        for (const [segIdxStr, segment] of Object.entries(segments)) {
          const volume = segment.cachedStats?.namedStats?.volume?.value;
          if (typeof volume === 'number' && volume > 0) {
            hasVolume = true;
            break;
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
              segments: buildAllSegmentsList(seg.segmentationId),
              segmentationDataRef: segBlob,
          });

          console.log(' *** END OF GENERATE LOOP ... segObjects to post:', segmentationObjects);


        } // end if hasVolume


      } catch (err) {
        console.warn(`Skipping segmentation ${seg.segmentationId}: generating seg failed`, err);
        console.warn('Stack:', err.stack);
        continue;
      }

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
    
  }  // end for - to generate segmentation objects

}



// function normalizeSegmentMetadata(segment: OhifSegmentInfo, arrayIndex: number): SegmentMetadata {
//   const meta = segment.quizSegmentMetadata;

//   if (
//     !meta ||
//     typeof meta !== 'object' ||
//     meta.groundTruth === undefined ||
//     meta.referenceStandardMethod === undefined ||
//     meta.hepaticSegment === undefined ||
//     meta.isComplete === undefined
//   ) {
//     return { ...DEFAULT_SEGMENT_METADATA,
//       dicomSegMaskValue: arrayIndex,
//      };
//   } else {
//       segment.quizSegmentMetadata.isComplete = computeSegmentDataIsComplete(segment.quizSegmentMetadata);
//   }

//   return meta;
// }


function normalizeSegmentMetadata(
  segment: OhifSegmentInfo,
  arrayIndex: number
): SegmentMetadata {
  const meta = segment.quizSegmentMetadata;

  const baseMeta: SegmentMetadata =
    meta &&
    typeof meta === 'object' &&
    meta.groundTruth !== undefined &&
    meta.referenceStandardMethod !== undefined &&
    meta.hepaticSegment !== undefined &&
    meta.isComplete !== undefined
      ? {
          ...DEFAULT_SEGMENT_METADATA,
          ...meta,
        }
      : {
          ...DEFAULT_SEGMENT_METADATA,
        };

  const normalizedMeta: SegmentMetadata = {
    ...baseMeta,
    dicomSegMaskValue: arrayIndex + 1,
  };

  return {
    ...normalizedMeta,
    isComplete: computeSegmentDataIsComplete(normalizedMeta),
  };
}


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

// >>>>>>>>>>>>>>>>>>  From Perplexity <<<<<<<<<<
// export async function saveAllSegmentations({
//   segmentationService,
//   viewportGridService,
//   displaySetService,
//   activeViewportId,
//   commandsManager,
//   studyInstanceUID,
// }: {
//   segmentationService: any;
//   viewportGridService: any;
//   displaySetService: any;
//   activeViewportId: string;
//   commandsManager: any;
//   studyInstanceUID: string;
// }) {
//   const allSegmentations = segmentationService.getSegmentations();
//   const segmentationObjects = [];

//   for (const segmentation of Object.values(allSegmentations) as SegmentationData[]) {
//     const segmentationId = segmentation.segmentationId;

//     try {
//       const sourceImageId = segmentation.representationData?.Labelmap?.referencedImageIds?.[0];
//       if (!sourceImageId) {
//         console.warn(`Skipping segmentation ${segmentationId}: no referenced image id`);
//         continue;
//       }

//       segmentationService.addOrUpdateSegmentation({
//         segmentationId,
//         type: segmentation.type,
//         predecessorImageId: sourceImageId,
//       });

//       const updatedSeg = segmentationService.getSegmentation(segmentationId);
//       if (!updatedSeg) {
//         console.warn(`Skipping segmentation ${segmentationId}: update failed`);
//         continue;
//       }

//       const seriesUid = getSeriesUid(sourceImageId);
//       const displaySets = displaySetService.getDisplaySetsForSeries(seriesUid);
//       const displaySetInstanceUID = displaySets?.[0]?.displaySetInstanceUID;

//       if (!displaySetInstanceUID) {
//         console.warn(`Skipping segmentation ${segmentationId}: no display set for series ${seriesUid}`);
//         continue;
//       }

//       await viewportGridService.setDisplaySetsForViewport({
//         viewportId: activeViewportId,
//         displaySetInstanceUIDs: [displaySetInstanceUID],
//       });

//       await new Promise(resolve => setTimeout(resolve, 50));

//       const storeState = useSegmentMetadataStore.getState();
//       const storeSegments = storeState.getAllSegments(segmentationId) || {};

//       const hasVolume = Object.values(storeSegments).some(segment => {
//         const volume = segment.cachedStats?.namedStats?.volume?.value;
//         return typeof volume === 'number' && volume > 0;
//       });

//       if (!hasVolume) {
//         continue;
//       }

//       const generatedSeg = commandsManager.runCommand('generateSegmentation', {
//         segmentationId,
//       });

//       if (!generatedSeg?.dataset) {
//         console.warn(`Skipping segmentation ${segmentationId}: generation failed`);
//         continue;
//       }

//       const meta = {
//         FileMetaInformationVersion: generatedSeg.dataset._meta?.FileMetaInformationVersion?.Value,
//         MediaStorageSOPClassUID: generatedSeg.dataset.SOPClassUID,
//         MediaStorageSOPInstanceUID: generatedSeg.dataset.SOPInstanceUID,
//         TransferSyntaxUID: EXPLICIT_VR_LITTLE_ENDIAN,
//         ImplementationClassUID,
//         ImplementationVersionName,
//       };

//       const denaturalizedMetadata = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(meta);
//       const denaturalizedDataset = dcmjs.data.DicomMetaDictionary.denaturalizeDataset(generatedSeg.dataset);
//       const dicomDict = new DicomDict(denaturalizedMetadata);
//       dicomDict.dict = denaturalizedDataset;

//       let segBlob;
//       try {
//         const arrayBuffer = dicomDict.write();
//         segBlob = new Blob([arrayBuffer], { type: 'application/dicom' });
//       } catch (blobError) {
//         console.warn(`Skipping segmentation ${segmentationId}: blob creation failed`, blobError);
//         continue;
//       }

//       const persistedSegments = Object.entries(storeSegments)
//         .sort(([a], [b]) => Number(a) - Number(b))
//         .map(([segmentIndex, segment]) => ({
//           segmentIndex: Number(segmentIndex),
//           label: segment.label,
//           cachedStats: segment.cachedStats,
//           quizSegmentMetadata: segment.quizSegmentMetadata,
//         }));

//       segmentationObjects.push({
//         segmentationId,
//         sourceSeriesInstanceUid: seriesUid,
//         label: segmentation.label,
//         segments: persistedSegments,
//         segmentationDataRef: segBlob,
//       });
//     } catch (err) {
//       console.warn(`Skipping segmentation ${segmentation.segmentationId}: generating seg failed`, err);
//     }
//   }

//   const postSegmentationResult = await postSegmentations({
//     segmentationObjects,
//     studyUID: studyInstanceUID,
//   });

//   if (postSegmentationResult?.error) {
//     console.warn('⚠️ Failed to post segmentations:', postSegmentationResult.error);
//   } else {
//     console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
//   }
// }