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
    // create one empty labelmap segmentation - this automatically creates one segment
    await segmentationService.createLabelmapForDisplaySet(
        referencedDisplaySet,
        {
        segmentationId: segmentationId,
        label: segmentationLabel,
        },
    );
    // console.log(' *** IN LOAD DICOM SEG INTO OHIF ... segmentMetadata', segmentMetadata);

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
      console.log(' *** IN LOAD DICOM SEG INTO OHIF ... each segment', s, ohifInfo);

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
export async function saveSegmentation({
  seg,
  segmentMetadata,
  segmentArrayIndex, // 0-based
  segmentIndex, // 1-based
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
  const { displaySetService, viewportGridService, segmentationService } =
    servicesManager.services;

  const editedSegmentation = seg.segmentationId;

  // update the service with the metatdata for the edited segment
  const isComplete = computeSegmentDataIsComplete(segmentMetadata);
  const ohifInfo: OhifSegmentInfo = {
    segmentIndex: segmentIndex, // 1‑based
    label: seg.segments?.[segmentArrayIndex]?.label,
    cachedStats: seg.segments?.[segmentArrayIndex]?.cachedStats ?? {},
    quizSegmentMetadata: {
      groundTruth: segmentMetadata.groundTruth,
      referenceStandardMethod: segmentMetadata.referenceStandardMethod,
      hepaticSegment: segmentMetadata.hepaticSegment,
      isComplete,
      dicomSegMaskValue: segmentIndex,
    },
  };
  segmentationService.addSegment(editedSegmentation, ohifInfo);


  const allSegmentations = segmentationService.getSegmentations();
  const segmentationObjects = [];

  const allResults: GenerateSegmentationActivityResult[] = [];

  for (const currentSeg of Object.values(allSegmentations) as SegmentationData[]) {

    console.log(' *** IN SAVESEGMENTATION - ServiceId, seg:', currentSeg);

    const result = await generateSegmentationActivity(currentSeg, {
      segmentationService,
      displaySetService,
      viewportGridService,
      commandsManager,
      activeViewportId,
      buildSegmentFn: (segmentationId: string) =>
        buildSegmentList(segmentationId, segmentMetadata, segmentArrayIndex, editedSegmentation),
    });

    allResults.push(result);  // Track for stats

    // use structured clone so that each entry is its own copy instead of a shared reference
    //       prevents overwriting segment info stored in segmentation 1 segment 1 
    //        by segmentation 2 segment 1 for example 
    if (result.segmentationDataRef) {
      segmentationObjects.push(structuredClone(result));
    }
  }

  // Add failure reporting
  const failures = allResults.filter(r => !r.success);
  const validCount = segmentationObjects.length;
  console.log(`✅ ${validCount}/${allResults.length} succeeded`);
  if (failures.length) {
    console.log('❌ Failures:', failures.map(r => r.segmentationId));
  }

  console.log('segObjects to post in SaveSegmentation:', segmentationObjects);

  let postSegmentationResult;
  if (segmentationObjects.length > 0) {
    postSegmentationResult = postSegmentations({
      segmentationObjects,
      studyUID: studyInstanceUID,
    });
  } else {
    console.warn('🛑 No valid segmentations to post - skipping');
    postSegmentationResult = { success: false, reason: 'no_valid_objects' };
  }

  if (!postSegmentationResult?.success) {
    console.warn('⚠️ Failed to post:', postSegmentationResult?.error );
  } else {
    console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
  }

  console.log(`📬 Confirmed save segmentations to DB`);
}


// =====================================
export async function saveAllSegmentations({
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
  console.log(' *** In saveAllSegmentations ... allSegmentations', allSegmentations);

  //////////////////////////////
  //////////////////////////////
  // for debug
  Object.values(allSegmentations).forEach(segmentation => {
    const segId = segmentation.segmentationId;
    const serviceKeys = Object.keys(segmentation?.segments || {});

    const storeState = useSegmentMetadataStore.getState();
    const storeSegments = storeState.getAllSegments(segId) || {};

    console.log('📊 in SaveAll store keys:', Object.keys(storeSegments), `segmentation ${segId}`);
    console.log('📊 in SaveAll service keys:', serviceKeys, `segmentation ${segId}`);

  });
  //////////////////////////////
  //////////////////////////////


  const segmentationObjectsPromises = Object.values(allSegmentations).map(seg =>
    generateSegmentationActivity(seg, {
      segmentationService,
      displaySetService,
      viewportGridService,
      commandsManager,
      activeViewportId,
      buildSegmentFn: (segmentationId: string) =>
        buildAllSegmentsList(segmentationId),
    })
  );

  const allResults = await Promise.all(segmentationObjectsPromises);

  // const validObjects = allResults.filter(r => r.segmentationDataRef);
  const validObjects = allResults.filter(r => r.success)
  const failures = allResults.filter(r => !r.success);

  console.log(`✅ ${validObjects.length}/${allResults.length} succeeded`);
  if (failures.length) {
    console.log('❌ Failures:', failures.map(r => r.segmentationId));
  }

//////// ??????????
//////// ?????????? WHAT HAPPENS IF A SEGMENT WAS CREATED WITH NO VOLUME ????????? //////////
//   let postSegmentationResult;
//   if (validObjects.length > 0) {
//     postSegmentationResult = await postSegmentations({
//       segmentationObjects: validObjects,
//       studyUID: studyInstanceUID,
//     });
//   } else {
//     // still sync DB even if no blobs
//     postSegmentationResult = await postSegmentations({
//       segmentationObjects: [],
//       studyUID: studyInstanceUID,
//     });
//   }

//   if (!postSegmentationResult.success) {
//     console.warn('⚠️ Failed to post segmentations:', postSegmentationResult.error);
//   } else {
//     console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
//   }

//   console.log(`📬 Confirmed save segmentations to DB`);
// }
//////// ??????????

  let postSegmentationResult;
  if (validObjects.length > 0) {
    postSegmentationResult = postSegmentations({  // Not async anymore
      segmentationObjects: validObjects,
      studyUID: studyInstanceUID,
    });
  } else {
    console.warn('🛑 No valid segmentations to post - skipping');
    postSegmentationResult = { success: false, reason: 'no_valid_objects' };
  }

  if (!postSegmentationResult?.success) {
    console.warn('⚠️ Failed to post:', postSegmentationResult?.error);
  } else {
    console.log(`📌 Segmentations posted for ${studyInstanceUID}`);
  }

  console.log(`📬 Confirmed save segmentations to DB`);
}




// =====================================
// function buildSegmentList(
//   segmentationId: string,
//   updatedMetadata: SegmentMetadata,
//   arrayIndexToUpdate: number
// ) {
  
//   const allSegments = useSegmentMetadataStore
//     .getState()
//     .getAllSegments(segmentationId);
//   console.log(' *** IN BUILDSEGMENTLIST - id:', segmentationId, allSegments, arrayIndexToUpdate, updatedMetadata);
  
//   if (!allSegments) return [];

//   return Object.entries(allSegments).map(([segmentIndexStr, stored]) => {
//     const segmentIndex = Number(segmentIndexStr);
//     const storedArrayIndex = (stored.quizSegmentMetadata?.dicomSegMaskValue ?? segmentIndex) - 1;

//     const quizSegmentMetadata =
//       storedArrayIndex === arrayIndexToUpdate
//         ? { ...updatedMetadata }
//         : { ...stored.quizSegmentMetadata };

//     return {
//       segmentIndex,
//       label: stored.label,
//       cachedStats: stored.cachedStats,
//       ...quizSegmentMetadata,
//     };
//   });
// }

function buildSegmentList(
  currentSegmentationId: string,
  updatedMetadata: SegmentMetadata,
  arrayIndexToUpdate: number,
  editedSegmentationId: string,
) {
  const allSegments = useSegmentMetadataStore
    .getState()
    .getAllSegments(currentSegmentationId);

  console.log(
    ' *** IN BUILDSEGMENTLIST - id:',
    currentSegmentationId,
    allSegments,
    arrayIndexToUpdate,
    updatedMetadata,
    editedSegmentationId,
  );

  if (!allSegments) return [];

  return Object.entries(allSegments).map(([segmentIndexStr, stored]) => {
    const segmentIndex = Number(segmentIndexStr);

    const storedMaskValue =
      stored.quizSegmentMetadata?.dicomSegMaskValue ?? segmentIndex;

    const storedArrayIndex = storedMaskValue - 1;

    let isUpdatedSegment = false;
    if (
      storedArrayIndex === arrayIndexToUpdate &&
      currentSegmentationId === editedSegmentationId
    ) {
      isUpdatedSegment = true;
    }

    const metadata = isUpdatedSegment
      ? { ...updatedMetadata }
      : stored.quizSegmentMetadata
        ? { ...stored.quizSegmentMetadata }
        : {
            ...DEFAULT_SEGMENT_METADATA,
            hepaticSegment: [...DEFAULT_SEGMENT_METADATA.hepaticSegment],
          };

    console.log(
      ' *** IN BUILDSEGMENTLIST after adjustment - id, metadata for post: ',
      currentSegmentationId, 
      metadata,
    );

    return {
      // segmentIndex: segmentIndex, // ???? OR storedMaskValue ???????  // backend stores this as segmentMaskValue
      segmentIndex: storedMaskValue,
      label: stored.label,
      cachedStats: stored.cachedStats,
      groundTruth: metadata.groundTruth,
      referenceStandardMethod: metadata.referenceStandardMethod,
      hepaticSegment: [...metadata.hepaticSegment],
    };
  });
}

// =====================================
function buildAllSegmentsList( segmentationId: string) {

  const allSegments = useSegmentMetadataStore
    .getState()
    .getAllSegments(segmentationId);

  if (!allSegments) return [];

  return Object.entries(allSegments).map(([segmentIndexStr, stored]) => {
    // const segmentIndex = Number(segmentIndexStr); 
    const segMaskValue = stored.quizSegmentMetadata?.dicomSegMaskValue || Number(segmentIndexStr);

    const base = {
      segmentIndex: segMaskValue,   // backend stores this as segmentMaskValue
      label: stored.label,
      cachedStats: stored.cachedStats,
    };

    const {groundTruth, referenceStandardMethod, hepaticSegment,} = stored.quizSegmentMetadata || DEFAULT_SEGMENT_METADATA;

        console.log(
      ' *** IN BUILD-ALL-SEGMENTSLIST after adjustment - id, base, metadata for post: ',
      segmentationId, base,
      groundTruth, referenceStandardMethod, hepaticSegment,
    );

    return {
      ...base,
      groundTruth,
      referenceStandardMethod,
      hepaticSegment,
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
/**
 * 
 * @param segmentationService OHIF's service to get the collection of segmentations
 * @returns boolean indicating whether a save to the database needs to be done
 */
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
      const quizSegmentMetadata = normalizeSegmentMetadata(segment, arrayIndex);

      const ohifInfo: OhifSegmentInfo = {
        segmentIndex,
        label: segment.label,
        cachedStats: segment.cachedStats,
        quizSegmentMetadata
      };

      store.setSegmentInfo(segmentationId, segmentIndex, ohifInfo);

      // update the service with the segment metadata structure
      segmentationService.addSegment(segmentationId, ohifInfo);


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

    ////////////
    // for debug
    console.log('📊 beforeRebuild store keys:', Object.keys(storeSegments));
    console.log('📊 beforeRebuild service keys:', Object.keys(segmentation?.segments || {}));
    ////////////

    const needsRefresh = shouldRefreshSegmentMetadata(
      segmentationId,
      segmentation,
      storeSegments
    );

    if (needsRefresh) {
      bDatabaseUpdateRequired = rebuildSegmentsFromService(segmentationId, serviceSegments);
    }


  });

  return bDatabaseUpdateRequired;
}

// =====================================
/**
 * Function to pull information from the segmentation service and update the store.
 * @param segmentationId 
 * @param serviceSegments 
 * @returns 
 */
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

    ////// ???????? using Mask Value makes store keys different from the service keys
    // const maskValue = ohifInfo.quizSegmentMetadata?.dicomSegMaskValue;
    // if (maskValue == null) {
    //   continue;
    // }
    // useSegmentMetadataStore
    //   .getState()
    //   .setSegmentInfo(segmentationId, maskValue, ohifInfo);
    ////// ????????

    // use segmentIndex as key for the store to keep in sync with the service keys
    useSegmentMetadataStore
      .getState()
      .setSegmentInfo(segmentationId, segment.segmentIndex, ohifInfo)
  }

  return true;
};

// =====================================
export function computeSegmentDataIsComplete(m: SegmentMetadata) {
  return (
    m.groundTruth.trim() !== "" &&
    m.referenceStandardMethod.trim() !== "" &&
    m.hepaticSegment.length > 0
  );
};

// =====================================
/**
 * Function to add default quiz segment metadata if this property is currently undefined
 * @param segment 
 * @param arrayIndex 
 * @returns 
 */
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

// =====================================

// =====================================
/**
 * Function to test if a refresh of the database is needed for different circumstances:
 *    1) was there a segment in the service not represented in the store
 *    2) was there a segment in the store no longer in the service
 *    3) for a matched segment service to store, check if the cached stats are the same
 * @param segmentationId 
 * @param segmentationFromService 
 * @param storeSegments 
 * @returns 
 */
function shouldRefreshSegmentMetadata(
  segmentationId: string,
  segmentationFromService: {
    segments: Record<number, OhifSegmentInfo>;
  } | null | undefined,
  storeSegments: Record<number, OhifSegmentInfo>
): boolean {
  const serviceSegmentIndices = Object.keys(segmentationFromService?.segments || {}).map(Number);
  const storeSegmentIndices = Object.keys(storeSegments).map(Number);

  const serviceCount = serviceSegmentIndices.length;
  const storeCount = storeSegmentIndices.length;

  let needsRefresh = serviceCount !== storeCount;


  // 1. Check: every service segment exists in store, and cachedStats match
  if (!needsRefresh && segmentationFromService?.segments) {
    for (const segmentIndex of serviceSegmentIndices) {
      const segmentFromServiceInfo = segmentationFromService.segments[segmentIndex];
      const segmentFromStore = storeSegments[segmentIndex];

      if (!segmentFromStore) {
        console.warn(
          `Segment missing in store: serviceIndex=${segmentIndex}, segId=${segmentationId}`
        );
        needsRefresh = true;
        break;
      }

      if (!cachedStatsEqual(segmentFromServiceInfo?.cachedStats, segmentFromStore.cachedStats)) {
        console.warn(
          `cachedStats mismatch: serviceIndex=${segmentIndex}, segId=${segmentationId}`
        );
        needsRefresh = true;
        break;
      }
    }
  }

  // 2. Check: every store segment exists in service
  if (!needsRefresh) {
    for (const segmentIndex of storeSegmentIndices) {
      const segmentFromStore = storeSegments[segmentIndex];
      const segmentFromServiceInfo = segmentationFromService?.segments[segmentIndex];

      if (!segmentFromServiceInfo) {
        console.warn(
          `Segment missing in service: storeIndex=${segmentIndex}, segId=${segmentationId}`
        );
        needsRefresh = true;
        break;
      }
    }
  }

  return needsRefresh;
}

// =====================================


type SegmentationServices = {
  segmentationService: any;
  displaySetService: any;
  viewportGridService: any;
  commandsManager: any;
};

type BuildSegmentFn = (segmentationId: string) => any; // e.g., buildSegmentList | buildAllSegmentsList

type GenerateSegmentationActivityResult = {
  segmentationId: string;
  sourceSeriesInstanceUid: string | null;
  label: string;
  segments: any[] | null;
  segmentationDataRef: Blob | null;
  success: boolean;
};

/**
 * Given a segmentation and services, generates a DICOM‑SEG blob and returns a structured object to post.
 * If no volume exists or generation fails, returns an object with null blob.
 */
export async function generateSegmentationActivity(
  seg: SegmentationData,
  {
    segmentationService,
    displaySetService,
    viewportGridService,
    commandsManager,
    activeViewportId,
    buildSegmentFn,
  }: SegmentationServices & {
    activeViewportId: string;
    buildSegmentFn: BuildSegmentFn;
  }
): Promise<GenerateSegmentationActivityResult> {
  const segResult: GenerateSegmentationActivityResult = {
    segmentationId: seg.segmentationId,
    sourceSeriesInstanceUid: '',
    label: seg.label,
    segments: null,
    segmentationDataRef: null,
    success: false,
  };

  try {
    // Because this is a custom segmentation extension, predecessorImageId may be missing.
    segmentationService.addOrUpdateSegmentation({
      segmentationId: seg.segmentationId,
      type: seg.type,
      predecessorImageId: seg.representationData.Labelmap.referencedImageIds[0],
    });

    const updatedSeg = segmentationService.getSegmentation(seg.segmentationId);
    console.log('updatedSeg after update: id, seg', seg.segmentationId, updatedSeg);

    const refImageId = seg.representationData.Labelmap.referencedImageIds[0];
    const seriesUid = getSeriesUid(refImageId);
    if (!seriesUid) {
      console.warn(`No series UID for imageId ${refImageId} in ${seg.segmentationId}` );
      return segResult;
    }

    const displaySets = displaySetService.getDisplaySetsForSeries(seriesUid);
    const displaySetInstanceUID = displaySets[0]?.displaySetInstanceUID;

    if (!displaySetInstanceUID) {
      console.warn(`No displaySet found for series ${seriesUid} in ${seg.segmentationId}`);
      return segResult;
    }

    await viewportGridService.setDisplaySetsForViewport({
      viewportId: activeViewportId,
      displaySetInstanceUIDs: [displaySetInstanceUID],
    });

    // Give OHIF a moment to render the new stack
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if at least one segment has non‑zero volume.
    let hasVolume = false;
    const segments = useSegmentMetadataStore.getState().getAllSegments(seg.segmentationId);

    if (!segments || Object.keys(segments).length === 0) {
      console.warn(`No segments found for ${seg.segmentationId}; skipping`);
      return segResult;
    }

    for (const [segIdxStr, segment] of Object.entries(segments)) {
      const volume =
        segment.cachedStats?.namedStats?.volume?.value;
      if (typeof volume === 'number' && volume > 0) {
        hasVolume = true;
        break;
      }
    }

    if (!hasVolume) {
      console.log('No volume in any segments; skipping DICOM‑SEG generation', seg.segmentationId);
      return segResult;
    }

    const generatedSeg = commandsManager.runCommand('generateSegmentation', {
      segmentationId: seg.segmentationId,
    });

    if (!generatedSeg || !generatedSeg.dataset) {
      console.warn(
        `Skipping segmentation ${seg.segmentationId}: generation failed`
      );
      throw new Error('no_generated_segmentation_from_commandsManager');
    }

    console.log(' *** GENERATED SEG:', generatedSeg);

    // Metadata for DICOM‑SEG file meta
    const meta = {
      FileMetaInformationVersion:
        generatedSeg.dataset._meta?.FileMetaInformationVersion?.Value,
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

    let segBlob: Blob | null;
    try {
      const arrayBuffer = dicomDict.write();
      segBlob = new Blob([arrayBuffer], { type: 'application/dicom' });
      console.log('Blob created successfully, size:', segBlob.size, 'type:', segBlob.type);
    } catch (blobError) {
      console.warn(`Skipping segmentation ${seg.segmentationId}: blob creation failed`,blobError);
      throw new Error('no_segmentationDataRef_segBlob_generated');
    }

    segResult.segments = buildSegmentFn(seg.segmentationId);
    segResult.sourceSeriesInstanceUid = seriesUid;
    segResult.segmentationDataRef = segBlob;
    segResult.success = true;
    return segResult ;
  } catch (err) {
    console.warn( `Skipping segmentation ${seg.segmentationId}: generation failed. Check existing segmentation collection in database.`, err );
    alert('⚠️ Segmentation ${seg.segmentationId} : generation failed; Press F12 to display details.');

    return segResult;
  }
}


///////////////////////////////////////////////
//////////////// HELPERS /////////////////////
///////////////////////////////////////////////
// =====================================
type NumericValue = number | number[];

function numberEqual(
  a: NumericValue,
  b: NumericValue,
  tolerance = 1e-10
): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < tolerance;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!numberEqual(a[i], b[i], tolerance)) {
        return false;
      }
    }
    return true;
  }

  return false; // mixed types: number vs array → not equal
}

