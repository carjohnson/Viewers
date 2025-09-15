import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { data } from 'dcmjs';
// import { Buffer } from 'buffer';
// import { getGeneratedSegmentation } from "../utils/util_segmentation";
import { annotation } from '@cornerstonejs/tools';


/////////////
// NOTE:
// Removing customized rendering engine since AddAnnotation already does the render
// There may be some missing variables at this stage if this is to
// be brought back on line
// import { RenderingEngine } from '@cornerstonejs/core';


const { datasetToDict } = data;

interface BtnComponentProps {
  userInfo: any;
  refreshData: () => void;
  setIsSaved: (value: boolean) => void;
  studyInfo: any;
  // renderingEngine: RenderingEngine | null;
}



const BtnComponent: React.FC<BtnComponentProps> = ( {
  userInfo,
  refreshData,
  setIsSaved,
  studyInfo
  // renderingEngine
}) => {
 
  const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
  const measurementListRef = useRef([]);
  const patientName = studyInfo?.patientName || null;

  const userDefinedBtnLabel = () => {
    if (userInfo?.role === "admin") {
      return "Restore all users' measurements.";
    } else {
      return "Restore measurements.";
    }
  };

  //>>>>> for rendering engine <<<<<
  // const { servicesManager } = useSystem();
  // const displaySetService = servicesManager.services.displaySetService;
  // const activeDisplaySets = displaySetService.getActiveDisplaySets();

  // const studyInstanceUID = activeDisplaySets[0]?.StudyInstanceUID;
  // const { patientInfo } = usePatientInfo();
  // // in this study, patient name is set up to be unique and is being
  // //  sent to the parent as the patient_id
  // const patientName = patientInfo.PatientName;
  //>>>>> <<<<<


  const handleUploadAnnotationsClick = () => {

    // refresh the annotation data before posting
    // segmentation data is refreshed automatically through segmentation service
    // const [freshMeasurementData, freshVolumeData] = refreshData();
    const allAnnotations = annotation.state.getAllAnnotations();
    measurementListRef.current = [...allAnnotations];
    
    // console.log('Number of measurements: ', freshMeasurementData.length);
    // console.log("Number of segments:", freshVolumeData.length)
    console.log("Number of annotation objects:", measurementListRef.current.length)


    window.parent.postMessage({
      type: 'annotations', 
      // measurementdata   : freshMeasurementData,
      // segmentationdata  : freshVolumeData,
      annotationObjects : measurementListRef.current,
      patientid         : patientName
    }, '*');
    setIsSaved(true);
  }


  // const handleUploadSegmentationsClick = async () => {
  //   const [, , freshSegmentationData] = refreshData();
  //   const selectedId = freshSegmentationData[0]?.segmentationId;

  //   const viewportService = servicesManager.services.cornerstoneViewportService;
  //   const viewportIds = viewportService.getViewportIds();

  //   const state = { segmentationId: selectedId, viewportIds };
  //   const result = await getGeneratedSegmentation(state);

  //   if (!result?.dataset) {
  //     console.error("No dataset generated.");
  //     return;
  //   }

  //   uploadDICOMData(result.dataset, `segmentation-${Date.now()}.dcm`);
  // };

  // const uploadDICOMData = ( dataset, filename )  => {
  //   try {
  //     const buffer = Buffer.from(datasetToDict(dataset).write());
  //     const blob = new Blob([buffer], { type: "application/dicom" });

  //       // Send blob to parent app
  //     window.parent.postMessage(
  //       {
  //         type: "SEGMENTATION_UPLOAD",
  //         filename,
  //         payload: blob
  //       },
  //       "*"
  //     );

  //     console.log("📤 Segmentation message posted to parent window.");
  //   } catch (error) {
  //     console.error("❌ Failed to post segmentation:", error);
  //   }

  // }


  // const saveAnnotations = () => {
  //   const allAnnotations = annotation.state.getAllAnnotations();
  //   measurementListRef.current = [...allAnnotations];
  // };

  // const handleClearMeasurementsClick = async () => {
  //   saveAnnotations();
  //   console.log("Clearing measurements");
  //   measurementListRef.current.forEach(annotationEntry => {
  //     const { annotationUID } = annotationEntry;
  //     annotation.state.removeAnnotation(annotationUID);
  //   });

  //   // triggerRender();
  // };


  // const handleRedrawSavedMeasurementsClick = () => {
  //   measurementListRef.current.forEach(savedAnnotation => {
  //     if (
  //       savedAnnotation &&
  //       typeof savedAnnotation.annotationUID === 'string' &&
  //       savedAnnotation.annotationUID.length > 0
  //     ) {
  //       annotation.state.addAnnotation(savedAnnotation);
  //     }
  //   });

  // };


//   // useEffect if you want the annotations to appear automatically when the component mounts
//   useEffect(() => {
//   const fetchAnnotations = async () => {
//     const username = userInfo?.role === 'reader' ? userInfo.username : 'all';

//     try {
//       const response = await fetch(`/webquiz/list-users-annotations?username=${username}`);
//       if (!response.ok) throw new Error('Failed to fetch annotations');

//       const { payload: annotationsList } = await response.json();
//       setListOfUsersAnnotations(annotationsList);

//       annotationsList.forEach(userAnnotationObjects => {
//         userAnnotationObjects.forEach(fetchedAnnotation => {
//           if (
//             fetchedAnnotation &&
//             typeof fetchedAnnotation.annotationUID === 'string' &&
//             fetchedAnnotation.annotationUID.length > 0
//           ) {
//             annotation.state.addAnnotation(fetchedAnnotation);
//           }
//         });
//       });
//     } catch (error) {
//       console.error('❌ Error fetching annotations:', error);
//     }
//   };

//   fetchAnnotations();
// }, [userInfo]);


  // get annotations from database based on user role
  async function handleFetchAnnotationsClick() {
    const username = userInfo?.role === 'reader' ? userInfo.username : 'all';

    try {
      const response = await fetch(`https://localhost:3000/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch annotations from DB');

      const { payload: annotationsList, legend } = await response.json();
      setListOfUsersAnnotations(annotationsList);

      annotationsList.forEach(({ data, color }) => {
        data.forEach(annotationObj => {
          if (
            annotationObj &&
            typeof annotationObj.annotationUID === 'string' &&
            annotationObj.annotationUID.length > 0
          ) {

            annotation.config.style.setAnnotationStyles(annotationObj.annotationUID, {
              color: color,
            });

            annotation.state.addAnnotation(annotationObj);
          }
        });
      });

      window.parent.postMessage({
        type: 'update-legend',
        legend: legend
      }, '*');

    } catch (error) {
      console.error('❌ Error fetching annotations:', error);
    }
  }



// const triggerRender = () => {

//   if (!renderingEngine) {
//     console.error('❌ Rendering engine not found. Did you initialize it?');
//     return;
//   }

//   const viewportService = servicesManager.services.cornerstoneViewportService;
//   const viewportIds = viewportService.getViewportIds();

//   if (viewportIds.length > 0) {
//     renderingEngine.renderViewports(viewportIds);
//   }
// };

  
  return (
      <div>
        <br></br>
        <br></br>
        <Button onClick={handleFetchAnnotationsClick}>{userDefinedBtnLabel(userInfo)}</Button>
        <br/><br/>
        <Button onClick={handleUploadAnnotationsClick}>Submit measurements</Button>
      </div>
  );
}

export default BtnComponent



