import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { annotation } from '@cornerstonejs/tools';
import { AnnotationStats } from './components/annotationStats';

import { useSystem } from '@ohif/core';
import { EyeIcon, EyeOffIcon } from '../utils/CreateCustomIcon';


interface BtnComponentProps {
  baseUrl: string,
  userInfo: any;
  annotationData: AnnotationStats[];
  setIsSaved: (value: boolean) => void;
  studyInfo: any;
}

const BtnComponent: React.FC<BtnComponentProps> = ( {
  baseUrl,
  userInfo,
  annotationData,
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

    const fetchAnnotationsFromDB = async () => {

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
    fetchAnnotationsFromDB();
  }, [userInfo, patientName]);

      
  const { servicesManager } = useSystem();
  const { measurementService } = servicesManager.services;
  const { viewportGridService } = servicesManager.services;
  const activeViewportId = viewportGridService.getActiveViewportId();
  const measurementList = measurementService.getMeasurements();
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});

  const handleMeasurementClick = (measurementId: string) => {
    const ohifAnnotation = annotation.state.getAnnotation(measurementId);
    if (ohifAnnotation) {
      measurementService.jumpToMeasurement(activeViewportId, measurementId);
    } else {
      console.warn('No annotation found for UID:', measurementId);
    }
  }

  const toggleVisibility = (uid: string) => {
    const currentVisibility = visibilityMap[uid] ?? true;
    const newVisibility = !currentVisibility;

    measurementService.toggleVisibilityMeasurement(uid, newVisibility);

    setVisibilityMap(prev => ({
      ...prev,
      [uid]: newVisibility,
    }));
  };

  return (
      <div>
        <br></br>
        <br></br>
        <Button onClick={handleUploadAnnotationsClick}>Submit measurements</Button>
        <br></br>
        <br></br>
        <div>
          <h3>Annotations</h3>
          <ul>
            {measurementList.map((measurement, index) => {
              const uid = measurement.uid;
              const isVisible = visibilityMap[uid] ?? true;

              return (
                <li
                  key={uid || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderBottom: '1px solid #ccc',
                  }}
                >
                  <span
                    style={{ flexGrow: 1, cursor: 'pointer' }}
                    onClick={() => handleMeasurementClick(uid)}
                  >
                    {measurement.label || `Measurement ${index + 1}`}
                  </span>

                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleVisibility(uid)}
                    title={isVisible ? 'Hide annotation' : 'Show annotation'}
                  >
                    {isVisible ? <EyeIcon /> : <EyeOffIcon />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {/* <div>
          <h3>UIDs</h3>
          <ul>
            {annotationData.map((m, index) => (
              <li key={index}>
                {m.uid || `Index ${index + 1}`}
              </li>
            ))}
          </ul>
        </div> */}
      </div>
  );
}

export default BtnComponent



