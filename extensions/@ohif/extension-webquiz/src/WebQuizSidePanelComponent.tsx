import React, { useEffect, useState, useRef, useMemo } from 'react';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';
import { useStudyInfoStore } from './stores/useStudyInfoStore';
import { useStudyInfo } from './hooks/useStudyInfo';
import { usePatientInfo } from '@ohif/extension-default';
import { API_BASE_URL } from './config/config';
import { AnnotationStats } from './models/AnnotationStats';
import { setUserInfo, getUserInfo, onUserInfoReady } from './../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { useAnnotationPosting } from './hooks/useAnnotationPosting';
import { fetchAnnotationsFromDB } from './handlers/fetchAnnotations';
import { handleDropdownChange } from './handlers/dropdownHandlers';
import { handleMeasurementClick, toggleVisibility, closeScoreModal } from './handlers/guiHandlers';
import { useSystem } from '@ohif/core';
import { AnnotationList } from './components/AnnotationList/AnnotationList';
import { ScoreModal } from './components/ScoreModal';
import { handleMeasurementAdded, handleAnnotationChange, handleAnnotationRemove } from './handlers/annotationEventHandlers';
import { createDebouncedStatsUpdater } from './utils/annotationUtils';
import { createDebouncedModalTrigger } from './utils/annotationUtils';
import { buildDropdownSelectionMapFromState } from './utils/annotationUtils';

import MarkSeriesCompletedButton from './components/MarkSeriesCompletedButton';
import { useSeriesValidation } from './hooks/useSeriesValidation';
import { useCurrentSeriesUID } from './hooks/useCurrentSeriesUID';
import { postStudyProgress, fetchStudyProgressFromDB } from './handlers/studyProgressHandlers';
import { ModalComponent } from './components/ModalComponent';


/**
 *  Creating a React component to be used as a side panel in OHIF.
 *  Also performs a simple div that uses Math.js to output the square root.
 */
