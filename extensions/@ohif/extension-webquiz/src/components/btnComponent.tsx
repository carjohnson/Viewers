import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@ohif/ui-next';
import { annotation } from '@cornerstonejs/tools';

import { useSystem } from '@ohif/core';
import { EyeIcon, EyeOffIcon } from '../utils/CreateCustomIcon';
import Select from 'react-select';
import { setUserInfo, getUserInfo } from './../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { useAnnotationPosting } from '../hooks/useAnnotationPosting';
import { handleDropdownChange } from '../handlers/dropdownHandlers';
import { handleMeasurementClick, toggleVisibility } from '../handlers/guiHandlers';
import { fetchAnnotationsFromDB } from '../handlers/fetchAnnotations';
import { AnnotationList } from './AnnotationList';
import { buildSelectionMap } from '../utils/annotationUtils';


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

  const scoreOptions = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  // ========================= Handles =======================

  // ======== post annotations to DB
  const triggerPost = useAnnotationPosting({
    patientName,
    measurementListRef,
    setIsSaved });


  // ======== fetch annotations from DB based on user role
  useEffect(() => {
    if (!userInfo?.username || !patientName) return;

    fetchAnnotationsFromDB({
      userInfo,
      patientName,
      baseUrl,
      setListOfUsersAnnotations,
      setSelectionMap,
      annotation,
      setAnnotationsLoaded,
    });
  }, [userInfo, patientName]);

  const onMeasurementClick = (id: string) =>
    handleMeasurementClick({ measurementId: id, annotation, measurementService, activeViewportId });

  const onToggleVisibility = (uid: string) =>
    toggleVisibility({ uid, visibilityMap, setVisibilityMap, measurementService });

  const onDropdownChange = (uid: string, value: number) => {
    handleDropdownChange({
      uid,
      value,
      selectionMap,
      setSelectionMap,
      triggerPost,
      annotation,
    });
  };
  

  // ========================= Render =======================

  return (
    <AnnotationList
      measurementList={measurementList}
      selectionMap={selectionMap}
      visibilityMap={visibilityMap}
      scoreOptions={scoreOptions}
      onDropdownChange={onDropdownChange}
      onMeasurementClick={onMeasurementClick}
      onToggleVisibility={onToggleVisibility}
      triggerPost={triggerPost}
      annotation={annotation}
    />
  );
}

export default BtnComponent



