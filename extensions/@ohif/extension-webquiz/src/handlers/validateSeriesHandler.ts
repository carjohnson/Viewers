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
    // console.log(' *** Validation result:', result);
    return result;
  } catch (err) {
    console.error('🚨 Error validating series:', err);
    return { error: err };
  }
};