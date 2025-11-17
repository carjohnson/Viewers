// src/handlers/fetchAnnotations.ts
import { buildDropdownSelectionMapFromFetched } from '../utils/annotationUtils';

export const fetchAnnotationsFromDB = async ({
  userInfo,
  patientName,
  baseUrl,
  setListOfUsersAnnotations,
  setDropdownSelectionMap,
  annotation,
  setAnnotationsLoaded,
  listOfUsersAnnotationsRef,
}: {
  userInfo: { username: string; role: string };
  patientName: string;
  baseUrl: string;
  setListOfUsersAnnotations: (list: any[]) => void;
  setDropdownSelectionMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  annotation: any;
  setAnnotationsLoaded: (loaded: boolean) => void;
  listOfUsersAnnotationsRef: React.MutableRefObject<Record<string, any> | null>;
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
    listOfUsersAnnotationsRef.current = annotationsList;

    const newMap = buildDropdownSelectionMapFromFetched(annotationsList);
    setDropdownSelectionMap(newMap);

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
