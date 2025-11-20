// annotationEventHandlers.ts

import { annotation } from '@cornerstonejs/tools';
import { getLastIndexStored, buildDropdownSelectionMapFromState } from './../utils/annotationUtils';
import { getUserInfo } from '../../../../../modes/@ohif/mode-webquiz/src/userInfoService';
import { TriggerPostArgs } from '../models/TriggerPostArgs';



//=========================================================
export function handleMeasurementAdd({
  measurement,
  measurementService,
  showModal,
  setActiveUID,
  debouncedShowScoreModal,
  pendingAnnotationUIDRef,
  isSeriesValidRef,
  listOfUsersAnnotationsRef,
}: {
  measurement: any;
  measurementService: any;
  showModal: (modalProps: {
    title: string;
    message: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }) => void;
  setActiveUID: (uid: string) => void;
  debouncedShowScoreModal: (uid: string) => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
  isSeriesValidRef: React.MutableRefObject<boolean>;
  listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;
}) {
  console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current,  measurement);
  setTimeout(() => {
    try {
      const uid = measurement?.uid;
      const seriesUID = measurement?.referenceSeriesUID;

      console.log('🕒 Delayed MEASUREMENT_ADDED check:', isSeriesValidRef, pendingAnnotationUIDRef.current, { uid, seriesUID });

      // Flatten all annotationUIDs with scores
      const annotationsObj = listOfUsersAnnotationsRef.current;
      const annotationGroups = annotationsObj ? Object.values(annotationsObj) : [];

      const scoredUIDs = annotationGroups
        .flatMap(group => group.data || [])
        .filter(a => a?.annotationUID && a?.data?.suspicionScore != null)
        .map(a => a.annotationUID);

      const isAlreadyScored = scoredUIDs.includes(uid);
      console.log('📌 MEASUREMENT_ADDED handler triggered:', isSeriesValidRef, pendingAnnotationUIDRef.current, isAlreadyScored, listOfUsersAnnotationsRef.current, scoredUIDs);

      if (
        uid &&
        uid === pendingAnnotationUIDRef.current &&
        isSeriesValidRef.current === false
      ) {
        console.warn('🧹 Removing measurement on invalid series:', uid);
        measurementService.remove(uid);

        showModal({
          title: 'Invalid Series',
          message:
            'This series is not to be annotated.',
            showCancel: false,
          });

        pendingAnnotationUIDRef.current = null;



      } else {
        console.log(' *** IN MEASUREMENT ADDED HANDLER :', isSeriesValidRef, pendingAnnotationUIDRef.current, uid);

        setActiveUID(uid);

        if (!isAlreadyScored) {
          // debouncedShowScoreModal();
          debouncedShowScoreModal(uid);
      
        } else {
          console.log('🛑 Skipping score modal — annotation already scored:', uid);
        }

        pendingAnnotationUIDRef.current = null;

      }
    } catch (error) {
      console.error('🔥 Error in delayed MEASUREMENT_ADDED block:', error);
    }
  }, 50);
}
//=========================================================
export const handleAnnotationChange = ({
  event,
  debouncedUpdateStats,
  pendingAnnotationUIDRef,
}: {
  event: any;
  debouncedUpdateStats: () => void;
  pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
}) => {
  const { annotation: changedAnnotation } = event.detail;
  if (!changedAnnotation) return;
   pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
  // console.log('🔍 IN CHANGED Annotation event detail:', event.detail);
  // console.log('🧷 Annotation UID set:', changedAnnotation.annotationUID);
  
  debouncedUpdateStats();

}

//=========================================================
export const handleAnnotationRemove = ({
  event,
  setIsSaved,
  debouncedUpdateStats,
  setDropdownSelectionMap,
  triggerPost,
}: {
  event: any;
  setIsSaved: (value: boolean) => void;
  debouncedUpdateStats: () => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  triggerPost: (args: TriggerPostArgs) => void;
}) => {
    const userInfo = getUserInfo();
    if (userInfo?.role === 'admin') {
      alert("Admins are not allowed to delete annotations.");
      console.warn("🚫 Annotation deletion blocked for admin user:", userInfo.username);
      return;
    }
    setIsSaved(false);
    // debouncedUpdateStats();
    setTimeout(() => {
      const allAnnotations = annotation.state.getAllAnnotations?.() || [];
      const newMap = buildDropdownSelectionMapFromState(allAnnotations);
      setDropdownSelectionMap(newMap);

      const postArgs = { allAnnotations, dropdownSelectionMap: newMap };
      triggerPost(postArgs);
    }, 0);

};


