export const validateSeriesFromDB = async ({
  baseUrl,
  studyUID,
  seriesUID,
}: {
  baseUrl: string;
  studyUID: string;
  seriesUID: string;
}) => {
  try {
    const res = await fetch(
      `${baseUrl}/api/study/${studyUID}/validate/${seriesUID}`,
      { credentials: 'include' }
    );
    const result = await res.json();

    if (res.status === 400 && result?.error === 'Study not found') {
      console.warn(`⚠️ Study document not found in DB for studyUID: ${studyUID} — it may have been deleted.`);
      return { isValid: false, studyNotFound: true };
    }

    return result;
  } catch (err) {
    console.error('🚨 Error validating series:', err);
    return { error: err };
  }
};