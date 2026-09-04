import { notifyBackendError, isServerFailure } from '../utils/notifyBackendError';
import { safeParseJson } from '../utils/fetchHelpers';

//=========================================================
export const postSeriesProgress = async ({
  baseUrl,
  username,
  studyUID,
  seriesUID,
  status = 'wip',
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
  seriesUID: string;
  status?: 'new' | 'wip' | 'done';
}) => {
  try {
    const res = await fetch(`${baseUrl}/api/series-progress`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, studyUID, seriesUID, status }),
    });

    if (!res.ok) {
      if (isServerFailure(res.status)) {
        notifyBackendError(`Failed to save series progress (server responded ${res.status})`);
      }
      console.warn(`⚠️ Failed to post series progress: ${res.status}`);
      return { error: `Server responded with ${res.status}` };
    }

    const parsed = await safeParseJson(res);
    return parsed.ok ? parsed.data : { error: parsed.error };
  } catch (err) {
    // fetch() itself threw - a genuine network/connectivity failure
    console.error('🚨 Error posting series progress:', err);
    notifyBackendError(err instanceof Error ? err.message : String(err));
    return { error: err };
  }
};
//=========================================================
export const postStudyProgressComplete = async ({
  baseUrl,
  username,
  studyUID,
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
}) => {
  try {
    const res = await fetch(`${baseUrl}/api/study-complete`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, studyUID }),
    });

    if (!res.ok) {
      if (isServerFailure(res.status)) {
        notifyBackendError(`Failed to mark study complete (server responded ${res.status})`);
      }
      console.warn(`⚠️ Failed to post study complete: ${res.status}`);
      return { error: `Server responded with ${res.status}` };
    }

    const parsed = await safeParseJson(res);
    return parsed.ok ? parsed.data : { error: parsed.error };
  } catch (err) {
    console.error('🚨 Error posting study complete progress:', err);
    notifyBackendError(err instanceof Error ? err.message : String(err));
    return { error: err };
  }
};

//=========================================================
export const fetchStudyProgressFromDB = async ({
  baseUrl,
  username,
  studyUID,
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
}) => {
  try {
    const res = await fetch(
      `${baseUrl}/api/study-progress?username=${encodeURIComponent(username)}&studyUID=${encodeURIComponent(studyUID)}`,
      { credentials: 'include' }
    );

    if (!res.ok) {
      if (isServerFailure(res.status)) {
        notifyBackendError(`Failed to fetch study progress (server responded ${res.status})`);
      }
      console.warn(`⚠️ Failed to fetch study progress: ${res.status}`);
      return { error: `Server responded with ${res.status}` };
    }

    const parsed = await safeParseJson(res);
    return parsed.ok ? parsed.data : { error: parsed.error };
  } catch (error) {
    console.error('❌ Error fetching study progress:', error);
    notifyBackendError(error instanceof Error ? error.message : String(error));
    return { error };
  }
};


//=========================================================
export const fetchStudyListFromDB = async({
  baseUrl,
}: {
  baseUrl: string;
}) => {
    try {
        const res = await fetch(
        `${baseUrl}/api/study`,
        { credentials: 'include' }
        );

        if (!res.ok) {
        if (isServerFailure(res.status)) {
          notifyBackendError(`Failed to fetch study list (server responded ${res.status})`);
        }
        console.warn(`⚠️ Failed to fetch study list: ${res.status}`);
        return { error: `studyHandlers>>fetchStudyListFromDB>Server responded with ${res.status}` };
        }

        const parsed = await safeParseJson(res);
        // const studyUIDList = result.map(item => item.studyUID);
        return parsed.ok ? parsed.data : { error: parsed.error };

    } catch (error) {
        console.error('❌ studyHandlers>>fetchStudyListFromDB>Error fetching study list:', error);
        notifyBackendError(error instanceof Error ? error.message : String(error));
        return { error };
    }
}

//=========================================================
export const fetchSeriesToBeAnnotatedFromDB = async({
  baseUrl,
  studyUID,
}: {
  baseUrl: string;
  studyUID: string;
}): Promise<string[]> => {
  try {
      const res = await fetch(
        `${baseUrl}/webquiz/list-study-seriesToBeAnnotated?studyUID=${studyUID}`,
        { credentials: 'include' }
        );

      if (!res.ok) {
        if (isServerFailure(res.status)) {
          notifyBackendError(`Failed to fetch seriesToBeAnnotated (server responded ${res.status})`);
        }
        console.warn(`⚠️ Failed to fetch seriesToBeAnnotated list: ${res.status}`);
        throw new Error(`Failed to fetch seriesToBeAnnotated for Study. Server responded with ${res.status} `);
        }

    const parsed = await safeParseJson(res);
    if (!parsed.ok) {
      // Not a connectivity/DB issue - likely an auth redirect. Don't
      // notify the popup for this one, just surface it to the caller.
      throw new Error(parsed.error);
    }
    const { payload: seriesToBeAnnotatedList } = parsed.data;
    console.log(' *** IN FETCH SERIES UIDS:', seriesToBeAnnotatedList);


      return seriesToBeAnnotatedList;
    } catch (err) {
      // Only notify here for the network-exception case (fetch itself
      // threw before any response came back) - the !res.ok branch above
      // already notified for 5xx responses, and a JSON-parse failure
      // isn't a connectivity issue, so avoid notifying for either of
      // those here.
      const alreadyHandled =
        err instanceof Error &&
        (err.message.startsWith('Failed to fetch seriesToBeAnnotated for Study') ||
          err.message.startsWith('Unexpected response from server'));
      if (!alreadyHandled) {
        notifyBackendError(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }

//=========================================================
export const postTimedEvent = async ({
  baseUrl,
  username,
  studyUID,
  event,
  method = 'unknown',
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
  event: 'open' | 'close' | 'case_completed';
  method?: 'logout' | 'browser_close' | 'tab_close' | 'visibility_lost' | 'visibility_regained' | 'exit_extension' | 'enter_extension' | 'user_marked_complete' | 'unknown';
}) => {
  try {
    const res = await fetch(`${baseUrl}/api/timed-event`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, studyUID, event, method }),
      keepalive: true,
    });

    if (!res.ok) {
      // Best-effort only: this call often fires during page unload
      // (browser/tab close), where showing a popup wouldn't be seen
      // anyway. Still log/notify for the cases where it's not.
      if (isServerFailure(res.status)) {
        notifyBackendError(`Failed to log timed event (server responded ${res.status})`);
      }
      console.warn(`⚠️ Failed to post timed event: ${res.status}`);
      return { error: `Server responded with ${res.status}` };
    }

    const parsed = await safeParseJson(res);
    return parsed.ok ? parsed.data : { error: parsed.error };
  } catch (err) {
    console.error('🚨 Error posting timed event:', err);
    return { error: err };
  }
};