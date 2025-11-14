import { useEffect, useState } from 'react';
import { fetchStudyProgressFromDB } from './../handlers/studyProgressHandlers';

export const useSeriesProgressStatus = ({
  baseUrl,
  username,
  studyUID,
  seriesUID,
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
  seriesUID: string;
}) => {
  const [status, setStatus] = useState<string | null>(null);
    console.log('🧪 Hook triggered with:', { baseUrl, username, studyUID, seriesUID });

//   useEffect(() => {
//     if (!username || !studyUID || !seriesUID) {
//         console.log('🚫 Missing required params — skipping fetch');
//         return;
//     }

//     const fetchStatus = async () => {
//       if (!studyUID || !seriesUID) return;

//       const progressData = await fetchStudyProgressFromDB({
//         baseUrl,
//         username,
//         studyUID,
//       });

//       console.log('📦 Progress data:', progressData);

//       if (progressData?.error) {
//         console.warn('⚠️ Could not fetch progress:', progressData.error);
//         return;
//       }

//       const current = progressData.seriesProgress?.find(
//         entry => entry.seriesUID === seriesUID
//       );

//       setStatus(current?.status ?? null);
//     };

//     fetchStatus();
//   }, [baseUrl, username, studyUID, seriesUID]);

//   useEffect(() => {
//   setStatus(null); // Clear previous status
// }, [seriesUID]);

useEffect(() => {

  if (!username || !studyUID || !seriesUID) {
    console.log('🚫 Missing required params — skipping fetch');
    return;
  }

  const fetchStatus = async () => {
    const progressData = await fetchStudyProgressFromDB({
      baseUrl,
      username,
      studyUID,
    });

    console.log('📦 Progress data from hook:', progressData);

    const current = progressData.seriesProgress?.find(
      entry => entry.seriesUID === seriesUID
    );

    console.log('🔍 Matched series entry:', current);

    setStatus(current?.status ?? null);
  };

  fetchStatus();
}, [baseUrl, username, studyUID, seriesUID]);

  return status; // 'wip', 'done', or null
};