//=========================================================
// export const handleAnnotationChange = ({
//   event,
//   setIsSaved,
//   debouncedUpdateStats,
//   setDropdownSelectionMap,
//   setShowScoreModal,
//   triggerPost,
//   debouncedShowScoreModal,
//   setActiveUID,
//   pendingAnnotationUIDRef,
//   isSeriesValidRef,
// }: {
//   event: any;
//   setIsSaved: (value: boolean) => void;
//   debouncedUpdateStats: () => void;
//   setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
//   setShowScoreModal: (modalWindow: boolean) => void;
//   triggerPost: (args: TriggerPostArgs) => void;
//   debouncedShowScoreModal: () => void;
//   setActiveUID: (activeUID: string | null) => void;
//   pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
//   isSeriesValidRef: React.MutableRefObject<boolean | null>;
// }) => {
//   const { annotation: changedAnnotation, bContinueDelay = false } = event.detail;
//   if (!changedAnnotation) return;
//   pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
//   console.log('🧷 Annotation UID set:', changedAnnotation.annotationUID);
  
//   if (isSeriesValidRef.current === false) {
//     console.warn('🚫 Annotation created on invalid series. Skipping measurement update.');
//     return;
//   }

//   const userInfo = getUserInfo();
//   if (!userInfo?.username) {
//     console.warn("⚠️ Username not available yet. Skipping label assignment.");
//     return;
//   }

//   if (userInfo.role === 'admin') {
//     console.log("👮‍♂️ Admin role detected. Skipping POST.");
//     return;
//   }

//   setIsSaved(false);
//   debouncedUpdateStats();

//   const allAnnotations = annotation.state.getAllAnnotations?.() || [];
//   console.log('🔁 Re-fired ANNOTATION_MODIFIED for UID:', changedAnnotation.annotationUID);

//   const measurementIndex = getLastIndexStored(allAnnotations) + 1;
//   const customLabel = `${userInfo.username}_${measurementIndex}`;

//   if (changedAnnotation.data.label === "") {
//     changedAnnotation.data.label = customLabel;
//     pendingAnnotationUIDRef.current = changedAnnotation.annotationUID;
//   }

//   console.log('📦 changedAnnotation before map:', changedAnnotation);
//   const newMap = buildDropdownSelectionMapFromState(allAnnotations);
//   setDropdownSelectionMap(newMap);
//   console.log('📊 dropdownSelectionMap before post:', newMap);

//   const isScoreValid =
//     typeof changedAnnotation.data.suspicionScore === 'number' &&
//     changedAnnotation.data.suspicionScore >= 1 &&
//     changedAnnotation.data.suspicionScore <= 5;

//   const postArgs = { allAnnotations, dropdownSelectionMap: newMap };

//   if (!isScoreValid || bContinueDelay) {
//     setTimeout(() => triggerPost(postArgs), 500);
//   } else {
//     triggerPost(postArgs);
//   }
// };

//=========================================================
// export const handleAnnotationCompleted = ({
//   event,
// }: {
//   event: any;
// }) => {
//   console.log('🔍 *** IN CHANGED HANDLER Annotation event detail:', event.detail);
// };


//=========================================================
// export const handleAnnotationCompleted = ({
//   event,
//   pendingAnnotationUIDRef,
// }: {
//   event: any;
//   pendingAnnotationUIDRef: React.MutableRefObject<string | null>;

//   }) => {

//   const uid = event.detail?.annotation?.annotationUID;
//   if (!uid) return;

//   console.log('🖊️ Annotation completed (awaiting score):', uid);
//   pendingAnnotationUIDRef.current = uid;


// };


// export const handleAnnotationCompleted = ({
//   event,
//   pendingAnnotationUIDRef,
//   isSeriesValidRef,
//   showModal,
//   setActiveUID,
//   debouncedShowScoreModal,

// }: {
//   event: any;
//   pendingAnnotationUIDRef: React.MutableRefObject<string | null>;
//   isSeriesValidRef: React.MutableRefObject<boolean | null>;
//   showModal: (modalProps: {
//     title: string;
//     message: string;
//     showCancel?: boolean;
//     onCancel?: () => void;
//   }) => void;
//   setActiveUID: (activeUID: string | null) => void;
//   debouncedShowScoreModal: () => void;
// }) => {

//     console.log('🔍 *** IN ANNOTATION COMPLETED:', event.detail);

//     const uid = event.detail?.annotation?.annotationUID;
//     if (!uid) return;

//     pendingAnnotationUIDRef.current = uid;

//     if (isSeriesValidRef.current === false) {
//       console.warn('🚫 Invalid series — blocking annotation.');
//       showModal({
//         title: 'Invalid Series',
//         message: 'This series is not part of the project.',
//         showCancel: false,
//       });
//       pendingAnnotationUIDRef.current = null;
//       return;
//     }

//     console.log('✅ Annotation completed:', uid);
//     setActiveUID(uid);
//     debouncedShowScoreModal();
//     pendingAnnotationUIDRef.current = null;


// };

