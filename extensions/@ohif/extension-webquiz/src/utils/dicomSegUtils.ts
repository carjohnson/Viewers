import dicomParser from 'dicom-parser';
import { adaptersSEG } from '@cornerstonejs/adapters';
import { metaData } from '@cornerstonejs/core';
import { dicomlabToRGB } from './../../../../cornerstone-dicom-seg/src/utils/dicomlabToRGB';
import { CONSTANTS } from '@cornerstonejs/tools';
import dcmjs from 'dcmjs';
import { SegmentData } from './../models/SegmentationData';


// =====================================
export async function createSegDisplaySetFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  segmentationId: string,
  referencedDisplaySetInstanceUID: string,
  referencedImageIds: string[],
  segImageId: any,
  segments?: Record<number, Partial<SegmentData>>,
) {

  const dataset = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

  const sopInstanceUID = dataset.string('x00080018');
  const seriesInstanceUID = dataset.string('x0020000e');
  const studyInstanceUID = dataset.string('x0020000d');
  const sopClassUID = dataset.string('x00080016');

  if (!sopInstanceUID) {
    throw new Error('DICOM SEG missing SOP Instance UID (0008,0018)');
  }

  const segResult = await adaptersSEG.Cornerstone3D.Segmentation.createFromDICOMSegBuffer(referencedImageIds, arrayBuffer, {
    metadataProvider: metaData,
  });
  console.log(' *** segResult:', segResult);

  // set up the default colors for the segments in the metadata
  //    colorLUT is created from data.rgba in the SegmentationService
  //     function createSegmentationForSEGDisplaySet
  let usedRecommendedDisplayCIELabValue = true;
  segResult.segMetadata.data.forEach((data, i) => {
    if (i > 0) {
      data.rgba = data.RecommendedDisplayCIELabValue;

      if (data.rgba) {
        data.rgba = dicomlabToRGB(data.rgba);
      } else {
        usedRecommendedDisplayCIELabValue = false;
        data.rgba = CONSTANTS.COLOR_LUT[i % CONSTANTS.COLOR_LUT.length];
      }
    }
  });


  const displaySet = {
    uid: segmentationId,
    displaySetInstanceUID: segmentationId,
    sopClassHandlerId: 'cornerstone-dicom-seg',
    sopClassUID,
    modality: 'SEG',
    studyInstanceUID,
    seriesInstanceUID,
    seriesDescription: 'SEG',
    referencedDisplaySetInstanceUID,
    imageIds: referencedImageIds,
    instances: [
      {
        instanceUid: sopInstanceUID,
        data: arrayBuffer,
        sopClassUID,
        sopClassUid: sopClassUID,
        seriesInstanceUID,
        studyInstanceUID,
        modality: 'SEG',
        metadata: dataset,
        segImageId,
      },
    ],
    numberOfInstances: 1,
    segData: arrayBuffer,
    segments,
    ...segResult,
  };

  return displaySet;
}

// =====================================

// =====================================

// =====================================

// =====================================
///////////////////////////////////////////////
//////////////  DEBUG HELPERS /////////////////
///////////////////////////////////////////////



// =====================================
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


// =====================================
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

// =====================================
/**
 * Combined helper: extract and count from DICOM SEG ArrayBuffer
 */
export function analyzeSegmentationBuffer(arrayBuffer) {
  const { pixelArray, numberOfFrames, rows, columns, is16Bit } = extractPixelDataFromSEG(arrayBuffer);
  return bufferCounterForSEG(pixelArray, numberOfFrames, rows, columns, is16Bit);
}

export function analyzeSEGSegmentMapping(arrayBuffer) {
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
export function extractSegmentMasksFromSEG(arrayBuffer) {
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


// =====================================
/**
 * Count voxels per segment with proper frame mapping
 */
export function countSegmentVoxels(arrayBuffer) {
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
