import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { OhifSegmentInfo, 
        SegmentationData,
        SegmentMetadata,
        DEFAULT_SEGMENT_METADATA ,
        SegmentData
       } from './../models/SegmentationData';
import {
  ImplementationClassUID,
  ImplementationVersionName,
  EXPLICIT_VR_LITTLE_ENDIAN,
} from '../init';
import dcmjs from 'dcmjs';
import { postSegmentations } from '../handlers/postSegmentations';
import { segmentation, Enums as ToolEnums } from '@cornerstonejs/tools';
import { createSegDisplaySetFromArrayBuffer } from './dicomSegUtils';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { eventTarget, EVENTS } from '@cornerstonejs/core';


// for creating the blob when saving a segment
const { DicomMetaDictionary, DicomDict } = dcmjs.data;

/**
 *  loadDicomSegIntoOHIF
 *    Uses OHIF's native functionality to create the segmentation.
 *    Code triggers an event to force namedStats to be calculated 
 *      and added to each segment's cachedStats property
 * 
 */
 
// =====================================
export interface LoadDicomSegParams {
  segmentationId: string;
  referencedSeriesInstanceUID: string;
  segmentationLabel: string;
  segmentMetadata: any;
  servicesManager: any;
  arrayBuffer: ArrayBuffer;
  activeViewportId: string;
}

export async function loadDicomSegIntoOHIF(
  params: LoadDicomSegParams
): Promise<void> {
  const {
    segmentationId,
    referencedSeriesInstanceUID,
    segmentationLabel,
    segmentMetadata,
    servicesManager,
    arrayBuffer,
    activeViewportId,
  } = params;

  // ~~~~~~~~~~
  const {
        segmentationService,
        displaySetService,
  } = servicesManager.services;

  eventTarget.addEventListener('SEGMENTATION_DATA_MODIFIED', evt => {
  console.log('📊 Stats updated:', evt.detail);
});
  // get referenced display sets and image ids
  const referencedDisplaySets =
    displaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
  const referencedDisplaySet = referencedDisplaySets?.[0];

  if (!referencedDisplaySet) {
    // console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
    console.warn('No referenced displaySet for SEG', segmentationId);
    return;
  }

  const referencedDisplaySetInstanceUID = referencedDisplaySet.displaySetInstanceUID;
  const referencedImageIds = referencedDisplaySet.images?.map(i => i.imageId) ?? [];
  if (!referencedImageIds.length) {
    console.warn('No imageIds found for referenced displaySet', referencedSeriesInstanceUID);
    return;
  }

    // create segments and update SegmentMetadataStore
    const segments: Record<number, Partial<SegmentData>> = {};

    segmentMetadata.forEach(s => {
      const isComplete = computeSegmentDataIsComplete(s);

      segments[s.segmentMaskValue] = {
        label: s.label,
        active: s.segmentMaskValue === 1,
        cachedStats: s.cachedStats,
        visibility: true,
        locked: false,
      };

      // add segment with quiz metadata into the store
      const ohifInfo: OhifSegmentInfo = {
        segmentIndex: s.segmentMaskValue,
        label: s.label,
        cachedStats: s.cachedStats,
        quizSegmentMetadata: {
          groundTruth: s.groundTruth,
          referenceStandardMethod: s.referenceStandardMethod,
          hepaticSegment: s.hepaticSegment,
          isComplete,
          dicomSegMaskValue: s.segmentMaskValue,
        },
      };

      useSegmentMetadataStore
        .getState()
        .setSegmentInfo(segmentationId, s.segmentMaskValue, ohifInfo);
    });


  const blob = new Blob([arrayBuffer], { type: 'application/dicom' });
  const segImageId = dicomImageLoader.wadouri.fileManager.add(blob);

  // /////////// FOR DEBUG ////////////////
  // analyzeSegmentationBuffer(arrayBuffer);
  // analyzeSEGSegmentMapping(arrayBuffer);
  // extractSegmentMasksFromSEG(arrayBuffer);
  // countSegmentVoxels(arrayBuffer);
  // //////////////////////////////////////


  // Build segDisplaySet from arrayBuffer (OHIF-specific)
  const segDisplaySet = await createSegDisplaySetFromArrayBuffer(
    arrayBuffer,
    segmentationId,
    referencedDisplaySetInstanceUID,
    referencedImageIds,
    segImageId,
    segments,
  );

  // console.log (' *** segDisplaySet:', segDisplaySet);


  const createdSegmentationId =
    await segmentationService.createSegmentationForSEGDisplaySet(segDisplaySet, {
      segmentationId,
      type: ToolEnums.SegmentationRepresentations.Labelmap,
    });


  await segmentation.addSegmentationRepresentations(activeViewportId, [
    {
      segmentationId: createdSegmentationId,
      type: ToolEnums.SegmentationRepresentations.Labelmap,
    },
  ]);

  await forceStatsRecompute(segmentationService, createdSegmentationId, 1);

  const createdSegmentation = segmentationService.getSegmentation(createdSegmentationId);
  console.log('Created segmentation:', createdSegmentation);

}