function WebQuizSidePanelComponent() {
    // set up useEffect hook to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    const [annotationData, setAnnotationData] = useState<AnnotationStats[]>([]);
    const [isSaved, setIsSaved] = useState(true);
    const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
    const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
    const [dropdownSelectionMap, setDropdownSelectionMap] = useState<Record<string, number>>({});
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [selectedScore, setSelectedScore] = useState<number | null>(null);
    const [activeUID, setActiveUID] = useState<string | null>(null);
    const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
    const [isSeriesAnnotationsCompleted, setSeriesAnnotationsCompleted] = useState(false);
    const isSeriesValidRef = useRef<boolean | null>(null);
    const [validatedSeriesUID, setValidatedSeriesUID] = useState(null);

    //~~~~~~~~~~~~~~~~~
    const [modalInfo, setModalInfo] = useState<null | { 
        title: string;
        message: string;
        onClose?: () => void;
        showCancel?: boolean;
        onCancel?: () => void;
    }>(null);
    const showModal = ({
        title,
        message,
        onClose,
        showCancel = false,
        onCancel
    }: {
        title: string;
        message: string;
        onClose?: () => void;
        showCancel?: boolean;
        onCancel?: () => void;
    }) => {
        // console.log('📢 showModal called:', { title, message, showCancel, onCancel });
        setModalInfo({ title, message, onClose, showCancel, onCancel });
    };

    const closeModal = () => {
        setModalInfo(null);
    };

    //~~~~~~~~~~~~~~~~~
    // ensure debounced definitions are stable across renders using useMemo
    const debouncedUpdateStats = useMemo(() => createDebouncedStatsUpdater(setAnnotationData), [setAnnotationData]);
    const debouncedShowScoreModal = useMemo(() => createDebouncedModalTrigger(setShowScoreModal), [setShowScoreModal]);

    //~~~~~~~~~~~~~~~~~
    const { servicesManager } = useSystem();
    const { measurementService, viewportGridService } = servicesManager.services;
    const activeViewportId = viewportGridService.getActiveViewportId();
    const measurementList = measurementService.getMeasurements(); 
    const measurementListRef = useRef([]);    
    const pendingAnnotationUIDRef = useRef<string | null>(null);
    const { cornerstoneViewportService, displaySetService } = servicesManager.services;


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
    const patientName = patientInfo?.PatientName;

    const userInfo = getUserInfo();

    //=========================================================
    // Call to hook to get the current series 
    const seriesInstanceUID = useCurrentSeriesUID({
        viewportGridService,
        displaySetService,
        cornerstoneViewportService,
        studyUID: studyInfo?.studyUID,
    });    

    //=========================================================
    // This call to the hook validates the series against the project
    //      The database holds the list of studyUIDs and the seriesUIDs within
    //      the study that are part of the project.
    //      The user is supposed to annotate only specific series
    const isSeriesValid = useSeriesValidation({
    studyUID: studyInfo?.studyUID,
    seriesUID: seriesInstanceUID,
    onValidated: (uid, valid) => {
        if (valid) {
        setValidatedSeriesUID(uid);
        } else {
        setValidatedSeriesUID(null);
        }
    },
    });

    //=========================================================
    useEffect(() => {
        if (!studyInfoFromHook?.studyUID ||
            !patientInfo?.PatientName
        ) {
            console.log('⏳ Waiting for full study info...');
            return;
        }

        const fullInfo = {
            ...studyInfoFromHook,
            patientName: patientInfo.PatientName,
            patientId: patientInfo.PatientID,
        };

        // console.log('✅ Setting full study info in Zustand:', fullInfo);
        setStudyInfo(fullInfo);
    }, [studyInfoFromHook, patientInfo]);

    //>>>>> for debug <<<<<
    // console.log('🧠 useStudyInfo() returned:', studyInfoFromHook);
    // console.log('📦 Zustand store currently holds:', studyInfo);


    //=========================================================

    // This effect validates the series against the project
    //      The database holds the list of studyUIDs and the seriesUIDs within
    //      the study that are part of the project.
    //      The user is supposed to annotate only specific series
    useEffect(() => {
        isSeriesValidRef.current = isSeriesValid;
    }, [isSeriesValid]);
    //=========================================================


    
    //=========================================================
    // Post status to wip when a new series is selected (if valid)

    useEffect(() => {
        if (!validatedSeriesUID || validatedSeriesUID !== seriesInstanceUID) return;
        if (!studyInfo?.studyUID) return;

        const postProgress = async () => {

            const progressData = await fetchStudyProgressFromDB({
                baseUrl: API_BASE_URL,
                username: userInfo.username,
                studyUID: studyInfo.studyUID,
            });

            console.log('📦 Progress data from hook:', progressData);

            if (progressData?.error) {
                console.warn('⚠️ Could not fetch progress:', progressData.error);
                return;
            }

            const currentSeriesProgress = progressData.series_progress?.find(
                entry => entry.seriesUID === seriesInstanceUID
            );

            if (currentSeriesProgress?.status === 'done') {
                console.log(`🛑 Series ${seriesInstanceUID} already marked as done — skipping wip post`);
                return;
            }

            console.log(`✅ Series ${seriesInstanceUID} validated — posting wip`);

            const progressResult = await postStudyProgress({
                baseUrl: API_BASE_URL,
                username: userInfo.username,
                studyUID: studyInfo.studyUID,
                seriesUID: seriesInstanceUID,
                status: 'wip',
            });

            if (progressResult?.error) {
                console.warn('⚠️ Failed to post progress:', progressResult.error);
            } else {
                console.log(`📌 Progress posted for ${seriesInstanceUID}`);
            }
        };

        postProgress();
    }, [validatedSeriesUID, studyInfo?.studyUID, seriesInstanceUID]);

    //=========================================================
    // Re-enable button when moving to a different series if valid

    useEffect(() => {
    const fetchProgress = async () => {
        if (!studyInfo?.studyUID || !seriesInstanceUID) return;

        const progressData = await fetchStudyProgressFromDB({
        baseUrl: API_BASE_URL,
        username: userInfo.username,
        studyUID: studyInfo.studyUID,
        });

        if (progressData?.error) {
        console.warn('⚠️ Could not fetch progress:', progressData.error);
        return;
        }

        const currentSeriesProgress = progressData.series_progress?.find(
        entry => entry.seriesUID === seriesInstanceUID
        );

        const isDone = currentSeriesProgress?.status === 'done';
        setSeriesAnnotationsCompleted(isDone);
    };

    fetchProgress();
    }, [studyInfo?.studyUID, seriesInstanceUID]);

    //=========================================================
    // add listeners with handlers
    useEffect(() => {
        if (!patientName) {
            console.log('⏳ Waiting for patientName before setting up listeners...');
            return;
        }

        const { measurementService } = servicesManager.services;

        const wrappedMeasurementAddedHandler = ({ measurement }: any) => 
            handleMeasurementAdded({
                measurement,
                measurementService,
                showModal,
                setActiveUID,
                debouncedShowScoreModal,
                pendingAnnotationUIDRef,
                isSeriesValidRef,
        });

        const wrappedAnnotationChangeHandler = (event: any) => handleAnnotationChange({
            event,
            setIsSaved,
            debouncedUpdateStats,
            setDropdownSelectionMap,
            setShowScoreModal,
            triggerPost,
            debouncedShowScoreModal,
            setActiveUID,
            pendingAnnotationUIDRef,
            isSeriesValidRef,
        });

        const wrappedAnnotationRemovedHandler = (event: any) => handleAnnotationRemove({
            event,
            setIsSaved,
            debouncedUpdateStats,
            setDropdownSelectionMap,
            triggerPost,
        });

        const subscription = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_ADDED,wrappedMeasurementAddedHandler);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, wrappedAnnotationChangeHandler);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, wrappedAnnotationRemovedHandler);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, wrappedAnnotationChangeHandler);

        return () => {
          subscription.unsubscribe();
          cornerstone.eventTarget.removeEventListener( cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, wrappedAnnotationChangeHandler);
          cornerstone.eventTarget.removeEventListener( cornerstoneTools.Enums.Events.ANNOTATION_REMOVED, wrappedAnnotationRemovedHandler);
          cornerstone.eventTarget.removeEventListener( cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED, wrappedAnnotationChangeHandler);
        }

    }, [patientName]);

    //=========================================================

    //=========================================================
    useEffect(() => {
        if (annotationData.length > 0) {
            setIsSaved(false);
        }
    }, [annotationData]);

    //=========================================================
    // watch for changes to the state properties
    // wait for all annotations to be loaded, then set to locked if user role is 'admin'
    useEffect(() => {
        if (!annotationsLoaded || userInfo?.role !== 'admin') return;

        annotation.state.getAllAnnotations().forEach(ann => {
            ann.isLocked = true;
        });

        console.log('🔒 All annotations locked for admin user:', userInfo.username);
    }, [userInfo, annotationsLoaded]);

    //=========================================================
    // ~~~~~~ fetch annotations from DB based on user role
    useEffect(() => {
        if (!userInfo?.username || !patientName) return;

        fetchAnnotationsFromDB({
        userInfo,
        patientName,
        baseUrl: API_BASE_URL,
        setListOfUsersAnnotations,
        setDropdownSelectionMap,
        annotation,
        setAnnotationsLoaded,
        });
    }, [userInfo, patientName]);


    //=========================================================
    // ~~~~~~ post annotations to DB
    // Memorize the trigger for POST to make sure all handlers who use
    //      triggerPost access it once the patientName is available 
    const triggerPost = useMemo(() => {
        if (!patientName) return null;

        return useAnnotationPosting({
            patientName,
            measurementListRef,
            setIsSaved,
        });
    }, [patientName, measurementListRef, setIsSaved]);

    //=========================================================
    const onMeasurementClick = (id: string) =>
        handleMeasurementClick({ 
            measurementId: id,
            annotation,
            measurementService,
            activeViewportId,
         });

    //=========================================================
    const onToggleVisibility = (uid: string) =>
        toggleVisibility({ uid, visibilityMap, setVisibilityMap, measurementService });

    //=========================================================
    const onCloseScoreModal = () =>
    closeScoreModal({
        activeUID,
        selectedScore,
        setSelectedScore,
        setDropdownSelectionMap,
        setShowScoreModal,
    });

    //=========================================================
    const onDropdownChange = (uid: string, value: number) => {
        if (!triggerPost) {
            console.warn('⏳ triggerPost not ready yet — skipping dropdown change post');
            return;
        }

        handleDropdownChange({
            uid,
            value,
            dropdownSelectionMap,
            setDropdownSelectionMap,
            triggerPost,
            annotation,
        });
    };    
    
    //=========================================================
    // when the extension is 
    // collapsed and reloaded. Then the scores can be 're-fetched' from the database
    useEffect(() => {
        const allAnnotations = annotation.state.getAllAnnotations?.() || [];
        const newMap = buildDropdownSelectionMapFromState(allAnnotations);
        setDropdownSelectionMap(newMap);
    }, []);


    //=========================================================
    ////////////////////////////////////////////
    return (
            <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowX: 'hidden',
                    padding: '0 0.5rem',
                }}
             >
            <MarkSeriesCompletedButton
                baseUrl={API_BASE_URL}
                getUserInfo={getUserInfo}
                studyInstanceUID={studyInfoFromHook?.studyUID}
                seriesInstanceUID={seriesInstanceUID}
                completed={isSeriesAnnotationsCompleted}
                setCompleted={setSeriesAnnotationsCompleted}
                onMarkCompleted={(studyUID, seriesInstanceUID) => {
                console.log(`🧠 Study ${studyUID}, Series ${seriesInstanceUID} marked as completed`);
                }}
                showModal={showModal}
                closeModal={closeModal}
                isSeriesValid={isSeriesValid}
            />
            <div className="text-white w-full text-center"
                 style={{ flexGrow: 1, minHeight: 0 }}
            >
            <AnnotationList
                measurementList={measurementList}
                dropdownSelectionMap={dropdownSelectionMap}
                visibilityMap={visibilityMap}
                scoreOptions={scoreOptions}
                onDropdownChange={onDropdownChange}
                onMeasurementClick={onMeasurementClick}
                onToggleVisibility={onToggleVisibility}
                triggerPost={triggerPost}
                annotation={annotation}
            />
            </div>
            <ScoreModal
            isOpen={showScoreModal}
            scoreOptions={scoreOptions}
            selectedScore={selectedScore}
            setSelectedScore={setSelectedScore}
            onClose={onCloseScoreModal}
            />
            {modalInfo && (
                <ModalComponent
                    title={modalInfo.title}
                    message={modalInfo.message}
                    onClose={modalInfo.onClose ?? closeModal}
                    showCancel={modalInfo.showCancel}
                    onCancel={modalInfo.onCancel}
                />
            )}
            </div>
    );

}


export default WebQuizSidePanelComponent;

