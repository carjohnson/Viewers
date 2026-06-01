import { adaptersSEG } from '@cornerstonejs/adapters';
import { imageLoader } from '@cornerstonejs/core';
import { metaData, Types } from '@cornerstonejs/core';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { OhifSegmentInfo, SegmentationData, SegmentMetadata, DEFAULT_SEGMENT_METADATA } from './../models/SegmentationData';
import {
  ImplementationClassUID,
  ImplementationVersionName,
  EXPLICIT_VR_LITTLE_ENDIAN,
} from '../init';
import dcmjs from 'dcmjs';
import { postSegmentations } from '../handlers/postSegmentations';
import { SegmentationRepresentations } from '@cornerstonejs/tools/enums';
import { segmentation, Enums as ToolEnums } from '@cornerstonejs/tools';
import { createSegDisplaySetFromArrayBuffer, parseSegArrayBuffer } from './dicomSegUtils';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';



// for creating the blob when saving a segment
const { DicomMetaDictionary, DicomDict } = dcmjs.data;



// =====================================
// export async function loadDicomSegIntoOHIF({
// //   dicomSegSeriesUID,
//   segmentationId,
//   referencedSeriesInstanceUID,
//   segmentationLabel,
//   segmentMetadata,
//   arrayBuffer,
//   servicesManager,
//   activeViewportId,
// }) {

//   // ~~~~~~~~~~
//   const {
//         segmentationService,
//         displaySetService,
//         viewportGridService,
//   } = servicesManager.services;

//   // ~~~~~~~~~~
//   // get referenced display sets and image ids
//   const referencedDisplaySets =
//     displaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
//   const referencedDisplaySet = referencedDisplaySets?.[0];

//   if (!referencedDisplaySet) {
//     // console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
//     console.warn('No referenced displaySet for SEG', segmentationId);
//     return;
//   }

//   const imageIds = referencedDisplaySet.images?.map(i => i.imageId) ?? [];
//   if (!imageIds.length) {
//     console.warn('No imageIds found for referenced displaySet', referencedSeriesInstanceUID);
//     return;
//   }

//   // ~~~~~~~~~~
//   // generate the tool state - and get the segmentation labelmap buffer
//   const segToolState =
//     await adaptersSEG.Cornerstone3D.Segmentation.generateToolState(
//       imageIds,
//       arrayBuffer,
//       metaData
//     );
//     // console.log('segToolState:', segToolState);
//     // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);
//     const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);

//     // ~~~~~~~~~~
//     // ensure the referenced displayset is being displayed in the viewport
//     const currentDisplaySets = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);
//     const isReferencedSeriesActive = currentDisplaySets.includes(referencedDisplaySet.displaySetInstanceUID);

//     if (!isReferencedSeriesActive) {
//         // Switch the viewport to the correct series
//         await viewportGridService.setDisplaySetsForViewport({
//             viewportId: activeViewportId,
//             displaySetInstanceUIDs: [referencedDisplaySet.displaySetInstanceUID],
//         });
        
//         // Give the viewer a moment to switch display sets
//         await new Promise(resolve => setTimeout(resolve, 100));
//     }

//     //////////////////////// ORIGINAL ///////////////////////////////
//     //////////////////////// ORIGINAL ///////////////////////////////
//     // ~~~~~~~~~~
//     // create one empty labelmap segmentation - this automatically creates one segment
//     await segmentationService.createLabelmapForDisplaySet(
//         referencedDisplaySet,
//         {
//         segmentationId: segmentationId,
//         label: segmentationLabel,
//         },
//     );
//     // console.log(' *** IN LOAD DICOM SEG INTO OHIF ... segmentMetadata', segmentMetadata);

//     segmentMetadata.forEach(s => {
//       const isComplete = computeSegmentDataIsComplete(s)
   

//       const ohifInfo: OhifSegmentInfo = {
//       segmentIndex: s.segmentMaskValue,   // matches backend schema on load
//       label: s.label,
//       cachedStats: s.cachedStats,
//       quizSegmentMetadata: {
//         groundTruth: s.groundTruth,
//         referenceStandardMethod: s.referenceStandardMethod,
//         hepaticSegment: s.hepaticSegment,
//         isComplete: isComplete,
//         dicomSegMaskValue: s.segmentMaskValue,
//       }
//     };

