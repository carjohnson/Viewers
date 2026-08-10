import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';

import './WebQuizSidePanelComponent.css';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { annotation } from '@cornerstonejs/tools';
import { useStudyInfoStore } from './stores/useStudyInfoStore';
import { useStudyInfo } from './hooks/useStudyInfo';
import { useSegmentationLoadStore } from './stores/useSegmentationLoadStore';
import { usePatientInfo } from '@ohif/extension-default';
import { API_BASE_URL } from './config/config';
import { AnnotationStats } from './models/AnnotationStats';
import { setUserInfo, getUserInfo, onUserInfoReady } from './../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { useAnnotationPosting } from './hooks/useAnnotationPosting';
import { fetchAnnotationsFromDB, convertAnnotationsToMeasurements } from './handlers/fetchAnnotations';
import { handleDropdownChange } from './handlers/dropdownHandlers';
import { handleMeasurementClick, toggleVisibility, closeScoreModal } from './handlers/guiHandlers';
import { handleSegmentClick } from './handlers/segmentationHandlers';
import { useSystem } from '@ohif/core';
import { AnnotationList } from './components/AnnotationList/AnnotationList';
import { SegmentationList } from './components/SegmentationList/SegmentationList'
import { ScoreModal } from './components/ScoreModal';
import { handleMeasurementAdded,
        handleAnnotationChanged,
        handleMeasurementRemoved,
        handleMeasurementUpdated,
       } from './handlers/annotationEventHandlers';
import { ToolGroupManager } from '@cornerstonejs/tools';
import { base64ToArrayBuffer } from './utils/dataUtils';
import { loadDicomSegIntoOHIF,
            refreshSegmentMetadataStore,
            saveAllSegmentations,
            getImageIdsForSeries,
            waitForImagesLoaded } from './utils/segmentationUtils';
import { measurementScoreOptions } from './models/ScoreOptions';
import { groundTruthOptions, referenceStandardMethodOptions, hepaticSegmentOptions } from './models/ScoreOptions';



import { createDebouncedStatsUpdater,
        createDebouncedShowScoreModalTrigger,
        buildDropdownSelectionMapFromState,
        getSeriesUIDFromMeasurement,
        lockAllAnnotations,
        } from './utils/annotationUtils';

import MarkSeriesCompletedButton from './components/MarkSeriesCompletedButton';
import MarkStudyCompletedButton from './components/MarkStudyCompletedButton';
// import SaveSegmentationsButton from './components/SaveSegmentationsButton';
import { useSeriesValidation } from './hooks/useSeriesValidation';
import { useViewportAndSeriesSync } from './hooks/useViewportAndSeriesSync';
import  useCustomizeAnnotationMenu  from './hooks/useCustomizeAnnotationMenu'
import { postSeriesProgress,
            fetchStudyProgressFromDB,
            postTimedEvent,
            fetchSeriesToBeAnnotatedFromDB, } from './handlers/studyHandlers';
