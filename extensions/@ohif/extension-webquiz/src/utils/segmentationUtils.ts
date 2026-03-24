import { adaptersSEG } from '@cornerstonejs/adapters';
import { imageLoader } from '@cornerstonejs/core';
import { metaData } from '@cornerstonejs/core';
import { useSegmentMetadataStore } from '../stores/useSegmentMetadataStore';
import { SegmentationData } from './../models/SegmentationData';


export async function loadDicomSegIntoOHIF({
//   dicomSegSeriesUID,
  segmentationId,
  referencedSeriesInstanceUID,
  segmentationLabel,
  segmentLabels,
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


    segmentLabels.forEach(s => {
        // Add metadata for ALL segments found in buffer
        segmentationService.addSegment(segmentationId, {
        segmentIndex: s.segmentMaskValue,   // matches backend schema
        label: s.label,
        cachedStats: s.cachedStats,
        });
    })

    // cache segments metatdata so that it persists between extensions
    useSegmentMetadataStore.getState().setMetadata(
        segmentationId,
        segmentLabels.map(s => ({
            ...s,
        })
    ));
    console.log('🔥 CACHED:', segmentationId, segmentLabels.length, 'segments');


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