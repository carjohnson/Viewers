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
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('🚨 Error posting series progress:', err);
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
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('🚨 Error posting study complete progress:', err);
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
      console.warn(`⚠️ Failed to fetch study progress: ${res.status}`);
      return { error: `Server responded with ${res.status}` };
    }

    const result = await res.json();

    return result;
  } catch (error) {
    console.error('❌ Error fetching study progress:', error);
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
        console.warn(`⚠️ Failed to fetch study list: ${res.status}`);
        return { error: `studyHandlers>>fetchStudyListFromDB>Server responded with ${res.status}` };
        }

        const result = await res.json();
        // const studyUIDList = result.map(item => item.studyUID);
        return result;

    } catch (error) {
        console.error('❌ studyHandlers>>fetchStudyListFromDB>Error fetching study list:', error);
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
        console.warn(`⚠️ Failed to fetch seriesToBeAnnotated list: ${res.status}`);
        throw new Error(`Failed to fetch seriesToBeAnnotated for Study. Server responded with ${res.status} `);
        }

    const { payload: seriesToBeAnnotatedList } = await res.json();
    console.log(' *** IN FETCH SERIES UIDS:', seriesToBeAnnotatedList);


      return seriesToBeAnnotatedList;
    } catch (err) {
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
    return await res.json();
  } catch (err) {
    console.error('🚨 Error posting timed event:', err);
    return { error: err };
  }
};