// =====================================

export function forceStatsRecompute(segmentationService: any, segmentationId: string, segmentIndex: number) {
  if (!segmentationId) return;

  eventTarget.dispatchEvent(
    new CustomEvent(segmentationService.EVENTS.SEGMENTATION_DATA_MODIFIED, {
      detail: { segmentationId, segmentIndex },
    })
  );

  // Wait longer than the debounce before trusting stats have been computed
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 1200); // 1.2s > 1s debounce
  });
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
    label: seg.segments?.[segmentIndex]?.label,
    cachedStats: seg.segments?.[segmentIndex]?.cachedStats ?? {},
    quizSegmentMetadata: {
      groundTruth: segmentMetadata.groundTruth,
      referenceStandardMethod: segmentMetadata.referenceStandardMethod,
      hepaticSegment: segmentMetadata.hepaticSegment,
      isComplete,
      // dicomSegMaskValue: segmentIndex,
      dicomSegMaskValue: seg.segments?.[segmentIndex]?.quizSegmentMetadata.dicomSegMaskValue,
    },
  };
  // segmentationService.addSegment(editedSegmentation, ohifInfo);


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
        buildSegmentListForPosting(segmentationId, segmentMetadata, segmentArrayIndex, segmentIndex, editedSegmentation),
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
  // Check for ANY failures - if any !result.success, abort entirely
  // const failures = allResults.filter(r => !r.success);
  const hasFailures = allResults.some(result => !result.success);
  if (hasFailures) {
    const failedIds = allResults
      .filter(result => !result.success)
      .map(result => result.segmentationId);
    console.error('❌ Aborting save: failures in segmentations', failedIds);
    alert('⚠️ In SaveSegmentation - failed - nothing posted to db; Press F12 to display console details.');
    return;  // Nothing gets posted!
  }

  const validCount = segmentationObjects.length;
  console.log(`✅ ${validCount}/${allResults.length} succeeded`);


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


//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
// -  highjacking the UI here to display each series before generating segmentation
// -  causes flickering
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  
const allResults = [];

for (const seg of Object.values(allSegmentations)) {
    // Identify the series
    const referencedDisplaySets = displaySetService.getDisplaySetsForSeries(seg.referencedSeriesInstanceUID);
    const referencedDisplaySet = referencedDisplaySets?.[0];

    if (!referencedDisplaySet) {
        console.warn(`Could not find display set for series ${seg.referencedSeriesInstanceUID}`);
        allResults.push({ success: false, error: 'missing_display_set', segmentationId: seg.segmentationId });
        continue;
    }

    // Check current viewport
    const currentDisplaySets = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);
    const isReferencedSeriesActive = currentDisplaySets.includes(referencedDisplaySet.displaySetInstanceUID);

    if (!isReferencedSeriesActive) {
        // Switch the viewport
        await viewportGridService.setDisplaySetsForViewport({
            viewportId: activeViewportId,
            displaySetInstanceUIDs: [referencedDisplaySet.displaySetInstanceUID],
        });

        // Give the UI time to re-render the volume
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    // Now it is safe to generate
    const result = await generateSegmentationActivity(seg, {
        segmentationService,
        displaySetService,
        viewportGridService,
        commandsManager,
        activeViewportId,
        buildSegmentFn: (segmentationId: string) => buildAllSegmentsListForPosting(segmentationId),
    });

    allResults.push(result);
}
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<  

  const validObjects = allResults.filter(r => r.success)

  // Check for ANY failures - if any !result.success, abort entirely
  const hasFailures = allResults.some(result => !result.success);
  if (hasFailures) {
    const failedIds = allResults
      .filter(result => !result.success)
      .map(result => result.segmentationId);
    console.error('❌ Aborting save: failures in segmentations', failedIds);
    alert('⚠️ In saveAllSegmentations - failed - nothing posted to db; Press F12 to display console details.');
    return;  // Nothing gets posted!
  }


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
/**
 * Function to build the segment list - ready for posting to the DB.
 *  As it iterates through all the segments, only the 'segment to update' is adjusted
 *    The value stored in the customized quiz metadata field in the service segmentation 
 *    is assigned to the segmentIndex field. This is interpreted in the backend as the mask value.
 * @param currentSegmentationId 
 * @param updatedMetadata 
 * @param arrayIndexToUpdate 
 * @param segmentIndexToUpdate 
 * @param editedSegmentationId 
 * @returns 
 */
