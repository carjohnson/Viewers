import React, { useEffect, useState, useRef } from 'react';
import BtnComponent from './components/btnComponent';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';
import { useStudyInfoStore } from './stores/useStudyInfoStore';
import { useStudyInfo } from './hooks/useStudyInfo';
import { usePatientInfo } from '@ohif/extension-default';
import { API_BASE_URL } from './config/config';
import { AnnotationStats } from './models/AnnotationStats';
import { getAnnotationsStats } from './utils/annotationUtils';
import { debounce } from './utils/debounce';
import { setUserInfo, getUserInfo } from './../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { getLastIndexStored } from './utils/annotationUtils';




/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */
function WebQuizSidePanelComponent() {
    // set up useEffect hook to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    const [annotationData, setAnnotationData] = useState<AnnotationStats[]>([]);
    // const [userInfo, setUserInfo] = useState(null);
    const [isSaved, setIsSaved] = useState(true);
    const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
    

    const userInfo = getUserInfo();

    // console.log("🔍 API Base URL:", API_BASE_URL);
    const scoreOptions = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
    ];


    // ---------------------------------------------
    // Hook Setup for Study Metadata
    // ---------------------------------------------
    // - usePatientInfo(): Retrieves patient-level metadata (name, ID) from OHIF's context.
    // - useStudyInfo(): Polls displaySetService for studyUID and frameUID once viewer is ready.
    // - useStudyInfoStore(): Zustand store for persisting combined study metadata across tabs.
    //
    // These hooks work together to ensure that:
    // - Patient and study metadata are available reactively
    // - Zustand holds the full object for consistent access
    // - Data persists even when switching OHIF modes (e.g. Measurements → Viewer)
    //
    // Note: Hooks must be called unconditionally and in this order to comply with React rules.
    const { patientInfo } = usePatientInfo();
    const studyInfoFromHook = useStudyInfo();
    const { studyInfo, setStudyInfo } = useStudyInfoStore();


    useEffect(() => {
        if (!studyInfoFromHook?.studyUID || !patientInfo?.PatientName) {
            console.log('⏳ Waiting for full study info...');
            return;
        }

        const fullInfo = {
            ...studyInfoFromHook,
            patientName: patientInfo.PatientName,
            patientId: patientInfo.PatientID,
        };

        console.log('✅ Setting full study info in Zustand:', fullInfo);
        setStudyInfo(fullInfo);
    }, [studyInfoFromHook, patientInfo]);

    //>>>>> for debug <<<<<
    // console.log('🧠 useStudyInfo() returned:', studyInfoFromHook);
    // console.log('📦 Zustand store currently holds:', studyInfo);


    // Annotations listeners and handlers
    useEffect(() => {
        if (!userInfo?.username) return;

        const handleAnnotationAdd = (event) => {
            if (!userInfo?.username) {
                console.warn("⚠️ Username not available yet. Skipping label assignment.");
                return;
            }
            setTimeout(() => {
                const allAnnotations = annotation.state.getAllAnnotations();
                const measurementIndex = getLastIndexStored(allAnnotations) + 1;
                const customLabel = `${userInfo.username}_${measurementIndex}`;

                const { annotation: newAnnotation } = event.detail;
                if (newAnnotation.data.label === "") {
                    newAnnotation.data.label = customLabel;
                }
            }, 200);  // give measurement service time to render proper labels

            debouncedUpdateStats(); // wait for system to settle after add
        }
        
        // delay acquiring stats to let ohif complete the add of the annotation
        const debouncedUpdateStats = debounce(() => {
            setAnnotationData(getAnnotationsStats());
        }, 100);

        const handleAnnotationChange = () => {
            debouncedUpdateStats();
        };        


        // Register listeners
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_ADDED, handleAnnotationAdd);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, handleAnnotationChange);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, handleAnnotationChange);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, handleAnnotationChange);

        // Cleanup on unmount
        return() => {
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_ADDED, handleAnnotationAdd);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, handleAnnotationChange);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, handleAnnotationChange);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, handleAnnotationChange);
        }
    }, [userInfo] );


    //=====================
    // watch for changes to the state properties
    useEffect(() => {
        if (annotationData.length > 0) {
            setIsSaved(false);
            // console.log(' Annotation Change');
        }
    }, [annotationData]);

    // wait for all annotations to be loaded, then set to locked if user role is 'admin'
    useEffect(() => {
        if (!annotationsLoaded || userInfo?.role !== 'admin') return;

        annotation.state.getAllAnnotations().forEach(ann => {
            ann.isLocked = true;
        });

        console.log('🔒 All annotations locked for admin user:', userInfo.username);
    }, [userInfo, annotationsLoaded]);


    ////////////////////////////////////////////
    ////////////////////////////////////////////
    return (
        <div className="text-white w-full text-center">
        <BtnComponent
            baseUrl={API_BASE_URL}
            setAnnotationsLoaded={setAnnotationsLoaded}
            setIsSaved={setIsSaved}
            studyInfo={studyInfo}
        />
        </div>
    );    

}


export default WebQuizSidePanelComponent;

