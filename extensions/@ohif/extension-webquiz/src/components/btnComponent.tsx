import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { annotation } from '@cornerstonejs/tools';

import { useSystem } from '@ohif/core';
import { EyeIcon, EyeOffIcon } from '../utils/CreateCustomIcon';
import Select from 'react-select';
import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';



interface BtnComponentProps {
  baseUrl: string,
  setAnnotationsLoaded: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  studyInfo: any;
}

const BtnComponent: React.FC<BtnComponentProps> = ( {
  baseUrl,
  setAnnotationsLoaded,
  setIsSaved,
  studyInfo
}) => {

  const { servicesManager } = useSystem();
  const { measurementService } = servicesManager.services;
  const { viewportGridService } = servicesManager.services;
  const activeViewportId = viewportGridService.getActiveViewportId();
  const measurementList = measurementService.getMeasurements();
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  const [selectionMap, setSelectionMap] = useState<Record<string, number>>({});
  const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
  const measurementListRef = useRef([]);
  const patientName = studyInfo?.patientName || null;
  const userInfo = getUserInfo();

  // ========================= Handles =======================
  const handleUploadAnnotationsClick = () => {

    const allAnnotations = annotation.state.getAllAnnotations();
    const annotationsWithStats = [];
    allAnnotations.forEach((ann) => {
      const uid = ann.annotationUID;
      const selectedScore = selectionMap[uid];
      if (ann.data?.cachedStats && Object.keys(ann.data.cachedStats).length > 0) {
        if (typeof selectedScore === 'number') {
          (ann as any).suspicionScore = selectedScore;
          annotationsWithStats.push(ann);
        }
      }
    });

    measurementListRef.current = [...annotationsWithStats];

    window.parent.postMessage({
      type: 'annotations', 
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

        // ~~~~~~~~~~~~
        // extract the suspicion scores from the list of annotations
        const newSelectionMap = {};

        annotationsList.forEach(({ data }) => {
          data.forEach(annotationObj => {
            if (
              annotationObj &&
              typeof annotationObj.annotationUID === 'string' &&
              annotationObj.annotationUID.length > 0 &&
              typeof annotationObj.suspicionScore === 'number'
            ) {
              newSelectionMap[annotationObj.annotationUID] = annotationObj.suspicionScore;
            }
          });
        });

        setSelectionMap(newSelectionMap);

        // ~~~~~~~~~~~~
        // use the cornerstone tools to add each annotation to the image
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

        setAnnotationsLoaded(true);
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

  // ========================= GUI Functions =======================
  // Set up GUI so the user can click on an annotation in the panel list
  //    and have the image jump to the corresponding slice
  //    also - set up a visibility icon for each annotation

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

  const handleDropdownChange = (uid: string, value: number) => {
    setSelectionMap(prev => ({
      ...prev,
      [uid]: value,
    }));
    // console.log(`Selected "${value}" for UID ${uid}`);
  };  

  const scoreOptions = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  return (
      <div>
        <br></br>
        <br></br>
        <Button onClick={handleUploadAnnotationsClick}>Submit measurements</Button>
        <br></br>
        <br></br>
        <div>
          <h3>Annotations</h3>
          <h4 style={{ textAlign: 'left' }}>Score</h4>
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

                  {/* Dropdown */}
                  <Select
                    options={scoreOptions}
                    value={scoreOptions.find(opt => opt.value === selectionMap[measurement.uid])}
                    onChange={(selectedOption) =>
                      handleDropdownChange(measurement.uid, selectedOption?.value)
                    }
                    getOptionLabel={(e) => e.label}
                    styles={{
                      control: (base) => ({
                        ...base,
                        backgroundColor: 'transparent',
                        borderColor: '#ccc',
                        color: 'white',
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: 'white',
                      }),
                      menu: (base) => ({
                        ...base,
                        backgroundColor: '#222',
                        color: 'white',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? '#444' : '#222',
                        color: 'white',
                      }),
                    }}
                    placeholder="Suspicion score"
                  />

                  {/* Measurement label */}
                  <span
                    style={{ flexGrow: 1, cursor: 'pointer' }}
                    onClick={() => handleMeasurementClick(uid)}
                  >
                    {measurement.label || `Measurement ${index + 1}`}
                  </span>

                  {/* Visibility Icon */}
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
      </div>
  );
}

export default BtnComponent



