import React, { useEffect, useState, useRef } from 'react';
// import { sqrt } from 'math.js'
import BtnComponent from './components/btnComponent';
// import { useSystem } from '@ohif/core';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';
import { useStudyInfoStore } from './stores/useStudyInfoStore';
import { useStudyInfo } from './hooks/useStudyInfo';
import { usePatientInfo } from '@ohif/extension-default';


// import { RenderingEngine, getRenderingEngine, Enums } from '@cornerstonejs/core';

// const renderingEngineId = 'webquizEngine';
// const viewportId = 'webquizViewport';
// const type = Enums.ViewportType.STACK;


/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */


function WebQuizSidePanelComponent() {
    // set up useEffect hook to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    // const { servicesManager } = useSystem();
    // const { segmentationService } = servicesManager.services;
    
    // const [segmentationData, setSegmentationData] = useState([]);
    // const [volumeData, setVolumeData] = useState([]);
    const [annotationData, setAnnotationData] = useState([]);
    const [userInfo, setUserInfo] = useState(null);
    const [isSaved, setIsSaved] = useState(true);

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
    

    // // for render engine, 
    // const cornerstoneRef = useRef<HTMLDivElement>(null);
    // const [engine, setEngine] = useState<RenderingEngine | null>(null);

    // useEffect(() => {
    //     const element = cornerstoneRef.current;
    //     if (!element) return;

    //     let renderingEngine = getRenderingEngine(renderingEngineId);
    //     if (!renderingEngine) {
    //     renderingEngine = new RenderingEngine(renderingEngineId);
    //     renderingEngine.enableElement({
    //         viewportId,
    //         element,
    //         type,
    //     });
    //     renderingEngine.renderViewports([viewportId]);
    //     }

    //     setEngine(renderingEngine);
    // }, []);



    type AnnotationStats = Record<string, Record<string, unknown>>;     // generic for capture of cachedStats object
    // Annotations listeners
    useEffect(() => {
        const handleAnnotationChange = () => {
            const lo_annotationStats = getAnnotationsStats();
            setAnnotationData(lo_annotationStats);

            ////// for debug /////
            // const lengths = lo_annotationStats.flatMap((statsObj) => 
            //     Object.values(statsObj)
            //         .filter((stat): stat is { length: number } => typeof stat === 'object' && stat !== null && 'length' in stat)
            //         .map((stat) => stat.length)
            //     );

            // console.log("LENGTHS ===>", lengths);
        } ;

        // Register listeners
        // cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_ADDED, handleAnnotationChange);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, handleAnnotationChange);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, handleAnnotationChange);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, handleAnnotationChange);


        // Cleanup on unmount
        return() => {
            // cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_ADDED, handleAnnotationChange);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, handleAnnotationChange);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, handleAnnotationChange);
            cornerstone.eventTarget.removeEventListener(cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, handleAnnotationChange);
        }
    }, [] );

    //=====================
    // Segmentation listener


    // // don't rely on segmentationService. 
    // // These useEffects are tapping into the events for a more immediate response
    // // useEffect(() => {
    // //     const lo_allVolumes = getSegmentationStats();
    // //     setVolumeData(lo_allVolumes);
    // //     console.table(lo_allVolumes);
    // //     }, [segmentationService]);
    // // Refactored ... ===>
    // useEffect(() => {
    //     const handleSegmentationChange = () => {
    //         const [lo_segmentations, lo_allVolumes] = getSegmentationStats();
    //         setVolumeData(lo_allVolumes);
    //         console.table(lo_allVolumes);
    //     };

    //     cornerstone.eventTarget.addEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_ADDED,
    //         handleSegmentationChange
    //     );

    //     cornerstone.eventTarget.addEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_DELETED,
    //         handleSegmentationChange
    //     );

    //     cornerstone.eventTarget.addEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_MODIFIED,
    //         handleSegmentationChange
    //     );

    //     cornerstone.eventTarget.addEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_DATA_MODIFIED,
    //         handleSegmentationChange
    //     );

    //     return () => {
    //         cornerstone.eventTarget.removeEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_ADDED,
    //         handleSegmentationChange
    //         );
    //         cornerstone.eventTarget.removeEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_DELETED,
    //         handleSegmentationChange
    //         );
    //         cornerstone.eventTarget.removeEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_MODIFIED,
    //         handleSegmentationChange
    //         );
    //         cornerstone.eventTarget.removeEventListener(
    //         cornerstoneTools.Enums.Events.SEGMENTATION_DATA_MODIFIED,
    //         handleSegmentationChange
    //         );
    //     };
    // }, []);

    //=====================
    // watch for changes to the state properties
    useEffect(() => {
        if (annotationData.length > 0) {
            setIsSaved(false);
            // console.log(' Annotation Change');
        }
    }, [annotationData]);

    // useEffect(() => {
    //     if (volumeData.length > 0) {
    //         setIsSaved(false)
    //         // console.log(' Volume Change');
    //     }
    // }, [volumeData]);

    // useEffect(() => {
    //     if (segmentationData.length > 0) {
    //         setIsSaved(false)
    //         // console.log(' Volume Change');
    //     }
    // }, [segmentationData]);

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
    const getAnnotationsStats = (): AnnotationStats[] => {
        const lo_annotationStats: AnnotationStats[] = [];
        const allAnnotations = annotation.state.getAllAnnotations();

        allAnnotations.forEach((ann, index) => {
            const stats = ann.data?.cachedStats as AnnotationStats;
            if (stats && Object.keys(stats).length > 0) {
                lo_annotationStats.push(stats);
                // console.log("ANNOTATION Tool ===>", ` Annotation ${index}:`, ann.data.cachedStats);
            }
        });

        return lo_annotationStats;
    };

    // //=====================
    // // function to get the list of objects holding segmentations and
    // //  extract volume data
    // const getSegmentationStats = () => {
    //     const lo_segmentations = segmentationService.getSegmentations();
    //     const lo_allVolumes = [];

    //     lo_segmentations.forEach((segmentation, segIndex) => {
    //         const segments = segmentation.segments;

    //         Object.keys(segments).forEach((segmentKey) => {
    //         const segment = segments[segmentKey];
    //         const volume = segment?.cachedStats?.namedStats?.volume?.value;

    //         if (volume !== undefined) {
    //             lo_allVolumes.push({
    //             segmentation: segIndex + 1,
    //             segment: segmentKey,
    //             volume,
    //             });
    //         }
    //         });
    //     });
    //     return [lo_segmentations, lo_allVolumes];
    // };

    //=====================
    const refreshData = () => {
        const lo_annotationStats = getAnnotationsStats();
        setAnnotationData(lo_annotationStats);
        
        // const [lo_segmentations, lo_allVolumes] = getSegmentationStats();
        // setVolumeData(lo_allVolumes);
        // setSegmentationData(lo_segmentations);
        // console.table(lo_allVolumes);

        // return [lo_annotationStats, lo_allVolumes, lo_segmentations]; // ensures stats are updated before continuing
        return [lo_annotationStats]; // ensures stats are updated before continuing
    };

    ////////////////////////////////////////////
    //=====================
    // return
    //=====================
    ////////////////////////////////////////////
    return (
        <div className="text-white w-full text-center">
        <BtnComponent
            userInfo={userInfo} 
            refreshData={refreshData}
            setIsSaved={setIsSaved}
            studyInfo={studyInfo}
        />
        {userInfo && (
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
        )}
        </div>
    );    

}


export default WebQuizSidePanelComponent;

