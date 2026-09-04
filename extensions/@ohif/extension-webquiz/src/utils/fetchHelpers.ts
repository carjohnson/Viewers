// A 2xx/4xx/5xx response that isn't valid JSON almost always means we got
// redirected to the login page (HTML) instead of the API response - most
// commonly because this fetch fired before the session/auth cookie was
// fully recognized by the server, a timing issue rather than a real
// backend/DB outage. Treat that case separately from an actual network
// failure so we don't show the "database is down" popup for it.
export async function safeParseJson(res: Response): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.warn('⚠️ Response was not valid JSON (possibly redirected to login - session not yet established?):', err);
    return { ok: false, error: 'Unexpected response from server - you may need to log in again' };
  }
}