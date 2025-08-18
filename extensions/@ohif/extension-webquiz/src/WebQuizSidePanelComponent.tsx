import React, { useEffect, useState } from 'react';
import { sqrt } from 'math.js'
import BtnComponent from './Questions/btnComponent';
import { useSystem } from '@ohif/core';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';


/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */


function WebQuizSidePanelComponent() {
    // set up useEffect hook to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    const { servicesManager } = useSystem();
    const { segmentationService } = servicesManager.services;
    
    const [segmentationData, setSegmentationData] = useState([]);
    const [volumeData, setVolumeData] = useState([]);
    const [annotationData, setAnnotationData] = useState([]);
    const [userInfo, setUserInfo] = useState(null);
    const [isSaved, setIsSaved] = useState(true);



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


    // don't rely on segmentationService. 
    // These useEffects are tapping into the events for a more immediate response
    // useEffect(() => {
    //     const lo_allVolumes = getSegmentationStats();
    //     setVolumeData(lo_allVolumes);
    //     console.table(lo_allVolumes);
    //     }, [segmentationService]);
    // Refactored ... ===>
    useEffect(() => {
        const handleSegmentationChange = () => {
            const [lo_segmentations, lo_allVolumes] = getSegmentationStats();
            setVolumeData(lo_allVolumes);
            console.table(lo_allVolumes);
        };

        cornerstone.eventTarget.addEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_ADDED,
            handleSegmentationChange
        );

        cornerstone.eventTarget.addEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_DELETED,
            handleSegmentationChange
        );

        cornerstone.eventTarget.addEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_MODIFIED,
            handleSegmentationChange
        );

        cornerstone.eventTarget.addEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_DATA_MODIFIED,
            handleSegmentationChange
        );

        return () => {
            cornerstone.eventTarget.removeEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_ADDED,
            handleSegmentationChange
            );
            cornerstone.eventTarget.removeEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_DELETED,
            handleSegmentationChange
            );
            cornerstone.eventTarget.removeEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_MODIFIED,
            handleSegmentationChange
            );
            cornerstone.eventTarget.removeEventListener(
            cornerstoneTools.Enums.Events.SEGMENTATION_DATA_MODIFIED,
            handleSegmentationChange
            );
        };
    }, []);

    //=====================
    // watch for changes to the state properties
    useEffect(() => {
        if (annotationData.length > 0) {
            setIsSaved(false);
            // console.log(' Annotation Change');
        }
    }, [annotationData]);

    useEffect(() => {
        if (volumeData.length > 0) {
            setIsSaved(false)
            // console.log(' Volume Change');
        }
    }, [volumeData]);

    useEffect(() => {
        if (segmentationData.length > 0) {
            setIsSaved(false)
            // console.log(' Volume Change');
        }
    }, [segmentationData]);

    // get user info from parent iframehost
    useEffect(() => {
        // send request to parent for user info
        window.parent.postMessage({ type: 'request-user-info'}, '*');

        // Listen for response
        const handleMessage = (event) => {
            if (event.data.type === 'user-info') {
                console.log('✅ Viewer > Received user info:', event.data.payload);
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

    //=====================
    // function to get the list of objects holding segmentations and
    //  extract volume data
    const getSegmentationStats = () => {
    const lo_segmentations = segmentationService.getSegmentations();
    const lo_allVolumes = [];

    lo_segmentations.forEach((segmentation, segIndex) => {
        const segments = segmentation.segments;

        Object.keys(segments).forEach((segmentKey) => {
        const segment = segments[segmentKey];
        const volume = segment?.cachedStats?.namedStats?.volume?.value;

        if (volume !== undefined) {
            lo_allVolumes.push({
            segmentation: segIndex + 1,
            segment: segmentKey,
            volume,
            });
        }
        });
    });
    return [lo_segmentations, lo_allVolumes];
    };

    //=====================
    const refreshData = () => {
        const lo_annotationStats = getAnnotationsStats();
        setAnnotationData(lo_annotationStats);
        
        const [lo_segmentations, lo_allVolumes] = getSegmentationStats();
        setVolumeData(lo_allVolumes);
        setSegmentationData(lo_segmentations);
        console.table(lo_allVolumes);
        
        return [lo_annotationStats, lo_allVolumes, lo_segmentations]; // ensures stats are updated before continuing
    };



     ////////////////////////////////////////////
    //=====================
    // return
    //=====================
    ////////////////////////////////////////////
    return (
        <div className="text-white w-full text-center">
        {`Web Quiz version : ${sqrt(4)}`}
        <BtnComponent
            userInfo={userInfo} 
            refreshData={refreshData}
            setIsSaved={setIsSaved}
        />
        {userInfo && <div>User Role: {userInfo.role} </div>}
        </div>
    );    

}


export default WebQuizSidePanelComponent;

