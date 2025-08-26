// import React from "react";
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { data } from 'dcmjs';

// import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from "@cornerstonejs/tools";
import { getEnabledElement } from '@cornerstonejs/core';
import { Buffer } from 'buffer';
import { getGeneratedSegmentation } from "../utils/util_segmentation";

import { annotation } from '@cornerstonejs/tools';
import { init } from '@cornerstonejs/core';
import { useSystem } from '@ohif/core';
import { usePatientInfo } from '@ohif/extension-default';




const { datasetToDict } = data;



function BtnComponent( {userInfo, refreshData, setIsSaved }) {
 
  const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
    
  const measurementListRef = useRef([]);

  const userDefinedBtnLabel = () => {
    if (userInfo?.role === "admin") {
      return "Restore all users' measurements.";
    } else {
      return "Restore logged-in user's measurements.";
    }
  };

  const { servicesManager } = useSystem();
  const displaySetService = servicesManager.services.displaySetService;
  const activeDisplaySets = displaySetService.getActiveDisplaySets();

  const studyInstanceUID = activeDisplaySets[0]?.StudyInstanceUID;
  const { patientInfo } = usePatientInfo();
  // in this study, patient name is set up to be unique and is being
  //  sent to the parent as the patient_id
  const patientName = patientInfo.PatientName;

  const handleUploadAnnotationsClick = () => {

    // refresh the annotation data before posting
    // segmentation data is refreshed automatically through segmentation service
    const [freshMeasurementData, freshVolumeData] = refreshData();
    const allAnnotations = annotation.state.getAllAnnotations();
    measurementListRef.current = [...allAnnotations];
    
    console.log('Number of measurements: ', freshMeasurementData.length);
    console.log("Number of segments:", freshVolumeData.length)
    console.log("Number of annotation objects:", measurementListRef.current.length)


    window.parent.postMessage({
      type: 'annotations', 
      measurementdata   : freshMeasurementData,
      segmentationdata  : freshVolumeData,
      annotationObjects : measurementListRef.current,
      patientid         : patientName
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


  const saveAnnotations = () => {
    const allAnnotations = annotation.state.getAllAnnotations();
    measurementListRef.current = [...allAnnotations];
  };

  const handleClearMeasurementsClick = async () => {
    saveAnnotations();
    console.log("Clearing measurements");
    measurementListRef.current.forEach(annotationEntry => {
      const { annotationUID } = annotationEntry;
      annotation.state.removeAnnotation(annotationUID);
    });
    // // trigger a re-render or update the viewport
    // const renderingEngine = getRenderingEngine('webquizRenderEngine');
    // const viewports = renderingEngine.getViewports();

    // if (viewports.length > 0) {
    //   renderingEngine.renderViewports(viewports.map(vp => vp.id));
    // }
  };


  const handleRedrawSavedMeasurementsClick = () => {
    measurementListRef.current.forEach(savedAnnotation => {
      if (
        savedAnnotation &&
        typeof savedAnnotation.annotationUID === 'string' &&
        savedAnnotation.annotationUID.length > 0
      ) {
        annotation.state.addAnnotation(savedAnnotation);
      }
    });

    // const renderingEngine = getRenderingEngine('yourRenderingEngineId');
    // if (renderingEngine) {
    //   renderingEngine.render();
    // }
  };


  useEffect(() => {
    const username = userInfo?.role === 'reader' ? userInfo.username : 'all';
    window.parent.postMessage({ type: 'request-list-users-annotations', username }, '*');

    const handleUsersAnnotationsMessage = (event) => {
      if (event.data.type === 'list-users-annotations') {
        const annotationsList = event.data.payload;
        setListOfUsersAnnotations(annotationsList);

        annotationsList.forEach(userAnnotationObjects => {
          userAnnotationObjects.forEach(fetchedAnnotation => {
            if (
              fetchedAnnotation &&
              typeof fetchedAnnotation.annotationUID === 'string' &&
              fetchedAnnotation.annotationUID.length > 0
            ) {
              annotation.state.addAnnotation(fetchedAnnotation);
            }
          });
        });
      }
    };

    window.addEventListener('message', handleUsersAnnotationsMessage);

    return () => {
      window.removeEventListener('message', handleUsersAnnotationsMessage);
    };
  }, [userInfo]);


   async function handleFetchAnnotationsClick() {
    try {

      console.log('Fetching annotations from server');

      // get annotation objects from json file
      const response = await fetch('http://localhost:3000/tempForTesting/testSavedAnnotationObjects.json');
      if (!response.ok) throw new Error('Network response was not ok');
      const annotations = await response.json();
      annotations.forEach(fetchedAnnotation => {
        if (
          fetchedAnnotation &&
          typeof fetchedAnnotation.annotationUID === 'string' &&
          fetchedAnnotation.annotationUID.length > 0
        ) {
          annotation.state.addAnnotation(fetchedAnnotation);
        }
      });

    } catch (error) {
      console.error('❌ Error fetching annotations (check if Express is running):', error);
    }
  }


  
  return (
      <div>
        <br/>
        <Button onClick={handleUploadSegmentationsClick}>Upload Segmentations</Button>
        <br/><br/>
        <Button onClick={handleUploadAnnotationsClick}>Post</Button>
        <br></br>
        <br></br>
        <Button onClick={handleClearMeasurementsClick}>Clear Measurements</Button>
        <br></br>
        <br></br>
        <Button onClick={handleRedrawSavedMeasurementsClick}>Redraw Measurements saved in OHIF</Button>
        <br></br>
        <br></br>
        <Button onClick={handleFetchAnnotationsClick}>{userDefinedBtnLabel(userInfo)}</Button>
      </div>
  );
}

export default BtnComponent