//     segmentationService.addSegment(segmentationId, ohifInfo);
//       console.log(' *** IN LOAD DICOM SEG INTO OHIF ... each segment', s, ohifInfo);

//     useSegmentMetadataStore
//       .getState()
//       .setSegmentInfo(
//         segmentationId,
//         s.segmentMaskValue, //1-based - match to backend on load
//         ohifInfo,
//       );
//     })
//     ////////////////////////       END         ///////////////////////////////
//     //////////////////////////////////////////////////////////////////////////


//     // //////////////////////// WITH NO QUIZMETADATA ///////////////////////////////
//     // ////////////////////////     TWO PASSES       ///////////////////////////////
//     // const segments = Object.fromEntries(
//     //   segmentMetadata.map(s => [
//     //     s.segmentMaskValue,
//     //     {
//     //       label: s.label,
//     //       active: s.segmentMaskValue === 1,
//     //       visibility: true,
//     //     },
//     //   ])
//     // );

//     // await segmentationService.createLabelmapForDisplaySet(referencedDisplaySet, {
//     //   segmentationId,
//     //   label: segmentationLabel,
//     //   segments,
//     // });

//     // segmentMetadata.forEach(s => {
//     //   const isComplete = computeSegmentDataIsComplete(s);

//     //   const ohifInfo: OhifSegmentInfo = {
//     //     segmentIndex: s.segmentMaskValue,
//     //     label: s.label,
//     //     cachedStats: s.cachedStats,
//     //     quizSegmentMetadata: {
//     //       groundTruth: s.groundTruth,
//     //       referenceStandardMethod: s.referenceStandardMethod,
//     //       hepaticSegment: s.hepaticSegment,
//     //       isComplete,
//     //       dicomSegMaskValue: s.segmentMaskValue,
//     //     },
//     //   };

//     //   useSegmentMetadataStore
//     //     .getState()
//     //     .setSegmentInfo(segmentationId, s.segmentMaskValue, ohifInfo);
//     // });
//     // ////////////////////////       END         ///////////////////////////////
//     // //////////////////////////////////////////////////////////////////////////


//     // //////////////////////// WITH NO QUIZMETADATA ///////////////////////////////
//     // ////////////////////////      ONE PASS        ///////////////////////////////
//     // const segments: Record<number, Partial<Segment>> = {};

//     // segmentMetadata.forEach(s => {
//     //   const isComplete = computeSegmentDataIsComplete(s);

//     //   segments[s.segmentMaskValue] = {
//     //     label: s.label,
//     //     active: s.segmentMaskValue === 1,
//     //     cachedStats: s.cachedStats,
//     //     visibility: true,
//     //     locked: false,
//     //   };

//     //   // add segment with quiz metadata into the store
//     //   const ohifInfo: OhifSegmentInfo = {
//     //     segmentIndex: s.segmentMaskValue,
//     //     label: s.label,
//     //     cachedStats: s.cachedStats,
//     //     quizSegmentMetadata: {
//     //       groundTruth: s.groundTruth,
//     //       referenceStandardMethod: s.referenceStandardMethod,
//     //       hepaticSegment: s.hepaticSegment,
//     //       isComplete,
//     //       dicomSegMaskValue: s.segmentMaskValue,
//     //     },
//     //   };

//     //   useSegmentMetadataStore
//     //     .getState()
//     //     .setSegmentInfo(segmentationId, s.segmentMaskValue, ohifInfo);
//     // });

//     // await segmentationService.createLabelmapForDisplaySet(referencedDisplaySet, {
//     //   segmentationId,
//     //   label: segmentationLabel,
//     //   segments,
//     // });
  

//     // const justLoadedSegments = segmentationService.getSegmentation(segmentationId).segments;
//     // console.log(' *** IN LOAD - Just created', justLoadedSegments);

