import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { annotation } from '@cornerstonejs/tools';
import { AnnotationStats } from './components/annotationStats';

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
 
  const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
  const measurementListRef = useRef([]);
  const patientName = studyInfo?.patientName || null;
  const userInfo = getUserInfo();

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

  // Set up GUI so the user can click on an annotation in the panel list
  //    and have the image jump to the corresponding slice
  //    also - set up a visibility icon for each annotation
  const { servicesManager } = useSystem();
  const { measurementService } = servicesManager.services;
  const { viewportGridService } = servicesManager.services;
  const activeViewportId = viewportGridService.getActiveViewportId();
  const measurementList = measurementService.getMeasurements();
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  const [selectionMap, setSelectionMap] = useState<Record<string, string>>({});

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

  const handleDropdownChange = (uid: string, value: string) => {
    setSelectionMap(prev => ({
      ...prev,
      [uid]: value,
    }));

    console.log(`Selected "${value}" for UID ${uid}`);
    // Eventually: send to backend or store in annotation.data
  };  

  const scoreOptions = [
    { value: '1', label: 'definitely benign' },
    { value: '2', label: 'probably benign' },
    { value: '3', label: 'indeterminent' },
    { value: '4', label: 'probably metastatic' },
    { value: '5', label: 'definitely metastatic' },
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
                    getOptionLabel={(e) => e.value}
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



