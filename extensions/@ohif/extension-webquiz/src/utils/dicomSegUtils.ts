
// //////////////////////////// WORKS FOR CREATELABELMAPFORDISPLAYSET /////////////////////
// import dicomParser from 'dicom-parser';
// /**
//  * Create an OHIF-compatible SEG display set from a DICOM SEG ArrayBuffer.
//  */
// export function createSegDisplaySetFromArrayBuffer(
//   arrayBuffer: ArrayBuffer,
//   segmentationId: string,
//   referencedDisplaySetInstanceUID: string,
//   referencedImageIds: string[],
//   segImageId: any,
//   segments?: Record<number, Partial<Segment>>,
// ) {
//   const arrayBufferView = new Uint8Array(arrayBuffer);
//   const dataset = dicomParser.parseDicom(arrayBufferView);

//   const sopInstanceUid = dataset.string('x00080018'); // SOP Instance UID
//   const seriesInstanceUid = dataset.string('x0020000E'); // Series Instance UID
//   const studyInstanceUidFromDicom = dataset.string('x0020000D'); // Study Instance UID
//   const sopClassUid = dataset.string('x00080016'); // SOP Class UID

//   const effectiveStudyUid =  studyInstanceUidFromDicom;
//   const effectiveSeriesUid = referencedDisplaySetInstanceUID;

//   if (!sopInstanceUid) {
//     throw new Error('DICOM SEG missing SOP Instance UID (0008,0018)');
//   }

//     // Build labelMapImages as an array of image objects
//   // Each SEG frame maps to a source image
//   const labelMapImages = referencedImageIds.map((referencedImageId, index) => ({
//     segImageId,                    // The SEG imageId (same for all frames, or you could create per-frame)
//     referencedImageId,          // The source image this frame/segment maps to
//     index,                      // Frame index
//   }));

//   const images = referencedImageIds.map(imgId => ({ imageId: imgId }));

//  const displaySet = {
//     uid: segmentationId,
//     displaySetInstanceUID: segmentationId,
//     seriesInstanceUID: effectiveSeriesUid,
//     studyInstanceUID: effectiveStudyUid,
//     modality: 'SEG',
//     seriesDescription: 'SEG',
//     sopClassUID: sopClassUid,
//     segData: arrayBuffer,
//     referencedDisplaySetInstanceUID,
//     labelMapImages: [labelMapImages],
//     imageIds: referencedImageIds,
//     referenceImageIds: referencedImageIds,
//     images,
//     segments,
//     instances: [
//       {
//         instanceUid: sopInstanceUid,
//         data: arrayBuffer, // raw ArrayBuffer
//         sopClassUid: sopClassUid,
//         seriesInstanceUid: effectiveSeriesUid,
//         studyInstanceUid: effectiveStudyUid,
//         modality: 'SEG',
//         metadata: dataset,
//         segImageId,
//       },
//     ],
//     numberOfInstances: 1,
//   };

//   return displaySet;
// }
// /////////////// END WORKS FOR CREATELABELMAPFORDISPLAYSET /////////////////////


// =====================================
// // //////////////////////////// FROM PERPLEXITY /////////////////////

// =====================================
import dicomParser from 'dicom-parser';
import { adaptersSEG } from '@cornerstonejs/adapters';
import { metaData } from '@cornerstonejs/core';
import { dicomlabToRGB } from './../../../../cornerstone-dicom-seg/src/utils/dicomlabToRGB';
import { CONSTANTS } from '@cornerstonejs/tools';



type Segment = {
  label?: string;
  color?: [number, number, number, number];
  active?: boolean;
};

