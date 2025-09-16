import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { annotation } from '@cornerstonejs/tools';

interface BtnComponentProps {
  baseUrl: string,
  userInfo: any;
  refreshData: () => void;
  setIsSaved: (value: boolean) => void;
  studyInfo: any;
}

const BtnComponent: React.FC<BtnComponentProps> = ( {
  baseUrl,
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

  // get annotations from database based on user role
  useEffect(() => {
    // only run when userInfo and patientName are available
    if (!userInfo?.username || !patientName) return;

    const fetchAnnotations = async () => {

      const username = userInfo?.role === 'reader' ? userInfo.username : 'all';
      
      try {
        const response = await fetch(`${baseUrl}/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`, {
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
    };

    // trigger the fetch
    fetchAnnotations();
  }, [userInfo, patientName]);
  
  return (
      <div>
        <br></br>
        <br></br>
        <Button onClick={handleUploadAnnotationsClick}>Submit measurements</Button>
      </div>
  );
}

export default BtnComponent



