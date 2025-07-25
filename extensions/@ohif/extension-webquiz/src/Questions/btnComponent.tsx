import React from "react";
import { Button } from '@ohif/ui-next';
import { data } from 'dcmjs';

import * as cornerstoneTools from "@cornerstonejs/tools";
import { getEnabledElement } from '@cornerstonejs/core';
import { Buffer } from 'buffer';
import { getGeneratedSegmentation } from "../utils/util_segmentation";

const { datasetToDict } = data;


function BtnComponent( { measurementData, segmentationData, refreshData, setIsSaved }) {

 
  const handleUploadAnnotationsClick = () => {

    // refresh the annotation data before posting
    // segmentation data is refreshed automatically through segmentation service
    const [freshMeasurementData, freshVolumeData] = refreshData();
    console.log('Number of measurements: ', freshMeasurementData.length);
    console.log("Number of segments:", freshVolumeData.length)

    window.parent.postMessage({
      type: 'annotations', 
      measurementdata: freshMeasurementData,
      segmentationdata: freshVolumeData
    }, '*');
    setIsSaved(true);
  }


  const handleUploadSegmentationsClick = async () => {
    const [, , freshSegmentationData] = refreshData();
    const selectedId = freshSegmentationData[0]?.segmentationId;

    const currentViewports = cornerstoneTools.utilities.getAllViewportIds?.() || [getEnabledElement()?.viewport?.id];
    const state = { segmentationId: selectedId, viewportIds: currentViewports };
    const result = await getGeneratedSegmentation(state);

    if (!result?.dataset) {
      console.error("No dataset generated.");
      return;
    }

    uploadDICOMData(result.dataset, `segmentation-${Date.now()}.dcm`);
};

const uploadDICOMData = ( dataset, filename )  => {
  try {
    const buffer = Buffer.from(datasetToDict(dataset).write());
    const blob = new Blob([buffer], { type: "application/dicom" });

      // Send blob to parent app
    window.parent.postMessage(
      {
        type: "SEGMENTATION_UPLOAD",
        filename,
        payload: blob
      },
      "*"
    );

    console.log("📤 Segmentation message posted to parent window.");
  } catch (error) {
    console.error("❌ Failed to post segmentation:", error);
  }

}

    return (
      <div>
        <br/>
        <Button onClick={handleUploadSegmentationsClick}>Upload Segmentations</Button>
        <br/><br/>
        <Button onClick={handleUploadAnnotationsClick}>Post</Button>
      </div>
  );
}

export default BtnComponent
