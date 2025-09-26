// // src/handlers/fetchAnnotations.ts
import { buildSelectionMap } from '../utils/annotationUtils';

export const fetchAnnotationsFromDB = async ({
  userInfo,
  patientName,
  baseUrl,
  setListOfUsersAnnotations,
  setSelectionMap,
  annotation,
  setAnnotationsLoaded,
}: {
  userInfo: { username: string; role: string };
  patientName: string;
  baseUrl: string;
  setListOfUsersAnnotations: (list: any[]) => void;
  setSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  annotation: any;
  setAnnotationsLoaded: (loaded: boolean) => void;
}) => {
  const username = userInfo.role === 'reader' ? userInfo.username : 'all';

  try {
    const response = await fetch(
      `${baseUrl}/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`,
      { credentials: 'include' }
    );

    if (!response.ok) throw new Error('Failed to fetch annotations from DB');

    const { payload: annotationsList, legend } = await response.json();

    setListOfUsersAnnotations(annotationsList);

    const newMap = buildSelectionMap(annotationsList);
    setSelectionMap(newMap);

    annotationsList.forEach(({ data, color }) => {
      data.forEach(annotationObj => {
        if (
          annotationObj &&
          typeof annotationObj.annotationUID === 'string' &&
          annotationObj.annotationUID.length > 0
        ) {
          annotation.config.style.setAnnotationStyles(annotationObj.annotationUID, { color });
          annotation.state.addAnnotation(annotationObj);
        }
      });
    });

    setAnnotationsLoaded(true);

    window.parent.postMessage({ type: 'update-legend', legend }, '*');
  } catch (error) {
    console.error('❌ Error fetching annotations:', error);
  }
};



// export const fetchAnnotationsFromDB = async ({
//   userInfo,
//   patientName,
//   baseUrl,
//   setListOfUsersAnnotations,
//   updateSelectionMap,
//   annotation,
//   setAnnotationsLoaded,
// }: {
//   userInfo: { username: string; role: string };
//   patientName: string;
//   baseUrl: string;
//   setListOfUsersAnnotations: (list: any[]) => void;
//   updateSelectionMap: (list: any[]) => void;
//   annotation: any;
//   setAnnotationsLoaded: (loaded: boolean) => void;
// }) => {
//   const username = userInfo.role === 'reader' ? userInfo.username : 'all';

//   try {
//     const response = await fetch(
//       `${baseUrl}/webquiz/list-users-annotations?username=${username}&patientid=${patientName}`,
//       { credentials: 'include' }
//     );

//     if (!response.ok) throw new Error('Failed to fetch annotations from DB');

//     const { payload: annotationsList, legend } = await response.json();

//     setListOfUsersAnnotations(annotationsList);
//     updateSelectionMap(annotationsList);

//     annotationsList.forEach(({ data, color }) => {
//       data.forEach(annotationObj => {
//         if (
//           annotationObj &&
//           typeof annotationObj.annotationUID === 'string' &&
//           annotationObj.annotationUID.length > 0
//         ) {
//           annotation.config.style.setAnnotationStyles(annotationObj.annotationUID, { color });
//           annotation.state.addAnnotation(annotationObj);
//         }
//       });
//     });

//     setAnnotationsLoaded(true);

//     window.parent.postMessage({
//       type: 'update-legend',
//       legend,
//     }, '*');

//   } catch (error) {
//     console.error('❌ Error fetching annotations:', error);
//   }
// };

