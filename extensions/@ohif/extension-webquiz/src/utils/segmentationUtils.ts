import { adaptersSEG } from '@cornerstonejs/adapters';
import { metaData, volumeLoader, cache } from '@cornerstonejs/core';
import { segmentation } from '@cornerstonejs/tools';
import * as cornerstone from "@cornerstonejs/core";
import { utilities } from '@cornerstonejs/core';



export async function loadDicomSegIntoOHIF({
  dicomSegSeriesUID,
  referencedSeriesInstanceUID,
  arrayBuffer,
  servicesManager,
}) {
  const {
    SegmentationService,
    DisplaySetService,
    ViewportGridService,
  } = servicesManager.services;

    console.log('DisplaySetService methods:', Object.keys(DisplaySetService));
    console.log('SegmentationService methods:', Object.keys(SegmentationService));

  const referencedDisplaySets =
    DisplaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
  const referencedDisplaySet = referencedDisplaySets?.[0];

  if (!referencedDisplaySet) {
    console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
    return;
  }

  // TODO: For Multi-series studies ===> ??
  // Optionally ensure that referencedDisplaySet is in a viewport (set layout / setActiveDisplaySet)
  // so that imageIds/volumeId are available.

  // 3) Use the SEG adapter to generate tool state from the ArrayBuffer.
  const imageIds = referencedDisplaySet.images?.map(i => i.imageId) ?? [];
  if (!imageIds.length) {
    console.warn('No imageIds found for referenced displaySet', referencedSeriesInstanceUID);
    return;
  }

  const segToolState =
    await adaptersSEG.Cornerstone3D.Segmentation.generateToolState(
      imageIds,
      arrayBuffer,
      metaData
    );
    console.log('segToolState:', segToolState);
    console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);

    // create one empty labelmap segmentation (returns segmentationId)
    const segmentationId = await SegmentationService.createLabelmapForDisplaySet(
        referencedDisplaySet,  // ← Pass the displaySet object directly
        {
        label: `SEG ${dicomSegSeriesUID.slice(-8)}`,
        }
    );
    //  Wait for Cornerstone state to catch up (critical!) ?? IS THIS NECESSARY ??
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms debounce


///////////////////////////// Got the segLabelMap loaded ok 
///////////////////////////// Now to load into the segmentation created

// 1. Create empty segmentation
const segmentationData = SegmentationService.getSegmentation(segmentationId);
console.log(' ***** segmentationData:', segmentationData);  // needs a touch or labelmapRep is undefined


// 2. Create segLabelmap from ArrayBuffer stored in the segToolState
const labelmapRep = segmentationData.representationData.Labelmap;
const labelmapImageIds = labelmapRep.imageIds; // derived images
console.log(' ***** labelmapRep:', labelmapRep);

const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);
const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;

for (let i = 0; i < labelmapImageIds.length; i++) {
  const sliceStart = i * bytesPerSlice;
  const sliceEnd = sliceStart + bytesPerSlice;

  const sliceData = segLabelmap.subarray(sliceStart, sliceEnd);

  // Do whatever processing you need on sliceData
  // e.g., modify values, threshold, etc.
}

// 3. Inject your segLabelmap buffer by creating the .data object
labelmapRep.data = {
  // Your SEG voxel buffer goes here
  labelmapBufferArray: [new Uint8Array(segLabelmap)],

  // Required fields
  activeSegmentIndex: 1,
  segmentsOnLabelmap: [1], // or more if you have multiple segments
};

// 4. (Optional) Add segment metadata
SegmentationService.addSegment(segmentationId, {
  segmentIndex: 1,
  label: "Imported Segment",
  color: [255, 0, 0],
});

// 5. Notify Cornerstone that the segmentation changed
SegmentationService.addOrUpdateSegmentation(segmentationData);

console.log(' ***** UPDATED SEG OBJECT:', segmentationData);

// // add to the viewport
// const viewportId = ViewportGridService.getActiveViewportId();

// // Add a labelmap representation for this segmentation on this viewport
// await SegmentationService.addSegmentationRepresentationToViewport(viewportId, {
//   segmentationId,
//   type: 'labelmap',
// });

// // Make it the active segmentation representation
// SegmentationService.setActiveSegmentationRepresentation(viewportId, {
//   segmentationId,
//   type: 'labelmap',
// });



///////////////////////////////////////////////////////////////////////

//   // 5) Register segmentation in the SegmentationService and attach to tool groups.[web:30][web:32][web:33]
//   await SegmentationService.createLabelmapForDisplaySet(referencedDisplaySet, {
//     segmentationId,
//     label: `SEG ${dicomSegSeriesUID}`,
//     // Optionally: segments config
//   });

//   // Add representation to whatever toolGroup(s) your mode uses
//   const { toolGroupService } = servicesManager.services;
//   const toolGroupIds = toolGroupService.getToolGroupIds();
//   for (const toolGroupId of toolGroupIds) {
//     await SegmentationService.addSegmentationRepresentationToToolGroup(
//       toolGroupId,
//       segmentationId
//     );
//   }

  console.log('🎉 Loaded SEG:', dicomSegSeriesUID);
}


///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
/////////////////////////// Progression ///////////////////////////////
///////////////////////////////////////////////////////////////////////

//////////////// CODE FOR VOLUMEID --- DOESN'T WORK --- NOT A VOLUME LABELMAP
// const segmentationData = SegmentationService.getSegmentation(segmentationId);
// const labelmapVolumeId = segmentationData?.representationData?.Labelmap?.data?.volumeId;

