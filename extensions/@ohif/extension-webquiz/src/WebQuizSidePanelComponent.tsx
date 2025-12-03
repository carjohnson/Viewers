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
        getSeriesUIDFromMeasurement
        } from './utils/annotationUtils';

import MarkSeriesCompletedButton from './components/MarkSeriesCompletedButton';
import { useSeriesValidation } from './hooks/useSeriesValidation';
import { useCurrentSeriesUID } from './hooks/useCurrentSeriesUID';
import  useCustomizeAnnotationMenu  from './hooks/useCustomizeAnnotationMenu'
import { postStudyProgress, fetchStudyProgressFromDB } from './handlers/studyProgressHandlers';
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
    const isSeriesValidRef = useRef<boolean | null>(null);
    const [validatedSeriesUID, setValidatedSeriesUID] = useState(null);
    const [activeViewportId, setActiveViewportId] = useState<string | null>(null);

    const { servicesManager } = useSystem();
    const { measurementService, viewportGridService } = servicesManager.services;
    const measurementList = measurementService.getMeasurements(); 
    const measurementListRef = useRef([]);    
    const pendingAnnotationUIDRef = useRef<string | null>(null);
    const { cornerstoneViewportService, displaySetService } = servicesManager.services;
    const listOfUsersAnnotationsRef = useRef<any>(null);

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
            activeViewportId,
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
            isSeriesAnnotationsCompletedRef,
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
        isSeriesAnnotationsCompletedRef,
        measurementService,
        showModal,
        debouncedUpdateStats,
        setDropdownSelectionMap,
        triggerPost,
    });




    //=========================================================
    // set up useEffect hooks to manage gathering all data from services
    //  as the other components may be updating asynchronously and this
    //  component needs to be subscribed to those updates




    
    //=========================================================
    // When the extension is collapsed and reloaded,
    //  then the scores can be 're-fetched' from the database
    useEffect(() => {
        const allAnnotations = annotation.state.getAllAnnotations?.() || [];
        const newMap = buildDropdownSelectionMapFromState(allAnnotations);
        setDropdownSelectionMap(newMap);
    }, []);

    




    
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
    useEffect(() => {
        isSeriesAnnotationsCompletedRef.current = isSeriesAnnotationsCompleted;
    }, [isSeriesAnnotationsCompleted]);


    //=========================================================

    //=========================================================
    // wait for all annotations to be loaded, then set to locked 
    //     if the selected series has been marked as completed
    useEffect(() => {
    let subscription: any;

    const hydrateAndLockAnnotations = async () => {
        // 1️⃣ Wait until annotations are loaded
        if (!annotationsLoaded) {
        console.log('[annotationViewportSetup] annotations not yet loaded, skipping');
        return;
        }

        // 2️⃣ Get the active viewport
        const initialViewportId = viewportGridService.getActiveViewportId?.();
        setActiveViewportId(initialViewportId);
        console.log('[annotationViewportSetup] activeViewportId:', initialViewportId);

        // Subscribe to viewport changes
        subscription = viewportGridService.subscribe(
        viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
        (evt: { viewportId: string }) => {
            setActiveViewportId(evt.viewportId);
        }
        );

        // 3️⃣ Fetch progress data
        if (!studyInfo?.studyUID || !seriesInstanceUID) return;

        try {
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
        isSeriesAnnotationsCompletedRef.current = isDone;

        // 4️⃣ Lock annotations
        const allAnnotations = annotation.state.getAllAnnotations();
        allAnnotations.forEach(ann => {
            const annSeriesUID = getSeriesUIDFromMeasurement(ann);
            if (annSeriesUID !== seriesInstanceUID) return;
            ann.isLocked = userInfo?.role === 'admin' || isDone;
        });

        //   // Notify tools to refresh
        //     triggerAnnotationModified(allAnnotations);


        console.log(
            `${isDone ? '🔒' : '🔓'} Locked annotations for series ${seriesInstanceUID}`
        );
        } catch (err) {
        console.error('[annotationViewportSetup] Error fetching progress or locking:', err);
        }
    };

    hydrateAndLockAnnotations();

    return () => {
        subscription?.unsubscribe?.();
    };
    }, [annotationsLoaded, studyInfo?.studyUID, seriesInstanceUID, viewportGridService, userInfo?.role]);


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
            isSeriesAnnotationsCompletedRef,
        });

        const wrappedMeasurementRemovedHandler = ({ measurement } : any) => handleMeasurementRemoved({
            measurement,
            measurementService,
            setDropdownSelectionMap,
            triggerPost,
        });

        const wrappedAnnotationChangedHandler = (event: any) => handleAnnotationChanged({
            event,
            debouncedUpdateStats,
            pendingAnnotationUIDRef,
            isSeriesAnnotationsCompletedRef,
            seriesInstanceUID,
        });

        const subscriptionAdd = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_ADDED,wrappedMeasurementAddedHandler);
        const subscriptionRemove = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_REMOVED,wrappedMeasurementRemovedHandler);
        cornerstone.eventTarget.addEventListener(cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED, wrappedAnnotationChangedHandler);


        return () => {
          subscriptionAdd.unsubscribe();
        }

    }, [patientName, studyInfo?.studyUID, seriesInstanceUID]);




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
                isSeriesAnnotationsCompleted={isSeriesAnnotationsCompleted}
                setSeriesAnnotationsCompleted={setSeriesAnnotationsCompleted}
                isSeriesAnnotationsCompletedRef={isSeriesAnnotationsCompletedRef}
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