// =====================================
interface StatValue {
  name: string;
  label: string;
  value: number | number[];
  unit: string | null;
  order: number;
}

type NamedStats = Record<string, StatValue>;

function deepEqualNamedStats(
  a?: NamedStats,
  b?: NamedStats,
  tolerance = 1e-10
): boolean {
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const statKey of keysA) {
    if (!(statKey in (b || {}))) {
      return false;
    }

    const statA = a![statKey];
    const statB = b![statKey];

    // Units must match exactly (e.g., mm³ vs mL)
    if (statA.unit !== statB.unit) {
      return false;
    }

    // Optional: compare order/name/label if they matter; omit if cosmetic
    // if (statA.order !== statB.order) return false;
    // if (statA.name !== statB.name) return false;
    // if (statA.label !== statB.label) return false;

    // Tolerant numeric compare for value
    if (!numberEqual(statA.value, statB.value, tolerance)) {
      return false;
    }
  }

  return true;
}
// =====================================
interface CachedStats {
  namedStats?: NamedStats;
  // any other top‑level keys you have
}

function cachedStatsEqual(
  a?: CachedStats,
  b?: CachedStats,
  tolerance = 1e-10
): boolean {
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!(key in (b || {}))) {
      return false;
    }

    const fieldA = (a as any)[key];
    const fieldB = (b as any)[key];

    if (key === 'namedStats') {
      if (!deepEqualNamedStats(fieldA, fieldB, tolerance)) {
        return false;
      }
      continue;
    }

    // For other top‑level keys, shallow compare (or expand if needed)
    if (fieldA !== fieldB) {
      return false;
    }
  }

  return true;
}


///////////////////////////////////////////////
//////////////  DEBUG HELPERS /////////////////
///////////////////////////////////////////////


function bufferCounter(buf: any, timePoint: any) {
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



// =====================================
// =====================================
// =====================================
// =====================================
// =====================================