//     // ////////////////////////       END         ///////////////////////////////
//     // //////////////////////////////////////////////////////////////////////////


//     // // for debug
//     // const startingSeg = segmentationService.getSegmentation(segmentationId);
//     // console.log(' *** STARTING SEG', startingSeg);
//     // console.log('segToolState:', segToolState);
//     // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);

//     const cachedStore = useSegmentMetadataStore.getState().getAllSegments(segmentationId);
//     console.log('🔥 CACHED:', segmentationId, cachedStore);

//     // ~~~~~~~~~~
//     // get labelmap ids and split the buffer into per Slice arrays
//     const segmentationData = segmentationService.getSegmentation(segmentationId) as SegmentationData;
//     console.log(' *** IN LOAD DICOM SEG INTO OHIF ... segmentationData:', segmentationData);

//     const labelmapRep = segmentationData.representationData.Labelmap;
//     const labelmapImageIds = labelmapRep.imageIds; //derived images from representation data

//     const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;
//     const labelmapBufferArray: Uint8Array[] = [];
//     for (let i = 0; i < labelmapImageIds.length; i++) {
//     const sliceStart = i * bytesPerSlice;
//     const sliceEnd = sliceStart + bytesPerSlice;
//     labelmapBufferArray.push(segLabelmap.subarray(sliceStart, sliceEnd));
//     }

//     bufferCounter(labelmapBufferArray, '*** LabelmapBufferArray - AFTER load subarrays');   // for debug

//     // ~~~~~~~~~~
//     // load each labelmap image and replace its scalar data
//     const labelmapImages = await Promise.all(
//         labelmapImageIds.map(id => imageLoader.loadAndCacheImage(id))
//     );
//     labelmapBufferArray.forEach((buffer, i) => {
//         labelmapImages[i].getPixelData().set(buffer);
//     });


//     // ~~~~~~~~~~
//     // Add to active viewport(s)
//     const updatedSeg = segmentationService.getSegmentation(segmentationId);
//     console.log(' *** UPDATED SEG', updatedSeg);
//     const viewportId = viewportGridService.getActiveViewportId();
//     await segmentationService.addSegmentationRepresentation(viewportId, updatedSeg);

//     console.log('🎉 Loaded SEG:', segmentationId);

// }



////////////////////// TRY WITH VOLUME - BUT OHIF IS NOW Stack-Based /////////////
// =====================================
// export async function loadDicomSegIntoOHIF({
// //   dicomSegSeriesUID,
//   segmentationId,
//   referencedSeriesInstanceUID,
//   segmentationLabel,
//   segmentMetadata,
//   arrayBuffer,
//   servicesManager,
//   activeViewportId,
// }) {

//   // ~~~~~~~~~~
//   const {
//         segmentationService,
//         displaySetService,
//         viewportGridService,
//   } = servicesManager.services;

//   // ~~~~~~~~~~
//   // get referenced display sets and image ids
//   const referencedDisplaySets =
//     displaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
//   const referencedDisplaySet = referencedDisplaySets?.[0];

//   if (!referencedDisplaySet) {
//     // console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
//     console.warn('No referenced displaySet for SEG', segmentationId);
//     return;
//   }

//   const imageIds = referencedDisplaySet.images?.map(i => i.imageId) ?? [];
//   if (!imageIds.length) {
//     console.warn('No imageIds found for referenced displaySet', referencedSeriesInstanceUID);
//     return;
//   }

//   // ~~~~~~~~~~
//   // generate the tool state - and get the segmentation labelmap buffer
//   const segToolState =
//     await adaptersSEG.Cornerstone3D.Segmentation.generateToolState(
//       imageIds,
//       arrayBuffer,
//       metaData
//     );
//     // console.log('segToolState:', segToolState);
//     // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);
//     const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);

//     // ~~~~~~~~~~
//     // ensure the referenced displayset is being displayed in the viewport
//     const currentDisplaySets = viewportGridService.getDisplaySetsUIDsForViewport(activeViewportId);
//     const isReferencedSeriesActive = currentDisplaySets.includes(referencedDisplaySet.displaySetInstanceUID);

