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
      `${baseUrl}/api/studies/${studyUID}/validate/${seriesUID}`,
      { credentials: 'include' }
    );
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('🚨 Error validating series:', err);
    return { error: err };
  }
};