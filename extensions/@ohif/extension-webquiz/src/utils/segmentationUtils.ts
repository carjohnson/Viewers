import { adaptersSEG } from '@cornerstonejs/adapters';
import { imageLoader } from '@cornerstonejs/core';
import { metaData } from '@cornerstonejs/core';


export async function loadDicomSegIntoOHIF({
  dicomSegSeriesUID,
  referencedSeriesInstanceUID,
  segmentationLabel,
  segmentLabels,
  arrayBuffer,
  servicesManager,
}) {
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
    console.warn('No referenced displaySet for SEG', dicomSegSeriesUID);
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
    const segmentationId = await segmentationService.createLabelmapForDisplaySet(
        referencedDisplaySet,  // ← Pass the displaySet object directly
        {
        // label: `SEG ${dicomSegSeriesUID.slice(-8)}`,
        label: segmentationLabel,
        },
    );

    segmentLabels.forEach(s => {
        // Add metadata for ALL segments found in buffer
        segmentationService.addSegment(segmentationId, {
        segmentIndex: s.segmentIndex,
        label: s.label,
        });
    })


    // // for debug
    // const startingSeg = segmentationService.getSegmentation(segmentationId);
    // console.log(' *** STARTING SEG', startingSeg);
    // console.log('segToolState:', segToolState);
    // console.log('labelmapBufferArray:', segToolState.labelmapBufferArray?.length);
    // bufferCounter_orig( segLabelmap, ' *** Creation of segToolState');

    // ~~~~~~~~~~
    // get labelmap ids and split the buffer into per Slice arrays
    const segmentationData = segmentationService.getSegmentation(segmentationId);
    const labelmapRep = segmentationData.representationData.Labelmap;
    const labelmapImageIds = labelmapRep.imageIds; //derived images from representation data

    const bytesPerSlice = segLabelmap.length / labelmapImageIds.length;
    const labelmapBufferArray: Uint8Array[] = [];
    for (let i = 0; i < labelmapImageIds.length; i++) {
    const sliceStart = i * bytesPerSlice;
    const sliceEnd = sliceStart + bytesPerSlice;
    labelmapBufferArray.push(segLabelmap.subarray(sliceStart, sliceEnd));
    }
    // bufferCounter(labelmapBufferArray, '*** LabelmapBufferArray - AFTER load subarrays');

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
    // console.log(' *** UPDATED SEG', updatedSeg);
    const viewportId = viewportGridService.getActiveViewportId();
    await segmentationService.addSegmentationRepresentation(viewportId, updatedSeg);

    console.log('🎉 Loaded SEG:', dicomSegSeriesUID);
}

///////////////////////////////////////////////
//////////////  DEBUG HELPERS /////////////////
///////////////////////////////////////////////
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