//     if (!isReferencedSeriesActive) {
//         // Switch the viewport to the correct series
//         await viewportGridService.setDisplaySetsForViewport({
//             viewportId: activeViewportId,
//             displaySetInstanceUIDs: [referencedDisplaySet.displaySetInstanceUID],
//         });
        
//         // Give the viewer a moment to switch display sets
//         await new Promise(resolve => setTimeout(resolve, 100));
//     }


//     //////////////////////// WITH NO QUIZMETADATA ///////////////////////////////
//     ////////////////////////      ONE PASS        ///////////////////////////////
//     const segments: Record<number, Partial<Segment>> = {};

//     segmentMetadata.forEach(s => {
//       const isComplete = computeSegmentDataIsComplete(s);

//       segments[s.segmentMaskValue] = {
//         label: s.label,
//         active: s.segmentMaskValue === 1,
//         cachedStats: s.cachedStats,
//         visibility: true,
//         locked: false,
//       };

//       // add segment with quiz metadata into the store
//       const ohifInfo: OhifSegmentInfo = {
//         segmentIndex: s.segmentMaskValue,
//         label: s.label,
//         cachedStats: s.cachedStats,
//         quizSegmentMetadata: {
//           groundTruth: s.groundTruth,
//           referenceStandardMethod: s.referenceStandardMethod,
//           hepaticSegment: s.hepaticSegment,
//           isComplete,
//           dicomSegMaskValue: s.segmentMaskValue,
//         },
//       };

//       useSegmentMetadataStore
//         .getState()
//         .setSegmentInfo(segmentationId, s.segmentMaskValue, ohifInfo);
//     });

//     await segmentationService.createLabelmapForDisplaySet(referencedDisplaySet, {
//       segmentationId,
//       label: segmentationLabel,
//       segments,
//     });
  

//     const justLoadedSegments = segmentationService.getSegmentation(segmentationId).segments;
//     console.log(' *** IN LOAD - Just created', justLoadedSegments);

//     ////////////////////////       END         ///////////////////////////////
//     //////////////////////////////////////////////////////////////////////////


//     // // for debug
//     // const startingSeg = segmentationService.getSegmentation(segmentationId);
//     // console.log(' *** STARTING SEG', startingSeg);
//     // console.log('segToolState:', segToolState);
//     // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);

//     const cachedStore = useSegmentMetadataStore.getState().getAllSegments(segmentationId);
//     console.log('🔥 CACHED:', segmentationId, cachedStore);

// // 3. Add segmentation representation to viewport (CORRECT API)
//       // const segmentation = segmentationService.getSegmentation(segmentationId);

// await segmentation.addSegmentationRepresentations(activeViewportId, [
//   {
//     segmentationId,
//     type: ToolEnums.SegmentationRepresentations.Labelmap,
//   },
// ]);

// // 2. Get the labelmap volume and update scalar data (your fetched pixel data)
// const volume = segmentationService.getLabelmapVolume(segmentationId);
// console.log('🔥 Volume:', volume);  // Should NOT be null now

// if (!volume) {
//   console.error('Volume is still null after adding representation!');
//   return;
// }

// const { voxelManager } = volume;
// const scalarData = voxelManager?.getCompleteScalarDataArray();

// console.log(' *** scalarData length:', scalarData.length);
// console.log(' *** segLabelmap length:', segLabelmap.length);
// console.log(' *** Match?', scalarData.length === segLabelmap.length);

// if (scalarData && segLabelmap) {
//   scalarData.set(segLabelmap);
//   voxelManager?.setCompleteScalarDataArray(scalarData);
// }

// // 4. Render the viewport
//       const renderingEngine =
//         viewportGridService.getRenderingEngine() as Types.IRenderingEngine;
        
// // const viewport = renderingEngine.getViewport(activeViewportId);
// // await viewport.render();
//   renderingEngine.renderViewports([activeViewportId]);


