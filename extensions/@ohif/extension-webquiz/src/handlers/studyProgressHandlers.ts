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
        return { error: `studyProgressHandlers>>fetchStudyListFromDB>Server responded with ${res.status}` };
        }

        const result = await res.json();
        // const studyUIDList = result.map(item => item.studyUID);
        return result;

    } catch (error) {
        console.error('❌ studyProgressHandlers>>fetchStudyListFromDB>Error fetching study list:', error);
        return { error };
    }
}

//=========================================================
export const postStudyOpened = async ({
  baseUrl,
  username,
  studyUID,
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
}) => {
  try {
    const res = await fetch(`${baseUrl}/api/study-opened`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, studyUID }),
    });
    return await res.json();
  } catch (err) {
    console.error('🚨 Error posting study opened:', err);
    return { error: err };
  }
};

//=========================================================
export const postStudyClosed = async ({
  baseUrl,
  username,
  studyUID,
  closeMethod = 'unknown',
}: {
  baseUrl: string;
  username: string;
  studyUID: string;
  closeMethod?: 'logout' | 'browser_close' | 'tab_close' | 'visibility_lost' | 'exit_extension' | 'unknown';
}) => {
  try {
    const res = await fetch(`${baseUrl}/api/study-closed`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, studyUID, closeMethod }),
      keepalive: true,   // ← lets the browser finish sending this after the page/context unmounts
    });
    return await res.json();
  } catch (err) {
    console.error('🚨 Error posting study closed:', err);
    return { error: err };
  }
};