// src/utils/notifyBackendError.ts
//
// The OHIF viewer runs inside an iframe and calls the webquiz/api backend
// directly (not relayed through the parent page). When one of those calls
// fails because the server/DB is unreachable, this tells the parent page
// (see webquiz-listener.js's 'backend-error' handler) to show the
// "stop working, contact your administrator" popup.
//
// Only call this for REAL connectivity/server failures - a 503 (our
// requireDbConnection middleware), a 500, or a network-level exception
// (fetch throwing before any response comes back). Do NOT call this for
// expected/handled application errors like a 400 "Study not found" -
// those aren't a "call the administrator" situation.
export function notifyBackendError(message: string) {
  try {
    window.parent.postMessage({ type: 'backend-error', message }, '*');
  } catch (err) {
    // If postMessage itself somehow fails, at least keep the original
    // error visible in this frame's console.
    console.error('❌ Failed to notify parent of backend error:', err);
  }
}

// A response is worth treating as a connectivity/server failure (as
// opposed to an expected 4xx application error) if it's a 5xx.
export function isServerFailure(status: number) {
  return status >= 500;
}