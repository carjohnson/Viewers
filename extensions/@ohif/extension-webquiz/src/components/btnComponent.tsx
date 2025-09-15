import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
// import { data } from 'dcmjs';
import { annotation } from '@cornerstonejs/tools';

// const { datasetToDict } = data;

interface BtnComponentProps {
  userInfo: any;
  refreshData: () => void;
  setIsSaved: (value: boolean) => void;
  studyInfo: any;
}

const BtnComponent: React.FC<BtnComponentProps> = ( {
  userInfo,
  refreshData,
  setIsSaved,
  studyInfo
}) => {
 
  const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
  const measurementListRef = useRef([]);
  const patientName = studyInfo?.patientName || null;

  const userDefinedBtnLabel = () => {
    if (userInfo?.role === "admin") {
      return "Restore all users' measurements";
    } else {
      return "Restore measurements";
    }
  };

  const handleUploadAnnotationsClick = () => {

    // refresh the annotation data before posting
    // segmentation data is refreshed automatically through segmentation service
    // const [freshMeasurementData, freshVolumeData] = refreshData();
    const allAnnotations = annotation.state.getAllAnnotations();
    measurementListRef.current = [...allAnnotations];
    
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



