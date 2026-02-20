import { adaptersSEG } from '@cornerstonejs/adapters';
import { metaData, volumeLoader, cache } from '@cornerstonejs/core';
import { segmentation } from '@cornerstonejs/tools';
import * as cornerstone from "@cornerstonejs/core";
import { utilities } from '@cornerstonejs/core';
import * as csTools from '@cornerstonejs/tools';


export async function loadDicomSegIntoOHIF({
  dicomSegSeriesUID,
  referencedSeriesInstanceUID,
  arrayBuffer,
  servicesManager,
}) {
  const {
    segmentationService,
    DisplaySetService,
    ViewportGridService,
  } = servicesManager.services;

    // console.log('SegmentationService methods:', Object.keys(segmentationService));
  const referencedDisplaySets =
    DisplaySetService.getDisplaySetsForSeries(referencedSeriesInstanceUID);
  const referencedDisplaySet = referencedDisplaySets?.[0];

  if (!referencedDisplaySet) {
    console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
    return;
  }


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
    const segmentationId = await segmentationService.createLabelmapForDisplaySet(
        referencedDisplaySet,  // ← Pass the displaySet object directly
        {
        label: `SEG ${dicomSegSeriesUID.slice(-8)}`,
        },
    );
    //  Wait for Cornerstone state to catch up (critical!) ?? IS THIS NECESSARY ??
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms debounce


    // 1. Create empty segmentation
    const segmentationData = segmentationService.getSegmentation(segmentationId);
    console.log(' ***** segmentationData:', segmentationData);  // needs a touch or labelmapRep is undefined


    // 2. Create segLabelmap from ArrayBuffer stored in the segToolState
    const labelmapRep = segmentationData.representationData.Labelmap;
    const labelmapImageIds = labelmapRep.imageIds; // derived images
    console.log(' ***** labelmapRep:', labelmapRep);

    const segLabelmap = new Uint8Array(segToolState.labelmapBufferArray[0]);
    bufferCounter_orig(segLabelmap, ' *** SOURCE Buffer with segLabelMap');
    // console.log('SOURCE buffer - Seg1:', countSeg1, 'Seg2:', countSeg2);

    const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;
    const labelmapBufferArray: Uint8Array[] = [];
    for (let i = 0; i < labelmapImageIds.length; i++) {
    const sliceStart = i * bytesPerSlice;
    const sliceEnd = sliceStart + bytesPerSlice;
    labelmapBufferArray.push(segLabelmap.subarray(sliceStart, sliceEnd));

    // const sliceData = segLabelmap.subarray(sliceStart, sliceEnd);
    }

    // 3. Inject your segLabelmap buffer by creating the .data object
    labelmapRep.data = {
        labelmapBufferArray,
        activeSegmentIndex: 1,
        segmentsOnLabelmap: [1, 2], // or more if you have multiple segments
    };
    bufferCounter(labelmapBufferArray, '*** AFTER ASSIGN with labelmapBufferArray');


    // Add metadata for ALL segments found in buffer
    segmentationService.addSegment(segmentationId, {
    segmentIndex: 1,
    label: 'Segment 1',
    color: [255, 0, 0, 0.5],  // RGBA
    });

    segmentationService.addSegment(segmentationId, {
    segmentIndex: 2,           
    label: 'Segment 2', 
    color: [0, 255, 0, 0.5],  // Green
    });


    segmentationService.addOrUpdateSegmentation(segmentationData);
    const updatedSeg = segmentationService.getSegmentation(segmentationId);
    console.log(' ***** UPDATED SEG OBJECT:', updatedSeg);
    const finalBuffer = updatedSeg.representationData.Labelmap.data.labelmapBufferArray;
    bufferCounter(finalBuffer, ' *** FINAL buffer');


    // 5. Attach segmentation to the actual viewport (this is what makes it render)
    // add to the viewport
    const { Enums: csToolsEnums } = csTools;
    const viewportId = ViewportGridService.getActiveViewportId();
    await segmentationService.removeSegmentationRepresentations(viewportId, segmentationId);
    await segmentationService.addSegmentationRepresentation(viewportId, {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Labelmap,
    });
    segmentationService.setActiveSegmentation(viewportId, segmentationId);

    const segAfterUpdateRep = segmentationService.getSegmentation(segmentationId);
    console.log (' ***** AFTER RENDER SEG OBJECT:', segAfterUpdateRep);
    const afterBuffer = segAfterUpdateRep.representationData.Labelmap.data.labelmapBufferArray;
    bufferCounter(afterBuffer, ' *** AFTER "RENDER" ');


    // MORE DEBUGGING:
// 1. Get ALL representations in this viewport
const viewportRepresentations = segmentationService.getSegmentationRepresentations(viewportId);
console.log('Viewport representations:', viewportRepresentations);

// 2. Get SPECIFIC Labelmap representation
const [sViewportId, oLabelmapRepStored] = segmentationService.getRepresentationsForSegmentation(segmentationId)

console.log('ViewportId, Specific Labelmap rep:', sViewportId, oLabelmapRepStored);

// // 3. Check active segmentation
// const activeSegId = segmentationService.getActiveSegmentationId(viewportId);
// console.log('Active segmentation ID:', activeSegId);

// // 4. Check segment visibilities
// console.log('Segment 1 visible:', segmentationService.getSegmentVisibility(viewportId, segmentationId, 1));
// console.log('Segment 2 visible:', segmentationService.getSegmentVisibility(viewportId, segmentationId, 2));





    console.log('🎉 Loaded SEG:', dicomSegSeriesUID);
}

