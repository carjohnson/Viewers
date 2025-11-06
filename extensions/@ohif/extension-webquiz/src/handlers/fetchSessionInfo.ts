//=========================================================
export const fetchSessionUserInfo = async ({ baseUrl }: { baseUrl: string }) => {
  try {
    const res = await fetch(`${baseUrl}/users/session-info`, {
      credentials: 'include',
    });

    if (!res.ok) {
      console.warn(`⚠️ Session info fetch failed: ${res.status}`);
      return null;
    }

    const user = await res.json();
    return user;
  } catch (error) {
    console.error('❌ Error fetching session info:', error);
    return null;
  }
};