function buildSegmentListForPosting(
  currentSegmentationId: string,
  updatedMetadata: SegmentMetadata,
  arrayIndexToUpdate: number,
  segmentIndexToUpdate: number,
  editedSegmentationId: string,
) {
  const allSegments = useSegmentMetadataStore
    .getState()
    .getAllSegments(currentSegmentationId);

  console.log(
    ' *** IN buildSegmentListForPosting - id:',
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
      stored.quizSegmentMetadata?.dicomSegMaskValue ?? arrayIndexToUpdate + 1;

    console.log(` *** IN BUILD SEGMENT LIST... segmentIndex: ${segmentIndex} arrayIndexToUpdate: ${arrayIndexToUpdate} segmentIndexToUpdate: ${segmentIndexToUpdate} storedMask: ${storedMaskValue}`);
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
      ' *** IN buildSegmentListForPosting after adjustment - id, metadata for post: ',
      currentSegmentationId, 
      metadata,
    );

    return {
      segmentIndex: storedMaskValue,  // backend stores this as segmentMaskValue
      label: stored.label,
      cachedStats: stored.cachedStats,
      groundTruth: metadata.groundTruth,
      referenceStandardMethod: metadata.referenceStandardMethod,
      hepaticSegment: [...metadata.hepaticSegment],
    };
  });
}