///////////////////  DEBUG HELPER
function bufferCounter (buf, timePoint)  {

    const uniqueValues = new Set();
    let seg1Count = 0, seg2Count = 0;
    let sampleCount = 0;
    let nonZeroCount = 0;
    let firstNonZeroIndex = 9999999;
    let firstNonZeroIndexInSlice = 9999999;


    for (let i = 0; i < buf.length; i++) {
        const perSliceChunk = buf[i];
        for (let j = 0; j< perSliceChunk.length; j++) {
            const value = perSliceChunk[j];
            if (value !== 0) {
                if (firstNonZeroIndex === 9999999) {firstNonZeroIndex = i; firstNonZeroIndexInSlice = j};
                nonZeroCount++;
                uniqueValues.add(value);
                if (value === 1) seg1Count++;
                if (value === 2) seg2Count++;
            }
        }
    }



console.log(' ***** DEBUG ACTUAL Buffer contents ... TIMEPOINT:', timePoint);
console.log('Non-zero voxels:', nonZeroCount);
console.log('Unique non-zero:', Array.from(uniqueValues));
console.log('Seg1 count:', seg1Count, 'Seg2 count:', seg2Count);
console.log('First non zero slice:', firstNonZeroIndex);
console.log('First non zero index in slice:', firstNonZeroIndexInSlice);
console.log('Buffer type:', buf.constructor.name, 'length:', buf.length);

return [seg1Count, seg2Count]

}


    function bufferCounter_orig (buf, timePoint)  {

    const uniqueValues = new Set();
    let seg1Count = 0, seg2Count = 0;
    let sampleCount = 0;
    let nonZeroCount = 0;
    let firstNonZeroIndex = 9999999;

    for (let i = 0; i < buf.length; i++) {
    const value = buf[i];
    if (value !== 0) {
        if (firstNonZeroIndex === 9999999) firstNonZeroIndex = i;
        nonZeroCount++;
        uniqueValues.add(value);
        if (value === 1) seg1Count++;
        if (value === 2) seg2Count++;
    }
    }


console.log(' ***** DEBUG ACTUAL Buffer contents ... TIMEPOINT:', timePoint);
console.log('Non-zero voxels:', nonZeroCount);
console.log('Unique non-zero:', Array.from(uniqueValues));
console.log('Seg1 count:', seg1Count, 'Seg2 count:', seg2Count);
console.log('First non zero index:', firstNonZeroIndex);
console.log('Buffer type:', buf.constructor.name, 'length:', buf.length);

return [seg1Count, seg2Count]

}


    // const uniqueValues = new Set();
    // let nonZeroCount = 0;
    // let segment1Count = 0;
    // const rows = 500;   // from referenced image dicom
    // const cols = 640;

    // // const lmMap = segLabelmap;
    // const lmMap = labelmapRep.data.labelmapBufferArray;
    // for (let i = 0; i < lmMap.length; i++) {
    // const value = lmMap[i];
    // if (value !== 0) {
    //     nonZeroCount++;
    //     uniqueValues.add(value);
    //     if (value === 1) segment1Count++;
    // }
    // }
    // console.log(' *** labelmapRep:', labelmapRep);
    // console.log('Buffer length:', lmMap.length);
    // console.log('Non-zero voxels:', nonZeroCount);
    // console.log('Segment 1 voxels:', segment1Count);
    // console.log('Unique segment indices:', Array.from(uniqueValues));
    // console.log('Expected size:', labelmapRep.imageIds.length * rows * cols); // verify shape


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
