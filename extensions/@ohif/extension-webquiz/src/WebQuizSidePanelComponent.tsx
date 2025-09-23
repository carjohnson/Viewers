import React, { useEffect, useState, useRef } from 'react';
import BtnComponent from './components/btnComponent';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';
import { useStudyInfoStore } from './stores/useStudyInfoStore';
import { useStudyInfo } from './hooks/useStudyInfo';
import { usePatientInfo } from '@ohif/extension-default';
// import { forEach } from 'platform/core/src/utils/hierarchicalListUtils';
import { API_BASE_URL } from './config/config';
import { AnnotationStats } from './components/annotationStats';
import { debounce } from './utils/debounce';
import { useSystem } from '@ohif/core';



/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */
function WebQuizSidePanelComponent() {
    // set up useEffect hook to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    const [annotationData, setAnnotationData] = useState<AnnotationStats[]>([]);
    const [userInfo, setUserInfo] = useState(null);
    const [isSaved, setIsSaved] = useState(true);
    const [annotationsLoaded, setAnnotationsLoaded] = useState(false);

    console.log("🔍 API Base URL:", API_BASE_URL);
    const { servicesManager } = useSystem();
    const toolbarService = servicesManager.services.toolbarService;
    const toolGroupService = servicesManager.services.toolGroupService;

    const measurementTools = toolbarService.getButtonSection('MeasurementTools');


    const toolGroupIds = toolGroupService.getToolGroupIds();

    toolGroupIds.forEach(id => {
    const group = toolGroupService.getToolGroup(id);
    // console.log(`🧠 ToolGroup ID: ${id}`);
    // console.log('🧠  group', group)


    });
    const config = toolGroupService.getToolConfiguration('default', 'Length');
    console.log('🔍 Length tool config:', config);
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


// Annotations listeners
    useEffect(() => {
        if (!userInfo?.username) return;

        const handleAnnotationAdd = (event) => {
            if (!userInfo?.username) {
                console.warn("⚠️ Username not available yet. Skipping label assignment.");
                return;
            }
            // if (userInfo.role === 'admin') {
            //     console.warn('Admins are not allowed to add annotations.');
            //     return;
            // } else {
                setTimeout(() => {
                    const measurementIndex = getLastIndexStored() + 1;
                    const customLabel = `${userInfo.username}_${measurementIndex}`;

                    const { annotation } = event.detail;
                    if (annotation.data.label === "") {
                        annotation.data.label = customLabel;
                    }
                }, 200);  // give measurement service time to render proper labels

                debouncedUpdateStats(); // wait for system to settle after add
            // };
        }
        
        // delay acquiring stats to let ohif complete the add of the annotation
        const debouncedUpdateStats = debounce(() => {
            setAnnotationData(getAnnotationsStats());
        }, 100);

        const handleAnnotationChange = () => {
            if (userInfo.role === 'admin') {
                console.warn('Admins are not allowed to modify annotations.');
                return;
            } else {
                debouncedUpdateStats();
            }
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


    // get user info from parent iframehost
    useEffect(() => {
        // send request to parent for user info
        window.parent.postMessage({ type: 'request-user-info'}, '*');

        // Listen for response
        const handleMessage = (event) => {
            if (event.data.type === 'user-info') {
                console.log('✅ Viewer > Received user info >>>:', event.data.payload);
                setUserInfo(event.data.payload);
            }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup listener on unmount
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);


    ////////////////////////////////////////////
    //=====================
    // helper functions
    //=====================
    ////////////////////////////////////////////

    //=====================
    // function to get list of all cached annotation stats
    //  also store the annotation uid
    const getAnnotationsStats = (): AnnotationStats[] => {
        const lo_annotationStats: AnnotationStats[] = [];
        const allAnnotations = annotation.state.getAllAnnotations();

        allAnnotations.forEach((ann, index) => {
            const stats = ann.data?.cachedStats as AnnotationStats;
            const uid = ann.annotationUID;

            if (
                stats &&
                Object.keys(stats).length > 0 &&
                uid &&
                !lo_annotationStats.some(existing => existing.uid === uid)
            ) {
                lo_annotationStats.push({
                    ...stats,
                    uid,
                });
            }

        });

        return lo_annotationStats;
    };

    //=====================
    // function to get the last index used when adding annotations
    const getLastIndexStored = (): number => {
        let iLastIndex = 0;
        const allAnnotations = annotation.state.getAllAnnotations();

        allAnnotations.forEach((oAnnotation, index) => {
        // console.log("🧩 Annotation object:", oAnnotation);
        const sLabel = oAnnotation?.data?.label;
            if (sLabel) {
                let iCurrentIndex = parseInt(sLabel.split('_').pop() ?? "0", 10);
                if (isNaN(iCurrentIndex)) {
                    iCurrentIndex = 99
                }
                iLastIndex = Math.max(iLastIndex, iCurrentIndex);
            }
        });

        return iLastIndex;
    };



    //=====================
    const refreshData = () => {
        const lo_annotationStats = getAnnotationsStats();
        setAnnotationData(lo_annotationStats);

        return lo_annotationStats; // ensures stats are updated before continuing
    };

    ////////////////////////////////////////////
    ////////////////////////////////////////////
    return (
        <div className="text-white w-full text-center">
        <BtnComponent
            baseUrl={API_BASE_URL}
            userInfo={userInfo} 
            annotationData={annotationData}
            setAnnotationsLoaded={setAnnotationsLoaded}
            setIsSaved={setIsSaved}
            studyInfo={studyInfo}
        />
        {/* {userInfo && (
            <div>
                <div>User Name: {userInfo.username}</div>
                <div>User Role: {userInfo.role}</div>
            </div>
        )}
        {studyInfo?.patientName && studyInfo?.studyUID && (
            <div>
                <div>Patient Name: {studyInfo.patientName}</div>
                <div>StudyUID: {studyInfo.studyUID}</div>
            </div>
        )} */}
        </div>
    );    

}


export default WebQuizSidePanelComponent;

