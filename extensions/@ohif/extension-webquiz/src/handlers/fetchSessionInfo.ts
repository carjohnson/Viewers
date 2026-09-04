/**
 * Customized Worklist calls this to get the session info while OHIF is being initialized
 *  Include instance where session may have expired.
 * @param param0 
 * @returns 
 */
//=========================================================
import { notifyBackendError, isServerFailure } from '../utils/notifyBackendError';
import { safeParseJson } from '../utils/fetchHelpers';

export const fetchSessionUserInfo = async ({ baseUrl }: { baseUrl: string }) => {
  try {
    const res = await fetch(`${baseUrl}/users/session-info`, {
      credentials: 'include',
    });

    if (!res.ok) {
      if (isServerFailure(res.status)) {
        notifyBackendError(`Failed to fetch session info (status ${res.status})`);
        return { user: null, reason: 'server_error' };
      }
      console.warn(`⚠️ Session info fetch failed: ${res.status}`);
      return { user: null, reason: 'unauthenticated' };
    }

    const parsed = await safeParseJson(res);
    if (!parsed.ok) {
      // Non-JSON body on a 2xx - most likely redirected to the login
      // page (HTML) because the session cookie wasn't recognized.
      console.warn('⚠️ Session info returned non-JSON — likely redirected to login');
      return { user: null, reason: 'unauthenticated' };
    }

    return { user: parsed.data, reason: null };
  } catch (error) {
    console.error('❌ Error fetching session info:', error);
    if (error instanceof TypeError) {
      notifyBackendError('Network error while fetching session info');
      return { user: null, reason: 'network_error' };
    }
    return { user: null, reason: 'unauthenticated' };
  }
};