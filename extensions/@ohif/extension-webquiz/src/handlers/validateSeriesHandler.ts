import { notifyBackendError, isServerFailure } from './../utils/notifyBackendError';
import { safeParseJson } from './../utils/fetchHelpers';

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

    if (isServerFailure(res.status)) {
      notifyBackendError(`Series validation failed (status ${res.status})`);
      return { error: `Server error (status ${res.status})` };
    }

    const parsed = await safeParseJson(res);
    if (!parsed.ok) {
      // Not a connectivity/DB issue - likely an auth redirect (401) or
      // some other non-JSON body. Don't notify the popup for this.
      console.warn(`⚠️ Series validation response was not JSON (status ${res.status})`);
      return { error: parsed.error };
    }

    if (res.status === 400 && parsed.data?.error === 'Study not found') {
      console.warn(`⚠️ Study document not found in DB for studyUID: ${studyUID} — it may have been deleted.`);
      return { isValid: false, studyNotFound: true };
    }

    return parsed.data;
  } catch (err) {
    console.error('🚨 Error validating series:', err);
    notifyBackendError('Network error while validating series');
    return { error: err };
  }
};