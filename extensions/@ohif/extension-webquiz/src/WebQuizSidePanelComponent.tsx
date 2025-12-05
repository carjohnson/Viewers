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
import { handleMeasurementAdded, handleAnnotationChanged, handleMeasurementRemoved } from './handlers/annotationEventHandlers';

import { createDebouncedStatsUpdater,
        createDebouncedShowScoreModalTrigger,
        buildDropdownSelectionMapFromState,
        getSeriesUIDFromMeasurement,
        lockAllAnnotations,
        } from './utils/annotationUtils';

import MarkSeriesCompletedButton from './components/MarkSeriesCompletedButton';
import MarkStudyCompletedButton from './components/MarkStudyCompletedButton';
import { useSeriesValidation } from './hooks/useSeriesValidation';
import { useCurrentSeriesUID } from './hooks/useCurrentSeriesUID';
import  useCustomizeAnnotationMenu  from './hooks/useCustomizeAnnotationMenu'
import { postStudyProgress, postSeriesProgress, fetchStudyProgressFromDB } from './handlers/studyProgressHandlers';
import { ModalComponent } from './components/ModalComponent';


function WebQuizSidePanelComponent() {

    // ************************************************************
    // ****************** Initializing ******************
    // ************************************************************
    const [annotationData, setAnnotationData] = useState<AnnotationStats[]>([]);
    const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
    const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
    const [dropdownSelectionMap, setDropdownSelectionMap] = useState<Record<string, number>>({});
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [selectedScore, setSelectedScore] = useState<number | null>(null);
    const [activeUID, setActiveUID] = useState<string | null>(null);
    const [listOfUsersAnnotations, setListOfUsersAnnotations] = useState(null);
    const [isSeriesAnnotationsCompleted, setSeriesAnnotationsCompleted] = useState(false);
    const isSeriesAnnotationsCompletedRef = useRef(isSeriesAnnotationsCompleted);
    const [isStudyCompleted, setStudyCompleted] = useState(false);
    const isStudyCompletedRef = useRef(isStudyCompleted);
    const isSeriesValidRef = useRef<boolean | null>(null);
    const [validatedSeriesUID, setValidatedSeriesUID] = useState(null);
    const [activeViewportId, setActiveViewportId] = useState<string | null>(null);
    const activeViewportIdRef = useRef<string | null>(null);

    const { servicesManager } = useSystem();
    const { measurementService, viewportGridService } = servicesManager.services;
    const measurementList = measurementService.getMeasurements(); 
    const measurementListRef = useRef([]);    
    const pendingAnnotationUIDRef = useRef<string | null>(null);
    const { cornerstoneViewportService, displaySetService } = servicesManager.services;
    const listOfUsersAnnotationsRef = useRef<any>(null);
    const [dropdownMapVersion, setDropdownMapVersion] = useState(0);


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
        setModalInfo({ title, message, onClose, showCancel, onCancel });
    };

    const closeModal = () => {
        setModalInfo(null);
    };

    //~~~~~~~~~~~~~~~~~
    const scoreOptions = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
    ];




    // ************************************************************
    // ********************* Study metadata ***********************
    // ************************************************************

    //=========================================================
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
    // This useEffect will keep the patient and study metadata
    //      up-to-date
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

    // //>>>>> for debug <<<<<
    // console.log('🧠 useStudyInfo() returned:', studyInfoFromHook);
    // console.log('📦 Zustand store currently holds:', studyInfo);



    // ************************************************************
    // ****************** series validation ***********************
    // ************************************************************
    //=========================================================
    // Call to hook to get the current series 
    const seriesInstanceUID = useCurrentSeriesUID({
        viewportGridService,
        displaySetService,
        cornerstoneViewportService,
        studyUID: studyInfo?.studyUID,
        isSeriesAnnotationsCompletedRef,
        setSeriesAnnotationsCompleted,
    });    

    //=========================================================
    // This call to the hook validates the series against those in the database.
    //      The database holds the list of studyUIDs and the seriesUIDs within
    //      the study that are to be annotated.
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
    // This effect keeps the ref mirrored with the series validation state
    useEffect(() => {
        isSeriesValidRef.current = isSeriesValid;
    }, [isSeriesValid]);
    

    // ************************************************************
    // ********************** Annotations *************************
    // ************************************************************

    //=========================================================
    // fetch annotations from DB based on user role
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
        listOfUsersAnnotationsRef,
        });
    }, [userInfo, patientName]);

    //=========================================================
    // Memorize the trigger for POST of annotations to the database
    //      to make sure all handlers who use
    //      triggerPost access it once the patientName is available 
    const triggerPost = useMemo(() => {
        try {
            if (!patientName) return null;

            const userInfo = getUserInfo();
            if (userInfo?.role === 'admin') {
            console.warn('🚫 Admins cannot post to database');
            // Return a no‑op function instead of undefined
            return () => {
                console.warn('Post suppressed for admin role');
            };
            }

            return useAnnotationPosting({
            patientName,
            measurementListRef,
            });
        } catch (err) {
            console.error('Error initializing annotation posting:', err);
            // Return a safe fallback so OHIF doesn’t explode
            return () => {
            console.error('Annotation posting unavailable due to error');
            };
        }
    }, [patientName, measurementListRef]);

    //=========================================================
    // ensure debounced definitions are stable across renders using useMemo

    //~~~~~~~~~~~~~~~~~
    const debouncedUpdateStats = useMemo(
        () => createDebouncedStatsUpdater(setAnnotationData, setDropdownSelectionMap, triggerPost),
        [setAnnotationData, setDropdownSelectionMap, triggerPost]
    );

    //~~~~~~~~~~~~~~~~~
    const debouncedShowScoreModal = useMemo(
        () => createDebouncedShowScoreModalTrigger(setShowScoreModal, pendingAnnotationUIDRef),
        [setShowScoreModal, pendingAnnotationUIDRef]
    );

    //~~~~~~~~~~~~~~~~~
    const onMeasurementClick = (id: string) => 
        handleMeasurementClick({ 
            measurementId: id,
            annotation,
            measurementService,
            activeViewportIdRef,
            viewportGridService,
         });
        
    //~~~~~~~~~~~~~~~~~
    const onToggleVisibility = (uid: string) =>
        toggleVisibility({ uid, visibilityMap, setVisibilityMap, measurementService });

    //~~~~~~~~~~~~~~~~~
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
            isStudyCompletedRef,
            showModal,
        });
    };    

    //~~~~~~~~~~~~~~~~~
    const onCloseScoreModal = () =>
    closeScoreModal({
        activeUID,
        selectedScore,
        setSelectedScore,
        setDropdownSelectionMap,
        setShowScoreModal,
    });

    //~~~~~~~~~~~~~~~~~
    useCustomizeAnnotationMenu ({
        userInfo,
        isStudyCompletedRef,
        measurementService,
        showModal,
    });




    //=========================================================
    // set up useEffect hooks to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates

    
    // //=========================================================

    
    // //=========================================================
    // // // Watch for changes to the viewports (eg. when changing studies or series)
    // //=========================================================
    // // Re-enable button when moving to a different series if valid

    //=========================================================
    // Post status to database as wip when a new series is selected (if valid)
    //  Leave any series already marked as "done"
    useEffect(() => {
        if (!validatedSeriesUID || validatedSeriesUID !== seriesInstanceUID) return;
        if (!studyInfo?.studyUID) return;


        const postProgress = async () => {
            // if (userInfo?.role === 'admin') {
            //     console.log('🚫 Admins cannot post study progress — skipping');
            //     return;
            // }

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

            const progressResult = await postSeriesProgress({
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
    // mirroring the state to use current setting when series has been selected
    useEffect(() => {
        isSeriesAnnotationsCompletedRef.current = isSeriesAnnotationsCompleted;
    }, [isSeriesAnnotationsCompleted]);

    //=========================================================
    // mirroring the state to use current setting when button is pressed
    useEffect(() => {
        isStudyCompletedRef.current = isStudyCompleted;
    }, [isStudyCompleted]);


    //=========================================================
    // rebuild the dropdown score map whenever there are changes to annotations
    //      being loaded or if the viewport id has changed 
    useEffect(() => {
    if (!annotationsLoaded) return;

    const subscription = viewportGridService.subscribe(
        viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
        (evt: { viewportId: string }) => {
        setActiveViewportId(evt.viewportId);
        activeViewportIdRef.current = evt.viewportId;

        const allAnnotations = annotation.state.getAllAnnotations?.() || [];
        const newMap = buildDropdownSelectionMapFromState(allAnnotations);
        setDropdownSelectionMap(newMap);
        }
    );

    return () => subscription.unsubscribe();
    }, [annotationsLoaded, viewportGridService]);

    //=========================================================
    // hydrate + lock annotations when series/annotations change
    //      wait for all annotations to be loaded, then set to locked 
    //      if the study has been marked as completed
    useEffect(() => {
    const hydrateAndLockAnnotations = async () => {
        if (!annotationsLoaded || !studyInfo?.studyUID || !seriesInstanceUID) {
        console.log('[annotationViewportSetup] prerequisites not ready, skipping');
        return;
        }

        // One-time fetch + lock
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

        const isSeriesDone = currentSeriesProgress?.status === 'done';
        setSeriesAnnotationsCompleted(isSeriesDone);
        isSeriesAnnotationsCompletedRef.current = isSeriesDone;


        const isStudyDone = progressData?.study_status === 'done';
        setStudyCompleted(isStudyDone);
        isStudyCompletedRef.current = isStudyDone;
        // console.log(' *** IN HYDRATE seriesProgress, studyProgress:', isSeriesAnnotationsCompletedRef.current, isStudyCompletedRef.current)

        lockAllAnnotations({annotation, userInfo, isStudyCompletedRef});

        console.log(
        `${isStudyCompletedRef.current ? '🔒' : '🔓'} Lock state annotations for study ${studyInfo?.studyUID}`
        );
    };

    hydrateAndLockAnnotations();
    }, [annotationsLoaded, studyInfo?.studyUID, seriesInstanceUID, userInfo?.role, viewportGridService]);

    //=========================================================
    // When the extension is collapsed and reloaded,
    //  then the scores can be 're-fetched' from the database
    useEffect(() => {
        const allAnnotations = annotation.state.getAllAnnotations?.() || [];
        const newMap = buildDropdownSelectionMapFromState(allAnnotations);
        setDropdownSelectionMap(newMap);
    }, [dropdownMapVersion]);


    //=========================================================



    //=========================================================
    // add listeners with handlers
    useEffect(() => {
        if (!patientName) {
            console.log('⏳ Waiting for patientName before setting up listeners...');
            return;
        }

        const { measurementService } = servicesManager.services;

        const wrappedMeasurementAddedHandler = ({ measurement }: any) => handleMeasurementAdded({
            measurement,
            measurementService,
            showModal,
            setActiveUID,
            debouncedShowScoreModal,
            pendingAnnotationUIDRef,
            isSeriesValidRef,
            listOfUsersAnnotationsRef,
            isStudyCompletedRef,
        });

        const wrappedMeasurementRemovedHandler = ({ measurement } : any) => handleMeasurementRemoved({
            measurement,
            setDropdownSelectionMap,
            triggerPost,
        });

        const wrappedAnnotationChangedHandler = (event: any) => handleAnnotationChanged({
            event,
            debouncedUpdateStats,
            pendingAnnotationUIDRef,
        });

        const subscriptionAdd = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_ADDED,wrappedMeasurementAddedHandler);
        const subscriptionRemove = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_REMOVED,wrappedMeasurementRemovedHandler);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, wrappedAnnotationChangedHandler);


        return () => {
          subscriptionAdd.unsubscribe();
          subscriptionRemove.unsubscribe();
          cornerstone.eventTarget.removeEventListener( cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, wrappedAnnotationChangedHandler);
        }

    }, [patientName, studyInfo?.studyUID]);




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
            <MarkStudyCompletedButton
                baseUrl={API_BASE_URL}
                getUserInfo={getUserInfo}
                studyInstanceUID={studyInfoFromHook?.studyUID}
                isStudyCompleted={isStudyCompleted}
                setStudyCompleted={setStudyCompleted}
                isStudyCompletedRef={isStudyCompletedRef}
                onMarkCompleted={(studyInstanceUID) => {
                    lockAllAnnotations({ annotation, userInfo, isStudyCompletedRef });
                    setDropdownMapVersion(v => v + 1); // triggers effect after render
                }}
                showModal={showModal}
                closeModal={closeModal}
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
            pendingAnnotationUIDRef={pendingAnnotationUIDRef}
            setDropdownSelectionMap={setDropdownSelectionMap}
            triggerPost={triggerPost}
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

