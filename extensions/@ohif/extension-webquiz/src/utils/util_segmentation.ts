// Utility to convert the segmentation object obtained through OHIF segmentationService
// This is modified code which  originated from example utility found in cornerstonejs github
//          cornerstone3D/packages/adapters/examples/segmentationVolume/utils.ts


import * as cornerstone from "@cornerstonejs/core";
import * as cornerstoneTools from "@cornerstonejs/tools";
import * as cornerstoneAdapters from "@cornerstonejs/adapters";
import dcmjs from "dcmjs";


const { cache, imageLoader, metaData } = cornerstone;
const { segmentation: csToolsSegmentation } = cornerstoneTools;
const { downloadDICOMData } = cornerstoneAdapters.helpers;
const { Cornerstone3D } = cornerstoneAdapters.adaptersSEG;



export async function getGeneratedSegmentation(state) {
  const { segmentationId, viewportIds } = state;
  const segmentationIds = getSegmentationIds();
  if (!segmentationIds.length) {
    return null;
  }

  const segmentation = csToolsSegmentation.state.getSegmentation(segmentationId);
  const { imageIds } = segmentation.representationData.Labelmap;
  const segImages = imageIds.map(imageId => cache.getImage(imageId));
  const referencedImages = segImages.map(image => cache.getImage(image.referencedImageId));

  const labelmaps2D = [];
  let z = 0;

  for (const segImage of segImages) {
    const segmentsOnLabelmap = new Set();
    const pixelData = segImage.getPixelData();
    const { rows, columns } = segImage;

    for (let i = 0; i < pixelData.length; i++) {
      const segment = pixelData[i];
      if (segment !== 0) {
        segmentsOnLabelmap.add(segment);
      }
    }

    labelmaps2D[z++] = {
      segmentsOnLabelmap: Array.from(segmentsOnLabelmap),
      pixelData,
      rows,
      columns
    };
  }

  const allSegmentsOnLabelmap = labelmaps2D.map(lm => lm.segmentsOnLabelmap);
  const labelmap3D = {
    segmentsOnLabelmap: Array.from(new Set(allSegmentsOnLabelmap.flat())),
    metadata: [],
    labelmaps2D
  };

  labelmap3D.segmentsOnLabelmap.forEach(segmentIndex => {
    const color =
        csToolsSegmentation.config.color.getSegmentIndexColor(
            viewportIds[0],
            segmentationId,
            segmentIndex
        ) || [255, 255, 255, 255]; // fallback RGBA

    const RecommendedDisplayCIELabValue = dcmjs.data.Colors.rgb2DICOMLAB(
        color.slice(0, 3).map(value => value / 255)
        ).map(value => Math.round(value));

    const segmentMetadata = {
      SegmentNumber: segmentIndex.toString(),
      SegmentLabel: `Segment ${segmentIndex}`,
      SegmentAlgorithmType: "MANUAL",
      SegmentAlgorithmName: "OHIF Brush",
      RecommendedDisplayCIELabValue,
      SegmentedPropertyCategoryCodeSequence: {
        CodeValue: "T-D0050",
        CodingSchemeDesignator: "SRT",
        CodeMeaning: "Tissue"
      },
      SegmentedPropertyTypeCodeSequence: {
        CodeValue: "T-D0050",
        CodingSchemeDesignator: "SRT",
        CodeMeaning: "Tissue"
      }
    };
    labelmap3D.metadata[segmentIndex] = segmentMetadata;
  });

  return Cornerstone3D.Segmentation.generateSegmentation(
    referencedImages,
    labelmap3D,
    metaData
  );
}



export function getSegmentationIds() {
    return csToolsSegmentation.state
        .getSegmentations()
        .map(x => x.segmentationId);
}