//   }

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
        viewportGridService,
  } = servicesManager.services;


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

  const DEFAULT_COLORS: [number, number, number, number][] = [
  [255, 0, 0, 255],
  [0, 255, 0, 255],
  [0, 0, 255, 255],
  [255, 255, 0, 255],
  [255, 0, 255, 255],
  [0, 255, 255, 255],
];


    // create segments and update SegmentMetadataStore
    const segments: Record<number, Partial<Segment>> = {};

    segmentMetadata.forEach((s, idx) => {
      const isComplete = computeSegmentDataIsComplete(s);
      const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

      segments[s.segmentMaskValue] = {
        label: s.label,
        active: s.segmentMaskValue === 1,
        color,
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
// console.log('segImageId:', segImageId);
// console.log('fileManager keys:', Object.keys(dicomImageLoader.wadouri.fileManager.cache || {}));
// const image = await dicomImageLoader.wadouri.loadImage(segImageId);
// // console.log('Image loaded:', image?.imageId);



// analyzeSegmentationBuffer(arrayBuffer);
// bufferCounterForSEG1Bit(arrayBuffer);
analyzeSegmentationBuffer(arrayBuffer);
analyzeSEGSegmentMapping(arrayBuffer);
extractSegmentMasksFromSEG(arrayBuffer);
countSegmentVoxels(arrayBuffer);


// Build segDisplaySet from arrayBuffer (OHIF-specific)
const segDisplaySet = await createSegDisplaySetFromArrayBuffer(
  arrayBuffer,
  segmentationId,
  referencedDisplaySetInstanceUID,
  referencedImageIds,
  segImageId,
  segments,
);

console.log (' *** segDisplaySet:', segDisplaySet);


// const segmentationIdCreated = await segmentationService.createSegmentationForSEGDisplaySet(
//   segDisplaySet,
//   {
//     segmentationId,
//     label: segmentationLabel,
//     segments: segmentMetadata,
//     type: ToolEnums.SegmentationRepresentations.Labelmap,
//   }
// );

const createdSegmentationId =
  await segmentationService.createSegmentationForSEGDisplaySet(segDisplaySet, {
    segmentationId,
    type: ToolEnums.SegmentationRepresentations.Labelmap,
  });

// ////////////////////////// Creates EMPTY Segmentation \\\\\\\\\\\\\\\\\\\\\\\\\\
// ////////////////////////// WORKS! 3 empty segments 
// const createdSegmentationId = await segmentationService.createLabelmapForDisplaySet(
//   segDisplaySet,
//   {
//     segmentationId,
//     label: segmentationLabel,
//     segments,
//     type: ToolEnums.SegmentationRepresentations.Labelmap,
//   }
// );

await segmentation.addSegmentationRepresentations(activeViewportId, [
  {
    segmentationId: createdSegmentationId,
    type: ToolEnums.SegmentationRepresentations.Labelmap,
  },
]);
   console.log('Created segmentation:', createdSegmentationId);

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
    alert('⚠️ SaveSegmentation failed - nothing posted to db; Press F12 to display console details.');
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

  // //////////////////////////////
  // //////////////////////////////
  // // for debug
  // Object.values(allSegmentations).forEach(segmentation => {
  //   const segId = segmentation.segmentationId;
  //   const serviceKeys = Object.keys(segmentation?.segments || {});

  //   const storeState = useSegmentMetadataStore.getState();
  //   const storeSegments = storeState.getAllSegments(segId) || {};

  //   console.log('📊 in SaveAll store keys:', Object.keys(storeSegments), `segmentation ${segId}`);
  //   console.log('📊 in SaveAll service keys:', serviceKeys, `segmentation ${segId}`);

  // });
  // //////////////////////////////
  // //////////////////////////////


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
    alert('⚠️ saveAllSegmentations failed - nothing posted to db; Press F12 to display console details.');
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
      const quizSegmentMetadata = buildQuizSegmentMetadata(segment, arrayIndex);

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

    ////////////
    // for debug
    console.log('📊 after sync store keys:', Object.keys(storeSegments));
    console.log('📊 after sync service keys:', Object.keys(segmentation?.segments || {}));
    ////////////


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

    const quizSegmentMetadata = buildQuizSegmentMetadata(s.segment, s.arrayIndex);
    const ohifInfo: OhifSegmentInfo = {
      segmentIndex: s.segmentIndex,
      label: s.segment.label,
      cachedStats: s.segment.cachedStats,
      quizSegmentMetadata: quizSegmentMetadata,
    };

  const needsUpdate =
    !segmentFromStore ||
    !cachedStatsEqual(s.segment.cachedStats, segmentFromStore.cachedStats);

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
//     const updatedQuizMetadata = buildQuizSegmentMetadata(segment, arrayIndex);

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
function buildQuizSegmentMetadata(
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
    alert('⚠️ Segmentation ${seg.segmentationId} : generation failed; Press F12 to display console details.');

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


/**
 * Updated bufferCounter for 1-bit binary DICOM SEG
 */
function bufferCounterForSEG1Bit(arrayBuffer) {
  const valueStats = new Map();
  let nonZeroCount = 0;
  
  // Convert ArrayBuffer to Uint8Array
  const byteData = new Uint8Array(arrayBuffer);
  
  console.log('Byte data length:', byteData.length);
  console.log('First 10 bytes:', byteData.slice(0, 10));
  
  // For 1-bit data, each byte contains 8 voxels
  // Bits are typically stored MSB first (bit 7 = first pixel)
  for (let byteIdx = 0; byteIdx < byteData.length; byteIdx++) {
    const byte = byteData[byteIdx];
    
    // Extract each of the 8 bits
    for (let bit = 0; bit < 8; bit++) {
      // Check if this bit is set (MSB first)
      const bitValue = (byte >> (7 - bit)) & 1;
      
      if (bitValue !== 0) {
        nonZeroCount++;
        
        if (!valueStats.has(1)) {
          valueStats.set(1, {
            count: 1,
            firstByte: byteIdx,
            firstBit: bit,
          });
        } else {
          valueStats.get(1).count++;
        }
      }
    }
  }
  
  // Debug output
  console.log('***** DEBUG 1-BIT DICOM SEG Pixel Data *****');
  console.log('Total bytes:', byteData.length);
  console.log('Non-zero voxels (pixels with value=1):', nonZeroCount);
  console.log('Unique non-zero values:', [...valueStats.keys()]);
  
  for (const [value, stats] of valueStats.entries()) {
    console.log(
      `Value ${value}: count=${stats.count}, firstByte=${stats.firstByte}, firstBit=${stats.firstBit}`
    );
  }
  
  return valueStats;
}
/**
 * Extract pixel data from DICOM SEG ArrayBuffer and count segment values
 */
function extractPixelDataFromSEG(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dicomData = dcmjs.data.DicomMessage.readFile(uint8Array);
  const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
  
  // Extract pixel data
  const pixelData = dataset.PixelData;
  
  if (!pixelData) {
    throw new Error('No PixelData in DICOM SEG');
  }
  
  // PixelData can be a Buffer or array
  let pixelArray;
  if (pixelData instanceof Buffer) {
    pixelArray = new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
  } else if (Array.isArray(pixelData)) {
    pixelArray = new Uint8Array(pixelData);
  } else {
    pixelArray = new Uint8Array(pixelData.buffer);
  }
  
  // Get number of frames
  const numberOfFrames = dataset.NumberOfFrames || 1;
  const rows = dataset.Rows;
  const columns = dataset.Columns;
  const bitsAllocated = dataset.BitsAllocated || 8;
  
  // Determine if 8-bit or 16-bit
  const is16Bit = bitsAllocated === 16;
  const bytesPerFrame = rows * columns * (is16Bit ? 2 : 1);
  
  console.log('SEG info:', {
    numberOfFrames,
    rows,
    columns,
    bitsAllocated,
    bytesPerFrame,
    totalPixelDataLength: pixelArray.length,
  });
  
  return {
    pixelArray,
    numberOfFrames,
    rows,
    columns,
    is16Bit,
  };
}

/**
 * Updated bufferCounter for DICOM SEG pixel data
 */
function bufferCounterForSEG(pixelData, numberOfFrames, rows, columns, is16Bit) {
  const valueStats = new Map();
  let nonZeroCount = 0;
  
  const bytesPerPixel = is16Bit ? 2 : 1;
  const pixelsPerFrame = rows * columns;
  
  for (let frame = 0; frame < numberOfFrames; frame++) {
    const frameOffset = frame * pixelsPerFrame;
    
    for (let pixel = 0; pixel < pixelsPerFrame; pixel++) {
      const offset = frameOffset + pixel;
      const value = is16Bit 
        ? pixelData[offset * 2] | (pixelData[offset * 2 + 1] << 8)
        : pixelData[offset];
      
      if (value !== 0) {
        nonZeroCount++;
        
        if (!valueStats.has(value)) {
          valueStats.set(value, {
            count: 1,
            firstSlice: frame,
            firstIndex: pixel,
          });
        } else {
          valueStats.get(value).count++;
        }
      }
    }
  }
  
  // Debug output
  console.log('***** DEBUG DICOM SEG Pixel Data *****');
  console.log('Non-zero voxels:', nonZeroCount);
  console.log('Unique non-zero values:', [...valueStats.keys()]);
  
  for (const [value, stats] of valueStats.entries()) {
    console.log(
      `Value ${value}: count=${stats.count}, firstSlice=${stats.firstSlice}, firstIndex=${stats.firstIndex}`
    );
  }
  
  return valueStats;
}

/**
 * Combined helper: extract and count from DICOM SEG ArrayBuffer
 */
function analyzeSegmentationBuffer(arrayBuffer) {
  const { pixelArray, numberOfFrames, rows, columns, is16Bit } = extractPixelDataFromSEG(arrayBuffer);
  return bufferCounterForSEG(pixelArray, numberOfFrames, rows, columns, is16Bit);
}

function analyzeSEGSegmentMapping(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dicomData = dcmjs.data.DicomMessage.readFile(uint8Array);
  const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
  
  console.log('===== SEG SEGMENT INFORMATION =====');
  
  // Check SegmentSequence
  if (dataset.SegmentSequence) {
    console.log('Number of segments:', dataset.SegmentSequence.length);
    dataset.SegmentSequence.forEach((seg, idx) => {
      console.log(`Segment ${idx + 1}:`, {
        segmentNumber: seg.SegmentNumber,
        segmentLabel: seg.SegmentLabel,
        segmentAlgorithmType: seg.SegmentAlgorithmType,
        // segmentedPropertyCategory: seg roi?.SegmentedPropertyCategoryCodeSequence?.[0]?.CodingValue,
      });
    });
  }
  
  // Check PerFrameFunctionalGroupsSequence for frame-to-segment mapping
  if (dataset.PerFrameFunctionalGroupsSequence) {
    const frames = dataset.PerFrameFunctionalGroupsSequence;
    console.log('\nNumber of frames:', frames.length);
    
    frames.forEach((frame, idx) => {
      const segmentationRef = frame.FrameContentSequence?.[0];
      const segmentRef = frame.PerFrameFunctionalGroupsSequence?.[0]?.SegmentIdentificationSequence?.[0];
      
      console.log(`Frame ${idx}:`, {
        referencedSegmentNumber: segmentRef?.ReferencedSegmentNumber,
        presetSegmentNumber: segmentationRef?.PresetSegmentNumber,
      });
    });
  }
  
  // Check NumberOfFrames
  console.log('\nNumberOfFrames:', dataset.NumberOfFrames);
  console.log('BitsAllocated:', dataset.BitsAllocated);
  console.log('Rows:', dataset.Rows);
  console.log('Columns:', dataset.Columns);
  
  // Extract pixel data per frame
  const numberOfFrames = dataset.NumberOfFrames || 1;
  const rows = dataset.Rows;
  const columns = dataset.Columns;
  const bytesPerFrame = Math.ceil((rows * columns) / 8); // 1-bit packed
  
  console.log('\nBytes per frame:', bytesPerFrame);
  console.log('Total pixel data bytes:', numberOfFrames * bytesPerFrame);
  
  const pixelData = new Uint8Array(arrayBuffer);
  
  // Analyze each frame separately
  console.log('\n===== PER-FRAME ANALYSIS =====');
  for (let frame = 0; frame < numberOfFrames; frame++) {
    const frameOffset = frame * bytesPerFrame;
    const frameBytes = pixelData.slice(frameOffset, frameOffset + bytesPerFrame);
    
    let nonZeroCount = 0;
    for (let byteIdx = 0; byteIdx < frameBytes.length; byteIdx++) {
      const byte = frameBytes[byteIdx];
      for (let bit = 0; bit < 8; bit++) {
        const value = (byte >> (7 - bit)) & 1;
        if (value !== 0) nonZeroCount++;
      }
    }
    
    console.log(`Frame ${frame}: ${nonZeroCount} non-zero voxels`);
  }
}
// =====================================
/**
 * Extract per-frame binary masks from DICOM SEG and map to segments
 */
function extractSegmentMasksFromSEG(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const dicomData = dcmjs.data.DicomMessage.readFile(uint8Array);
  const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
  
  const numberOfFrames = dataset.NumberOfFrames || 1;
  const rows = dataset.Rows;
  const columns = dataset.Columns;
  const bytesPerFrame = Math.ceil((rows * columns) / 8); // 1-bit packed
  
  const pixelData = new Uint8Array(arrayBuffer);
  const segmentSequence = dataset.SegmentSequence || [];
  
  // Extract each frame as unpacked binary mask
  const frameMasks = [];
  
  for (let frame = 0; frame < numberOfFrames; frame++) {
    const frameOffset = frame * bytesPerFrame;
    const frameBytes = pixelData.slice(frameOffset, frameOffset + bytesPerFrame);
    
    // Unpack 1-bit data to Uint8Array (0 or 1 per voxel)
    const unpackedMask = new Uint8Array(rows * columns);
    
    for (let byteIdx = 0; byteIdx < frameBytes.length; byteIdx++) {
      const byte = frameBytes[byteIdx];
      const basePixel = byteIdx * 8;
      
      for (let bit = 0; bit < 8 && (basePixel + bit) < unpackedMask.length; bit++) {
        const value = (byte >> (7 - bit)) & 1;
        unpackedMask[basePixel + bit] = value;
      }
    }
    
    frameMasks.push(unpackedMask);
  }
  
  // Map frames to segments (assuming sequential mapping: Frame 0 → Segment 1, etc.)
  const segmentMasks = {};
  
  segmentSequence.forEach((seg, frameIdx) => {
    if (frameIdx < frameMasks.length) {
      const segmentNumber = seg.SegmentNumber;
      const segmentLabel = seg.SegmentLabel;
      
      // Count non-zero voxels for this segment
      let voxelCount = 0;
      for (let i = 0; i < frameMasks[frameIdx].length; i++) {
        if (frameMasks[frameIdx][i] !== 0) voxelCount++;
      }
      
      segmentMasks[segmentNumber] = {
        label: segmentLabel,
        mask: frameMasks[frameIdx],
        voxelCount,
        frameIndex: frameIdx,
      };
      
      console.log(`Segment ${segmentNumber} (${segmentLabel}): ${voxelCount} voxels from Frame ${frameIdx}`);
    }
  });
  
  return segmentMasks;
}


/**
 * Count voxels per segment with proper frame mapping
 */
function countSegmentVoxels(arrayBuffer) {
  const segmentMasks = extractSegmentMasksFromSEG(arrayBuffer);
  
  const valueStats = new Map();
  
  Object.entries(segmentMasks).forEach(([segmentNumber, segData]) => {
    valueStats.set(parseInt(segmentNumber), {
      count: segData.voxelCount,
      label: segData.label,
      frameIndex: segData.frameIndex,
    });
  });
  
  console.log('===== FINAL SEGMENT VOXEL COUNTS =====');
  for (const [value, stats] of valueStats.entries()) {
    console.log(`Segment ${value} (${stats.label}): ${stats.count} voxels`);
  }
  
  return valueStats;
}
// =====================================
// =====================================