export async function createSegDisplaySetFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  segmentationId: string,
  referencedDisplaySetInstanceUID: string,
  referencedImageIds: string[],
  segImageId: any,
  segments?: Record<number, Partial<Segment>>,
) {
  const dataset = dicomParser.parseDicom(new Uint8Array(arrayBuffer));

  const sopInstanceUID = dataset.string('x00080018');
  const seriesInstanceUID = dataset.string('x0020000e');
  const studyInstanceUID = dataset.string('x0020000d');
  const sopClassUID = dataset.string('x00080016');

  if (!sopInstanceUID) {
    throw new Error('DICOM SEG missing SOP Instance UID (0008,0018)');
  }

  console.log(' *** metaData:', metaData);
  const segResult = await adaptersSEG.Cornerstone3D.Segmentation.createFromDICOMSegBuffer(referencedImageIds, arrayBuffer, {
    metadataProvider: metaData,
  });
  console.log(' *** segResult:', segResult);
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
// import { createFromDICOMSegBuffer } from '@cornerstonejs/adapters';

export async function parseSegArrayBuffer(
  arrayBuffer: ArrayBuffer,
  referencedImageIds: string[],
  metadataProvider: any
) {
  const arrayBufferView = new Uint8Array(arrayBuffer);  // bytes
  const dataSet = dicomParser.parseDicom(arrayBufferView);

  const sopClassUID = dataSet.string('x00080016');
  if (sopClassUID !== '1.2.840.10008.5.1.4.1.1.66.4') {
    throw new Error('Not a DICOM SEG object');
  }

  const result = adaptersSEG.Cornerstone3D.Segmentation.createFromDICOMSegBuffer(referencedImageIds, arrayBuffer, {
    metadataProvider,
  });

  return {
    dataSet,
    ...result,
  };
}


// =====================================
const DEFAULT_COLORS: [number, number, number, number][] = [
  [255, 0, 0, 255],
  [0, 255, 0, 255],
  [0, 0, 255, 255],
  [255, 255, 0, 255],
  [255, 0, 255, 255],
  [0, 255, 255, 255],
];


// =====================================


// // //////////////////////////// FROM COPILOT - not debugged yet /////////////////////
// import dicomParser from 'dicom-parser';
// import type { Segment } from '@ohif/core'; // adjust import to your types
// import dcmjs from 'dcmjs';
// import { metaData } from '@cornerstonejs/core';

// export function createSegDisplaySetFromArrayBuffer(
//   arrayBuffer: ArrayBuffer,
//   segmentationId: string,
//   referencedDisplaySetInstanceUID: string,
//   referencedImageIds: string[],
//   segImageId: string,
//   segments?: Record<number, Partial<Segment>>,
// ) {
//   const uint8Array = new Uint8Array(arrayBuffer);


// const { dataset } = parseSegWithDcmjs(arrayBuffer);
//   const sopInstanceUid = dataset.SOPInstanceUID; // SOP Instance UID
//   const seriesInstanceUid = dataset.seriesInstanceUID; // Series Instance UID
//   const studyInstanceUidFromDicom = dataset.studyInstanceUID; // Study Instance UID
//   const sopClassUid = dataset.sopClassUID; // SOP Class UID

//   if (!sopInstanceUid) {
//     throw new Error('DICOM SEG missing SOPInstanceUID');
//   }

//   // Build frame → segment + frame → source mapping + scalarData
//   const frameInfos = buildFrameSegmentMap(meta);

//   // Map ReferencedSOPInstanceUID → referencedImageId (from the parent displaySet)
//   const sopToImageIdMap: Record<string, string> = {};
//   referencedImageIds.forEach(imageId => {
//     const imageMeta = metaData.get('dicom', imageId) as any;
//     const sop = imageMeta?.SOPInstanceUID;
//     if (sop) {
//       sopToImageIdMap[sop] = imageId;
//     }
//   });

//   // Build labelMapImages: one entry per frame
//   const labelMapImages: any[] = [];

//   frameInfos.forEach((frameInfo, idx) => {
//     const { segmentNumber, frameIndex, referencedSOPInstanceUID, scalarData } = frameInfo;

//     let referencedImageId: string | undefined;
//     if (referencedSOPInstanceUID && sopToImageIdMap[referencedSOPInstanceUID]) {
//       referencedImageId = sopToImageIdMap[referencedSOPInstanceUID];
//     } else {
//       // Fallback: align by index if mapping is missing
//       referencedImageId = referencedImageIds[idx] ?? referencedImageIds[0];
//     }

//     // For now, we reuse segImageId as the "imageId" key for this frame.
//     // If you want per-frame imageIds, you can generate them here.
//     const segFrameImageId = `${segImageId}?frame=${frameIndex}`;

//     // Register per-frame metadata so OHIF/cornerstone can query it
//     metaData.add('dicom', segFrameImageId, {
//       ...meta,
//       // You can also attach frame-specific info if needed:
//       PerFrameFunctionalGroupsSequenceIndex: frameIndex,
//       ReferencedSegmentNumber: segmentNumber,
//       ReferencedSOPInstanceUID: referencedSOPInstanceUID,
//     });

//     labelMapImages.push({
//       imageId: segFrameImageId,
//       referencedImageId,
//       frameIndex,
//       segmentNumber,
//       scalarData, // this is what you’ll feed into voxelManager later
//     });
//   });

//   const images = referencedImageIds.map(imageId => ({ imageId }));

//   const displaySet = {
//     uid: segmentationId,
//     displaySetInstanceUID: segmentationId,
//     seriesInstanceUID: seriesInstanceUid ?? referencedDisplaySetInstanceUID,
//     studyInstanceUID: studyInstanceUid,
//     modality: 'SEG',
//     seriesDescription: meta.SeriesDescription || 'SEG',
//     sopClassUID: sopClassUid,
//     segData: arrayBuffer,
//     referencedDisplaySetInstanceUID,
//     labelMapImages, // flat array of per-frame labelmap images
//     imageIds: referencedImageIds,
//     referenceImageIds: referencedImageIds,
//     images,
//     segments,
//     instances: [
//       {
//         instanceUid: sopInstanceUid,
//         data: arrayBuffer,
//         sopClassUid,
//         seriesInstanceUid,
//         studyInstanceUid,
//         modality: 'SEG',
//         metadata: meta,
//         segImageId,
//       },
//     ],
//     numberOfInstances: 1,
//   };

//   return displaySet;
// }
// // =====================================

// type SegmentMaskInfo = {
//   segmentNumber: number;
//   frameIndex: number;
//   referencedSOPInstanceUID?: string;
//   scalarData: Uint8Array;
// };

// // =====================================
// function unpackBitPackedFrame(
//   frameBytes: Uint8Array,
//   rows: number,
//   columns: number
// ): Uint8Array {
//   const unpacked = new Uint8Array(rows * columns);
//   for (let byteIdx = 0; byteIdx < frameBytes.length; byteIdx++) {
//     const byte = frameBytes[byteIdx];
//     const basePixel = byteIdx * 8;
//     for (let bit = 0; bit < 8 && basePixel + bit < unpacked.length; bit++) {
//       const value = (byte >> (7 - bit)) & 1;
//       unpacked[basePixel + bit] = value;
//     }
//   }
//   return unpacked;
// }

// // =====================================
// function buildFrameSegmentMap(dataset: any): SegmentMaskInfo[] {
//   const {
//     NumberOfFrames,
//     Rows,
//     Columns,
//     PixelData,
//     PerFrameFunctionalGroupsSequence = [],
//   } = dataset;

//   if (!NumberOfFrames || !Rows || !Columns || !PixelData) {
//     throw new Error('SEG missing NumberOfFrames/Rows/Columns/PixelData');
//   }

//   const bytesPerFrame = Math.ceil((Rows * Columns) / 8);
//   const pixelData = new Uint8Array(PixelData);
//   const frameInfos: SegmentMaskInfo[] = [];

//   for (let frame = 0; frame < NumberOfFrames; frame++) {
//     const frameOffset = frame * bytesPerFrame;
//     const frameBytes = pixelData.slice(frameOffset, frameOffset + bytesPerFrame);
//     const scalarData = unpackBitPackedFrame(frameBytes, Rows, Columns);

//     const pffg = PerFrameFunctionalGroupsSequence[frame] || {};
//     const segIdSeq = pffg.SegmentIdentificationSequence || {};
//     const segmentNumber = segIdSeq.ReferencedSegmentNumber;

//     let referencedSOPInstanceUID: string | undefined;
//     const derivationImageSequence = pffg.DerivationImageSequence?.[0];
//     const sourceImageSequence = derivationImageSequence?.SourceImageSequence?.[0];
//     if (sourceImageSequence?.ReferencedSOPInstanceUID) {
//       referencedSOPInstanceUID = sourceImageSequence.ReferencedSOPInstanceUID;
//     }

//     if (!segmentNumber) {
//       console.warn('Frame without ReferencedSegmentNumber, skipping frame', frame);
//       continue;
//     }

//     frameInfos.push({
//       segmentNumber,
//       frameIndex: frame,
//       referencedSOPInstanceUID,
//       scalarData,
//     });
//   }

//   return frameInfos;
// }

// // =====================================
// function parseSegWithDcmjs(arrayBuffer: ArrayBuffer) {
//   const uint8 = new Uint8Array(arrayBuffer);

//   // Raw DICOM message
//   const dicomData = dcmjs.data.DicomMessage.readFile(uint8);

//   // Naturalized dataset with proper JS types (strings, numbers, arrays)
//   const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
//   const meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dataset);

//   return { dicomData, dataset: meta };
// }

// /////////////// END FROM COPILOT /////////////////////

// =====================================
// =====================================