import { ModalComponent } from './components/ModalComponent';
import { TriggerPostArgs } from './models/TriggerPostArgs';
import { extensionManager } from 'platform/app/src/App';


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
    const [isStudyCompleted, setStudyCompleted] = useState(false);
    const isStudyCompletedRef = useRef(isStudyCompleted);
    const isSeriesValidRef = useRef<boolean | null>(null);
    const [validatedSeriesUID, setValidatedSeriesUID] = useState(null);

    const { servicesManager, commandsManager } = useSystem();
    const { measurementService, viewportGridService, segmentationService, toolGroupService } = servicesManager.services;
    const measurementList = measurementService.getMeasurements(); 
    const measurementListRef = useRef([]);    
    const segmentationList = segmentationService.getSegmentations();
    const pendingAnnotationUIDRef = useRef<string | null>(null);
    const { cornerstoneViewportService, displaySetService } = servicesManager.services;
    const listOfUsersAnnotationsRef = useRef<any>(null);
    const [dropdownMapVersion, setDropdownMapVersion] = useState(0);


    const [isMinimized, setIsMinimized] = useState(false);


    //~~~~~~~~~~~~~~~~~
     const [modalInfo, setModalInfo] = useState<null | { 
        title: string;
        message: React.ReactNode;
        onClose?: () => void;
        showCancel?: boolean;
        onCancel?: () => void;
        confirmText?: string;
    }>(null);
    const showModal = ({
        title,
        message,
        onClose,
        showCancel = false,
        onCancel,
        confirmText = "OK",
    }: {
        title: string;
        message: React.ReactNode;
        onClose?: () => void;
        showCancel?: boolean;
        onCancel?: () => void;
        confirmText?: string;
    }) => {
        setModalInfo({ title, message, onClose, showCancel, onCancel, confirmText });
    };

    const closeModal = () => {
        setModalInfo(null);
    };

    // ************************************************************
    // *********************  Initializing  ***********************
    // ************************************************************
    /**
     * use Effect to return the mouse to the default window/level tool
     * when re-entering the extension. 
     *      (This disables the segmentation tool that may be left on 
     *      when returning to this extension.)
     */
    useEffect(() => {
        const userInfo = getUserInfo();
            if (userInfo?.role === 'admin') {

                const toolGroup = toolGroupService?.getToolGroup();

                const segTools = [
                    // 'Brush',
                    // 'Eraser',
                    // 'Threshold',
                    'SphereBrush',
                    'SphereEraser',
                    'ThresholdSphereBrush',
                    'CircularBrush',
                    'SphereBrush',
                    'ThresholdSphereBrushDynamic',
                    ];

                segTools.forEach(toolName => {
                    toolGroup?.setToolPassive(toolName);
                });

                toolGroup?.setToolActive('WindowLevel', {
                    bindings: [{ mouseButton: 1 }],
                });

            }
        }, [toolGroupService]);


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
    const patientName = useStudyInfoStore(state => state.studyInfo?.patientName);
    const studyUID = studyInfo?.studyUID;

    const { setSeriesToBeAnnotatedUIDs } = useStudyInfoStore();
    const seriesFetchRequestId = useRef(0);

    const userInfo = getUserInfo();


    const loadStudyUID = studyUID ?? '';
    const hasLoadedSegmentations = useSegmentationLoadStore((state: any) =>
        loadStudyUID ? state.hasLoadedInitialSegmentations[loadStudyUID] : false);
    
    //=========================================================
    // This useEffect will keep the patient and study metadata up-to-date
    //      if the user selects a different study.
    //      Store in Zustand so that the metadata is persistent across extensions.
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
            seriesToBeAnnotatedUIDs: studyInfo?.seriesToBeAnnotatedUIDs,
        };

        console.log('✅ Setting full study info in Zustand:', fullInfo);
        setStudyInfo(fullInfo);

    }, [studyInfoFromHook, patientInfo,studyInfo?.seriesToBeAnnotatedUIDs]);



    //=========================================================
    useEffect(() => {
        if (!studyUID) return;
        
        console.log('📊 Reset check: studyUID=', studyUID);
        useSegmentationLoadStore.getState().resetForNewStudy(studyUID);
    }, [studyUID]);


    //=========================================================
    useEffect(() => {
        const currentStudyUID = studyUID;
        if (!currentStudyUID) return;

        const requestId = ++seriesFetchRequestId.current;

        fetchSeriesToBeAnnotatedFromDB({baseUrl:API_BASE_URL, studyUID: currentStudyUID}) // your DB call, TBD
            .then((seriesUIDs) => {
            // bail if a newer study was selected before this resolved
            if (requestId !== seriesFetchRequestId.current) return;
            setSeriesToBeAnnotatedUIDs(seriesUIDs);
            })
            .catch((err) => {
            console.error('Failed to fetch series to annotate', err);
            });
    }, [studyUID]);


    // //>>>>> for debug <<<<<
    // console.log('🧠 useStudyInfo() returned:', studyInfoFromHook);
    // console.log('📦 Zustand store currently holds:', studyInfo);

    // ************************************************************
    // ************* Viewports and Series *************************
    // ************************************************************
    //=========================================================

    const {
        activeViewportId,
        activeViewportIdRef,
        seriesInstanceUID,
        activeViewportImageIds,
    } = useViewportAndSeriesSync({viewportGridService, displaySetService, cornerstoneViewportService});

    //=========================================================
    // This call to the hook validates the series against those in the database.
    //      The database holds the list of studyUIDs and the seriesUIDs within
    //      the study that are to be annotated.


    // to gate validation
    const shouldValidate =
    Boolean(activeViewportId) &&
    Boolean(seriesInstanceUID) &&
    Boolean(studyUID);


    // to avoid unnecessary re-runs when nothing meaningful changes
    const validationInput = useMemo(() => {
        const input = {
            studyUID,
            seriesUID: shouldValidate ? seriesInstanceUID : null,
        };
        return input;
    }, [studyUID, seriesInstanceUID, shouldValidate]);


    const isSeriesValid = useSeriesValidation({
        ...validationInput,
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
    const postingApi = useAnnotationPosting({
        studyUID,
        measurementListRef,
    });

    // fetch annotations from DB based on user role
    // Dependencies - rerun this if the study changes
    useEffect(() => {
        // console.log(' *** IN USE EFFECT FOR FETCH ... annloaded flag, studyUID', annotationsLoaded, studyUID);
        
        if (!studyUID) {
            setAnnotationsLoaded(false);
            return;
        }

        // reset for new patient / study
        setAnnotationsLoaded(false);

        fetchAnnotationsFromDB({
        userInfo,
        studyUID,
        baseUrl: API_BASE_URL,
        setListOfUsersAnnotations,
        setDropdownSelectionMap,
        setAnnotationsLoaded,
        listOfUsersAnnotationsRef,

        });

    }, [userInfo?.username, studyUID, viewportGridService]);

    //=========================================================
    // To convert the stored annotation object from the db into a measurement object
    //  - Dependency of viewportGridService is required for the jumpToMeasurement functionality when
    //      working with multi-series studies
    //  - Rerun this when the study changes

useEffect(() => {
    // console.log(' *** IN USE EFFECT FOR CONVERT ... annLoaded, studyUID', annotationsLoaded, studyUID)
    if (!annotationsLoaded || !studyUID) {
        return;
    }

    const runConversion = () => {
        // console.log('🚀 Converting annotations for study:', studyUID);
        convertAnnotationsToMeasurements({
            annotationsList: listOfUsersAnnotationsRef,
            measurementService,
            displaySetService,
            onComplete: () => { console.log('🎉 Conversion complete'); },
            onError: (error) => { console.error('Conversion failed:', error); },
        });
    };

    // Fast path: convert whatever is already resolvable right now. If every
    // referenced series already has a displaySet (the common case), this is
    // the only call that runs and nothing waits on the subscription below.
    runConversion();

    // Re-run conversion every time OHIF registers more display sets, in case
    // some of the fetched annotations reference series that weren't ready
    // yet on the call above. This covers the race condition: opening the
    // extension immediately after the study mounts, before all series have
    // been registered with DisplaySetService.
    const { unsubscribe } = displaySetService.subscribe(
        displaySetService.EVENTS.DISPLAY_SETS_ADDED,
        () => {
            // console.log('📦 DISPLAY_SETS_ADDED fired — retrying annotation conversion');
            runConversion();
        }
    );

    return () => {
        unsubscribe();
    };
    // Intentionally NOT depending on displaySetService/measurementService
    // identity here, same as the original effect — only re-run when the
    // study or load-completion state actually changes.
}, [annotationsLoaded, studyUID]);



    //=========================================================
    // Use a callback for the trigger for POST of annotations to the database
    //      to make sure all handlers who use
    //      triggerPost access it once the studyUID is available 
    const triggerPost = useCallback((message: TriggerPostArgs) => {
        if (!studyUID || !postingApi) return;
        const userInfo = getUserInfo();
        if (userInfo?.role === 'admin') {
            console.warn('Post of annotations suppressed for admin role');
            return;
        }
        if (isStudyCompletedRef.current) {
            console.warn('Post of annotations suppressed - study marked as complete');
            return;
        }
        postingApi(message);
    }, [studyUID, postingApi]);


    // ************************************************************
    // ********************* Segmentations ************************
    // ************************************************************


    const loadingSegmentationRef = useRef(false);
    useEffect(() => {
        async function loadSegmentations() {
            const username = userInfo?.username;

            // check everything needed BEFORE doing any work
            if (!username || !studyUID || !activeViewportId || !seriesInstanceUID) {
                return;
            }

            const currentLoaded = useSegmentationLoadStore.getState().getLoadedForStudy(studyUID);
            if (currentLoaded || loadingSegmentationRef.current) return;

            loadingSegmentationRef.current = true;
            try {
                const res = await fetch(
                 `${API_BASE_URL}/webquiz/list-study-segmentations?username=${username}&studyUID=${studyUID}`,
                 { credentials: 'include' }
                );
                const { payload } = await res.json();

                for (const seg of payload) {
                    console.log(' *** IN FETCH SEGS ... url', seg.segmentationFileUrl);
                    
                    //  ensure all images have been loaded for the series before the fetched segmentation is loaded into OHIF
                    const imageIds = getImageIdsForSeries(displaySetService, seg.referencedSeriesUID);
                        if (imageIds.length === 0) {
                            console.warn('No display set / imageIds found yet for', seg.referencedSeriesUID);
                            // optionally: poll/wait for displaySetService to have it, then retry
                        } else {
                            await waitForImagesLoaded(imageIds);
                        }

                    const res = await fetch(
                    `${API_BASE_URL}/webquiz/get-segmentation-file?segmentationId=${seg.segmentationId}`,
                    { credentials: 'include' }
                    );
                    if (!res.ok) throw new Error('Failed to fetch SEG file');

                    const arrayBuffer = await res.arrayBuffer();
                    await loadDicomSegIntoOHIF({
                        segmentationId: seg.segmentationId,
                        referencedSeriesInstanceUID: seg.referencedSeriesUID,
                        segmentationLabel: seg.segmentationLabel,
                        segmentMetadata: seg.dbSegmentInfo,
                        servicesManager,
                        arrayBuffer,
                        activeViewportId,
                        viewportGridService,
                    });
                }
                // flag set to true after load
                // - even if there were no entries in the database (starting fresh)
                useSegmentationLoadStore.getState().setLoaded(studyUID, true);
            } catch (err) {
                console.error('❌ Error fetching segmentations:', err);
            } finally {
                loadingSegmentationRef.current = false;
            }
        }
        loadSegmentations();
    }, [userInfo?.username, studyUID, activeViewportId, seriesInstanceUID]);


    //~~~~~~~~~~~~~~~~~
    useEffect(() => {
        // save all segmentations when extension is mounted
        if (!activeViewportId) return; 
        if (!studyInfoFromHook?.studyUID) return;
        if (!hasLoadedSegmentations ) return;

        // Give the segmentationservice a moment to finish add/remove
        const timerId = setTimeout(() => {

        // refresh the metadata store - save segmentations if required
        const bSaveRequired = refreshSegmentMetadataStore(segmentationService);

       if (bSaveRequired) {
            saveAllSegmentations({
            segmentationService,
            viewportGridService,
            displaySetService,
            activeViewportId,
            commandsManager,
            studyInstanceUID: studyInfoFromHook?.studyUID,
            });
            console.log(' *** IN USEEFFECT FOR SAVE SEGS');

        }

        }, 500); // small delay, adjust as needed - temporary - change to event listeners? or remove?
        return () => clearTimeout(timerId);
    }, [hasLoadedSegmentations , activeViewportId, studyInfoFromHook?.studyUID]);


    //~~~~~~~~~~~~~~~~~
    const onSegmentClick = (id: string, segmentationLabel: string, segmentLabel: string, segmentArrayIndex: number, segmentIndex: number) => 
        handleSegmentClick({ 
            segmentationId: id,
            segmentationLabel,
            segmentLabel,
            segmentArrayIndex,
            segmentIndex,
            showModal,
            closeModal,
            groundTruthOptions,
            referenceStandardMethodOptions,
            hepaticSegmentOptions,
            servicesManager,
            commandsManager,
            segmentationService,
            activeViewportId,
            studyInstanceUID:studyInfoFromHook?.studyUID,
            isStudyCompleted: isStudyCompletedRef.current,
        });
            
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
    const handleScoreClick = (uid: string, currentScore: number | null) => {
    setSelectedScore(currentScore);
    debouncedShowScoreModal(uid);
    };

    //~~~~~~~~~~~~~~~~~
    const rebuildDropdownMap = () => {
        const allAnnotations = annotation.state.getAllAnnotations?.() || [];
        const newMap = buildDropdownSelectionMapFromState(allAnnotations);
        setDropdownSelectionMap(newMap);
    };

    //~~~~~~~~~~~~~~~~~
    const onCloseScoreModal = (selectedUid: string) =>
    closeScoreModal({
        activeUID: selectedUid,
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
    //      (Remnants of functionality of flagging individual series as done.
    //       This was changed to mark the entire study as done when button is clicked.)
    useEffect(() => {
        if (!validatedSeriesUID || validatedSeriesUID !== seriesInstanceUID) return;
        if (!studyUID) return;


        const postProgress = async () => {

            const progressData = await fetchStudyProgressFromDB({
                baseUrl: API_BASE_URL,
                username: userInfo.username,
                studyUID,
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
    }, [validatedSeriesUID, studyUID, seriesInstanceUID]);

    //=========================================================
    // mirroring the state to use current setting when button is pressed
    useEffect(() => {
        isStudyCompletedRef.current = isStudyCompleted;
    }, [isStudyCompleted]);

    //=========================================================
    // Capture & post the time when the study was opened and closed
    // NOTE:
    // 'pagehide' listener captures user events like tab close or browser close. 
    //      It will fire off a 'visibilitychange' event first as part of the 
    //      tear-down then the 'pagehide' event will fire. This app logs 
    //      the first event as 'visibility_lost' and does not have time to log 'browser_close'
    useEffect(() => {
        if (!studyUID || !userInfo?.username) return;

        const setCurrentStudyAndPostOpened = async () => {
            try {
                await fetch(`${API_BASE_URL}/users/session-study`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studyUID }),
                });

                await postTimedEvent({
                    baseUrl: API_BASE_URL,
                    username: userInfo.username,
                    studyUID,
                    event: 'open',
                    method: 'enter_extension',
                });
            } catch (error) {
                console.error('❌ Error setting current study / posting opened:', error);
            }
        };

        setCurrentStudyAndPostOpened();

        // sessionOpen tracks current open/close state so re-entering the tab
        // can post a fresh 'open', and so we don't double-post a close.
        let sessionOpen = true;

        const postCloseOnce = (method) => {
            if (!sessionOpen) return;
            sessionOpen = false;
            postTimedEvent({
                baseUrl: API_BASE_URL,
                username: userInfo.username,
                studyUID,
                event: 'close',
                method,
            });
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Fires on tab switch, minimize, tab close, browser close.
                // Can't fully distinguish "closing" from "backgrounding" here.
                postCloseOnce('visibility_lost');
            } else if (document.visibilityState === 'visible' && !sessionOpen) {
                sessionOpen = true;
                postTimedEvent({
                    baseUrl: API_BASE_URL,
                    username: userInfo.username,
                    studyUID,
                    event: 'open',
                    method: 'visibility_regained',
                });
            }
        };

        const handlePageHide = () => {
            // Fires specifically on unload (tab/browser close, navigation away)
            postCloseOnce('browser_close');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);

            if (!studyUID || !userInfo?.username) return;
            // In-app unmount (e.g. navigating to OHIF's study browser)
            postCloseOnce('exit_extension');
        };
    }, [studyUID, userInfo?.username]);



    //=========================================================
    // rebuild the dropdown score map whenever there are changes to annotations
    //      being loaded or if the viewport id has changed 
    //  Without this, the dropdown change would not take effect

    useEffect(() => {
        if (!annotationsLoaded) {
            console.log('skipping subscription, annotations not loaded');
            return;
        }
            rebuildDropdownMap();
    }, [annotationsLoaded, viewportGridService, activeViewportId]);


    //=========================================================
    // hydrate + lock annotations when series/annotations change
    //      wait for all annotations to be loaded, then set to locked 
    //      if the study has been marked as completed
    useEffect(() => {
    const hydrateAndLockAnnotations = async () => {
        if (!annotationsLoaded || !studyUID || !seriesInstanceUID) {
        console.log('[annotationViewportSetup] prerequisites not ready, skipping ... loaded flag', annotationsLoaded);
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


        const isStudyDone = progressData?.study_status === 'done';
        setStudyCompleted(isStudyDone);
        isStudyCompletedRef.current = isStudyDone;
        // console.log(' *** IN HYDRATE seriesProgress, studyProgress:', isStudyCompletedRef.current)

        lockAllAnnotations({annotation, userInfo, isStudyCompletedRef});

        console.log(
        `${isStudyCompletedRef.current ? '🔒' : '🔓'} Lock state annotations for study ${studyUID}`
        );
    };

    hydrateAndLockAnnotations();
    }, [annotationsLoaded, studyUID, seriesInstanceUID, userInfo?.role, viewportGridService]);

    //=========================================================

    useEffect(() => {
        rebuildDropdownMap();
    }, [dropdownMapVersion]);


    //=========================================================



    //=========================================================
    // add listeners with handlers
    useEffect(() => {
        if (!patientName || !studyUID) {
            console.log('⏳ Waiting for patientName and studyUID before setting up listeners...');
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

        const wrappedMeasurementUpdatedHandler = ( { measurement } : any) => handleMeasurementUpdated({
            measurement,
            debouncedUpdateStats,
            pendingAnnotationUIDRef,

        })

        const subscriptionAdd = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_ADDED,wrappedMeasurementAddedHandler);
        const subscriptionRemove = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_REMOVED,wrappedMeasurementRemovedHandler);
        const subscriptionUpdated = measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_UPDATED,wrappedMeasurementUpdatedHandler);

        return () => {
          subscriptionAdd.unsubscribe();
          subscriptionRemove.unsubscribe();
          subscriptionUpdated.unsubscribe();
        }

    }, [patientName, studyUID]);

    //=========================================================
    // UseEffect to block the events when you click on the 'collapse'
    //     button for the OHIF panel
    useEffect(() => {
        const blockCloseClick = (e: MouseEvent) => {
            const el = (e.target as Element).closest('[data-cy="side-panel-header-right"]');
            if (el) {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation(); // Stop other listeners too
            return false;
            }
        };

        // Capture phase (runs before React event handlers)
        document.addEventListener('click', blockCloseClick, true);
        
        return () => {
            document.removeEventListener('click', blockCloseClick, true);
        };
    }, []); // Empty deps - runs once

    //=========================================================


    //=========================================================
    ////////////////////////////////////////////

    return (
        <>
        <div className="webquiz-panel">

        {/* --- PANEL HEADER (always visible) --- */}
        <div className="panel-header">
        <button
            className="minimize-btn"
            onClick={() => {
                setIsMinimized(prev => {
                const newState = !prev;

                const panel = document.getElementById('viewerLayoutResizableRightPanel');
                if (panel) {
                    if (newState) {
                    panel.classList.add('minimized-panel');
                    } else {
                    panel.classList.remove('minimized-panel');
                    }
                }

                return newState;
                });
            }}
            >
            {isMinimized ? '◀' : '▶'}
            </button>
        <span className="title">Web Quiz</span>
        </div>  // panel-header

        {/* --- COLLAPSIBLE CONTENT --- */}
        {!isMinimized && (

            <div className="panel-content">
            <div
                style={{
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
                    setDropdownMapVersion((v) => v + 1);
                }}
                showModal={showModal}
                closeModal={closeModal}
                />

                <div
                className="text-white w-full text-center"
                style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                {/* <div style={{ flex: '1 1 50%', overflowY: 'auto', minHeight: 0 }}> */}
                <div style={{ flex: '0 1 auto', maxHeight: '40%',overflowY: 'auto', minHeight: 0 }}>
                    <SegmentationList
                    getUserInfo={getUserInfo}
                    segmentationList={segmentationList}
                    onSegmentClick={onSegmentClick}
                    />
                </div>

                {/* <div style={{ flex: '1 1 50%', overflowY: 'auto', minHeight: 0 }}> */}
                <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                    <AnnotationList
                    measurementList={measurementList}
                    dropdownSelectionMap={dropdownSelectionMap}
                    visibilityMap={visibilityMap}
                    scoreOptions={measurementScoreOptions}
                    onMeasurementClick={onMeasurementClick}
                    onToggleVisibility={onToggleVisibility}
                    triggerPost={triggerPost}
                    annotation={annotation}
                    onScoreClick={handleScoreClick}
                    />
                </div>
                </div>
            </div>
            </div>  // panel content


        )}
    </div>  // extension panel

    {/* --- Extension Panel siblings --- */}
    <ScoreModal
        isOpen={showScoreModal}
        scoreOptions={measurementScoreOptions}
        selectedScore={selectedScore}
        setSelectedScore={setSelectedScore}
        onClose={onCloseScoreModal}
        pendingAnnotationUIDRef={pendingAnnotationUIDRef}
        setDropdownSelectionMap={setDropdownSelectionMap}
        triggerPost={triggerPost}
        isStudyCompleted={isStudyCompletedRef.current}
    />

        {modalInfo && (
            <ModalComponent
            title={modalInfo.title}
            message={modalInfo.message}
            onClose={modalInfo.onClose ?? closeModal}
            showCancel={modalInfo.showCancel}
            onCancel={modalInfo.onCancel}
            confirmText={modalInfo.confirmText}
            />
        )}

    </> // end panel and siblings
    );    
}
    


export default WebQuizSidePanelComponent;