// =====================================
function buildAllSegmentsListForPosting( segmentationId: string) {

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
  //           - call fn to sync segments service <==> store
  //           - remove unmatched segments from store
  //           - add unmatched service segments to store
  //           - signal that a save to db is required

  let bDatabaseUpdateRequired = false;

  const lSegmentationsFromService: any[] = segmentationService.getSegmentations();
  const lIdsFromService: string[] =   lSegmentationsFromService.map(s => s.segmentationId);
  const lIdsFromStore = useSegmentMetadataStore.getState().getAllSegmentationsIds();

  console.log(' *** IN REFRESH - SERVICE SEGMENTATIONS:', lSegmentationsFromService);
  
  // look for segmentations missing in each list
  const lUnmatchedIdsFromStore: string[] = lIdsFromStore.filter(s => !lIdsFromService.includes(s));
  const lUnmatchedIdsFromService: string[] = lIdsFromService.filter(s => !lIdsFromStore.includes(s));
  const lMatchedIds: string[] = lIdsFromService.filter(s => lIdsFromStore.includes(s));

  const store = useSegmentMetadataStore.getState();

  // exists in store but not in service
  // remove segmentation items from store if there is no match in the service
  lUnmatchedIdsFromStore.forEach( segmentationId => {
    store.clearSegmentation(segmentationId);
    bDatabaseUpdateRequired = true;
  });

  // exists in service but not in store
  // add segmentations and segments from service to store
  lUnmatchedIdsFromService.forEach( segmentationId  => {
    const segmentation = lSegmentationsFromService.find(s => s.segmentationId === segmentationId);
    if (!segmentation) return;

    const oSegments = segmentation?.segments || {};

    Object.values(oSegments as Record<number, OhifSegmentInfo>).forEach((segment, arrayIndex) => {
      const segmentIndex = segment.segmentIndex;
      const quizSegmentMetadata = updateQuizSegmentMetadata(segment, arrayIndex);

      const ohifInfo: OhifSegmentInfo = {
        segmentIndex,
        label: segment.label,
        cachedStats: segment.cachedStats,
        quizSegmentMetadata
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

    // const serviceSegments = Object.values(
    //   (segmentation?.segments || {}) as Record<number, OhifSegmentInfo>
    // );
    const storeState = useSegmentMetadataStore.getState();
    const storeSegments = storeState.getAllSegments(segmentationId) || {};

    ////////////
    // for debug
    console.log('📊 before sync store keys:', Object.keys(storeSegments));
    console.log('📊 before sync service keys:', Object.keys(segmentation?.segments || {}));
    ////////////


    bDatabaseUpdateRequired = syncSegmentsInStore(
      segmentationId,
      segmentation,
      storeSegments,
    )


  });

  return bDatabaseUpdateRequired;
}

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
function syncSegmentsInStore(
  segmentationId: string,
  segmentationFromService: {
    segments: Record<number, OhifSegmentInfo>;
  } | null | undefined,
  storeSegments: Record<number, OhifSegmentInfo>
): boolean {

  let bDatabaseUpdateRequired = false;

  const storeSegmentIndices = Object.keys(storeSegments).map(Number);
  const serviceSegments = segmentationFromService?.segments || {};

  const serviceSegmentTriples = Object.entries(serviceSegments).map(
    ([segmentIndexStr, segment], arrayIndex) => ({
      segmentIndex: Number(segmentIndexStr),
      arrayIndex,
      segment,
    })
  );

  // 1. Check: every service segment exists in store, and cachedStats match
  serviceSegmentTriples.forEach(s => {
    const segmentFromStore = storeSegments[s.segmentIndex];

    const quizSegmentMetadata = updateQuizSegmentMetadata(s.segment, s.arrayIndex);
    const ohifInfo: OhifSegmentInfo = {
      segmentIndex: s.segmentIndex,
      label: s.segment.label,
      cachedStats: s.segment.cachedStats,
      quizSegmentMetadata: quizSegmentMetadata,
    };

  const needsUpdate =
    !segmentFromStore ||
    !cachedStatsEqual(s.segment.cachedStats?.namedStats, segmentFromStore.cachedStats?.namedStats);

    if (needsUpdate ) {
      useSegmentMetadataStore
        .getState()
        .setSegmentInfo(segmentationId, s.segmentIndex, ohifInfo);
      bDatabaseUpdateRequired = true;
      }
  });

  // 2. Check: every store segment exists in service - if stale - remove it
  const serviceIndexSet = new Set(serviceSegmentTriples.map(t => t.segmentIndex));

  for (const idx of storeSegmentIndices) {
    if (!serviceIndexSet.has(idx)) {
      useSegmentMetadataStore
            .getState()
            .removeSegmentInfo(segmentationId, idx);
          bDatabaseUpdateRequired = true;
        }
      }
  
  return bDatabaseUpdateRequired;
}


// // =====================================
// /**
//  * Function to pull information from the segmentation service and update the store.
//  *    Also update the service segments with updated quiz metadata.
//  * @param segmentationId 
//  * @param serviceSegments 
//  * @returns 
//  */
// const rebuildSegmentsFromService = (
//   segmentationId: string,
//   serviceSegments: OhifSegmentInfo[],
//   segmentationService: any
// ) => {
//   const store = useSegmentMetadataStore.getState();
//   store.clearAllSegmentInfo(segmentationId);

//   for (const [arrayIndex, segment] of serviceSegments.entries()) {
//     const updatedQuizMetadata = updateQuizSegmentMetadata(segment, arrayIndex);

//     const ohifInfo: OhifSegmentInfo = {
//       segmentIndex: segment.segmentIndex,
//       label: segment.label,
//       cachedStats: segment.cachedStats,
//       quizSegmentMetadata: updatedQuizMetadata,
//     };
//     // update the service and the store with the updated quiz metadata
//     segmentationService.addSegment(segmentationId, ohifInfo);
    
//     store.setSegmentInfo(segmentationId, segment.segmentIndex, ohifInfo);

//   }

//   const allSegs = segmentationService.getSegmentations();
//   console.log(' *** IN REBUILD ... segs:', allSegs);

//   return true;
// };


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
function updateQuizSegmentMetadata(
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

  const enrichedMeta: SegmentMetadata = {
    ...baseMeta,
    dicomSegMaskValue: arrayIndex + 1,
  };

  return {
    ...enrichedMeta,
    isComplete: computeSegmentDataIsComplete(enrichedMeta),
  };
}

// =====================================
function prepForPost(segmentation: any)  {
  
    const oSegments = segmentation?.segments || {};


      //////////////////////////////
      //////////////////////////////
      // for debug
        const segId = segmentation.segmentationId;
        const serviceKeys = Object.keys(segmentation?.segments || {});

        const storeState = useSegmentMetadataStore.getState();
        const storeSegments = storeState.getAllSegments(segId) || {};

        console.log('📊 in prepForPost-before update... store keys:', Object.keys(storeSegments), `segmentation ${segId}`);
        console.log('📊 in prepForPost-before update... service keys:', serviceKeys, `segmentation ${segId}`);

      //////////////////////////////
      //////////////////////////////
      
      Object.values(oSegments as Record<number, OhifSegmentInfo>).forEach((segment, arrayIndex) => {

      const segmentIndex = segment.segmentIndex;
      const quizSegmentMetadata = updateQuizSegmentMetadata(segment, arrayIndex);

      const ohifInfo: OhifSegmentInfo = {
        segmentIndex,
        label: segment.label,
        cachedStats: segment.cachedStats,
        quizSegmentMetadata
      };

      useSegmentMetadataStore.getState().setSegmentInfo(segmentation.segmentationId, segmentIndex, ohifInfo);

    });

      //////////////////////////////
      //////////////////////////////
      // for debug

        const storeState2 = useSegmentMetadataStore.getState();
        const storeSegments2 = storeState2.getAllSegments(segId) || {};

        console.log('📊 in prepForPost-after update... store keys:', Object.keys(storeSegments2), `segmentation ${segId}`);
        console.log('📊 in prepForPost-after update... service keys:', serviceKeys, `segmentation ${segId}`);

      //////////////////////////////
      //////////////////////////////

  };

// =====================================


type SegmentationServices = {
  segmentationService: any;
  displaySetService: any;
  viewportGridService: any;
  commandsManager: any;
};

type BuildSegmentFn = (segmentationId: string) => any; // e.g., buildSegmentListForPosting | buildAllSegmentsListForPosting

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

    // get pixel measures info for SEG metadata
    // Load the reference image

    const referencedDisplaySets = displaySetService.getDisplaySetsForSeries(seriesUid);
    const referencedDisplaySet = referencedDisplaySets?.[0];
    const image0 = referencedDisplaySet.images[0];

    // /////////// FOR DEBUG ////////////
    // const pixelSpacing = image0.PixelSpacing; // [row, col]
    // const sliceThickness = image0.SliceThickness;
    // const spacingBetweenSlices = image0.SpacingBetweenSlices ?? image0.SliceThickness ?? 1;
    // const iop = image0.ImageOrientationPatient;
    // const ipp = image0.ImagePositionPatient;

    // console.log(
    //     " *** PIXEL MEASURES:",
    //     "row:", pixelSpacing[0],
    //     "col:", pixelSpacing[1],
    //     "thickness:", sliceThickness,
    //     "spacing:", pixelSpacing,
    //     "spacingBetweenSlices:", spacingBetweenSlices,
    //     "IOP:", iop,
    //     "IPP:", ipp,
    //   );
    // /////////// END FOR DEBUG ////////////

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
    // make sure all indices from service are in line with the store
    prepForPost(seg);

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

    // Adding PixelMeasuresSequence so that the exported SEG file is compatible with
    //    other viewers (e.g. 3D Slicer)
    if (image0 && denaturalizedDataset["52009229"]?.Value?.[0]) {
      const sharedFG = denaturalizedDataset["52009229"].Value[0];

      // Ensure PixelMeasuresSequence and its first item exist
      if (!sharedFG["00289110"]) {
        sharedFG["00289110"] = { vr: "SQ", Value: [{}] };
      }
      if (!sharedFG["00289110"].Value[0]) {
        sharedFG["00289110"].Value[0] = {};
      }

      const pixelMeasuresItem = sharedFG["00289110"].Value[0];;

      // SliceThickness (0018,0050)
      pixelMeasuresItem["00180050"] = {
        vr: "DS",
        Value: [String(image0.SliceThickness || 1)],
      };

      // SpacingBetweenSlices (0018,0088)
      pixelMeasuresItem["00180088"] = {
        vr: "DS",
        Value: [
          String(image0.SpacingBetweenSlices ?? image0.SliceThickness ?? 1),
        ],
      };

      // PixelSpacing (0028,0030)
      pixelMeasuresItem["00280030"] = {
        vr: "DS",
        Value: [
          String(image0.PixelSpacing[0]),
          String(image0.PixelSpacing[1]),
        ],
      };
    }

    // create Blob for export using dicomDict to write the array buffer
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
    alert('⚠️ In generateSegmentationActivity - Segmentation ${seg.segmentationId} : generation failed; Press F12 to display console details.');

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



// =====================================
// =====================================