// if (!labelmapVolumeId) {
//   console.warn('No labelmap volume created for:', segmentationId);
//   return;
// }

// // Get the volume from Cornerstone cache

// const labelmapVolume = cache.getVolume(labelmapVolumeId);

// // Copy your SEG data (first buffer) into the labelmap volume
// const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);
// const voxelManager = labelmapVolume.voxelManager;

// // Try bulk copy first (fastest)
// try {
//   // Direct bulk set (if available)
//   if (voxelManager.setCompleteScalarDataArray) {
//     voxelManager.setCompleteScalarDataArray(segLabelmap);
//   } else {
//     // Get scalar data as proper TypedArray, then copy
//     const scalarData = voxelManager.getCompleteScalarDataArray();
//     if (scalarData && typeof scalarData.set === 'function') {
//       // Cast ArrayLike<number> → Uint8Array so TS knows it has .set()
//       (scalarData as Uint8Array).set(segLabelmap);
//     }
//   }
// } catch (e) {
//   console.warn('Bulk copy failed:', e);
//   // per-voxel fallback if needed
// }

// labelmapVolume.modified();
///////////////////////////////////////////////////////////////////////

//////////////////////// CLOSER _ BUT NO UPDATELABELMAPDATA FUNCTION
// const segmentationData = SegmentationService.getSegmentation(segmentationId);
// const labelmapRep = segmentationData.representationData.Labelmap;
// const labelmapImageIds = labelmapRep.imageIds; // 110 derived images

// // Simple flat copy - assumes labelmapBuffer matches slice layout
// const segLabelmapFlat = new Uint8Array(segToolState.labelmapBufferArray[0]);

// // OHIF auto-distributes flat buffer across imageIds
// SegmentationService.updateLabelmapData(segmentationId, {
//   imageIds: labelmapImageIds,
//   buffer: segLabelmapFlat.buffer,
// });
//////////////////////////////////////////////////////////////


// /////////////// NO LABELMAPVOLUME FOUND - stack labelmaps use imageIds no volume////////////////
// const segmentationData = SegmentationService.getSegmentation(segmentationId);
// const labelmapRep = segmentationData.representationData.Labelmap;

// // OHIF 3.12 has getLabelmapVolume for stack labelmaps too
// const labelmapVolume = SegmentationService.getLabelmapVolume(segmentationId);
// if (!labelmapVolume) {
//   console.warn('No labelmap volume found');
//   return;
// }

// const voxelManager = labelmapVolume.voxelManager;
// const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);

// // Copy flat buffer into volume (works for stack labelmaps)
// if (voxelManager.setCompleteScalarDataArray) {
//   voxelManager.setCompleteScalarDataArray(segLabelmap);
// } else {
//   const scalarData = voxelManager.getCompleteScalarDataArray() as Uint8Array;
//   scalarData.set(segLabelmap);
// }

// labelmapVolume.modified();

// // Update image references to match your base displaySet
// await SegmentationService.updateLabelmapSegmentationImageReferences(
//   segmentationId,
//   referencedDisplaySet.images.map(img => img.imageId)  // Your original 110 wadors:... imageIds
// );

// // Add to active viewport(s)
// const { viewportGridService } = servicesManager.services;
// const viewportId = viewportGridService.getActiveViewportId();
// await segmentation.addSegmentationRepresentations(viewportId, segmentationId);

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////


// ////////////////////////////////////////////////////////////////////
// /////////////////  NOPE - no labelmap.labelmapBuffer ///////////
// const segmentationData = SegmentationService.getSegmentation(segmentationId);
// const labelmapRep = segmentationData.representationData.Labelmap;
// const labelmapImageIds = labelmapRep.imageIds; // 110 derived images

// // Get the Cornerstone segmentation state directly
// const csSegmentation = segmentation.state.getSegmentation(segmentationId);
// console.log(' *****  csSegmentation', csSegmentation);
// // // Replace the labelmap buffer directly in Cornerstone state
// // csSegmentation.representationData.Labelmap.labelmapBuffer = segToolState.labelmapBufferArray[0];
// // csSegmentation.representationData.Labelmap.imageIds = labelmapImageIds;

// // // Trigger re-render
// // segmentation.state.modified(segmentationId);

// // // Add to active viewport
// const { viewportGridService } = servicesManager.services;
// const viewportId = viewportGridService.getActiveViewportId();
// // await SegmentationService.addSegmentationRepresentation(viewportId, segmentationId);

// ////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////
//////////////////////  NOPE - no loadImage //////////////////////
///////// found the load image but now the getCompleteScalarDataArray is for a volume
///////// the labelmap is 2D .....
// const segmentationData = SegmentationService.getSegmentation(segmentationId);
// const labelmapRep = segmentationData.representationData.Labelmap;
// const labelmapImageIds = labelmapRep.imageIds; // 110 derived images

// const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);
// const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;

// // Load FIRST derived labelmap image to understand its structure
// const firstImageId = labelmapImageIds[0];
// // const firstImage = await utilities.loadImage(firstImageId);  // utilities.loadImage
// const firstImage = await cornerstone.imageLoader.loadImage(firstImageId);
// const firstVoxelManager = firstImage.voxelManager;
//  ==> XwrongX  const firstScalarData = firstVoxelManager.getCompleteScalarDataArray() as Uint8Array;
//  ==> const firstScalarData = firstImage.getPixelData(); // <-- correct since it's 2D

// console.log('First slice size:', firstScalarData.length, 'Expected:', bytesPerSlice);
////////////////////////////////////////////////////////////////////

