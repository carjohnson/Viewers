
/**
 * UserInfoService
 *
 * This service provides centralized access to user information retrieved from the parent iframe.
 * It supports both synchronous access and asynchronous readiness handling, allowing other parts
 * of the application (e.g., modes, extensions, components) to react once user info becomes available.
 * This guards against a slow delayed response from the server.
 *
 * API:
 * - setUserInfo(info): Stores the user info and marks it as ready. Triggers all registered callbacks.
 * - getUserInfo(): Returns the current user info object (or null if not yet available).
 * - isUserInfoReady(): Returns a boolean indicating whether user info has been set.
 * - onUserInfoReady(callback): Registers a callback to be invoked once user info is available.
 *   If already ready, the callback is invoked immediately.
 *
 * Usage:
 * - Call setUserInfo(info) when the 'user-info' message is received from the parent.
 * - Use getUserInfo() to access the user info synchronously.
 * - Use onUserInfoReady(fn) to defer logic until user info is available (e.g., toolbar setup).
 */


let userInfo = null;
let isReady = false;
let listeners = [];

export const setUserInfo = info => {
  userInfo = info;
  isReady = true;
  listeners.forEach(fn => fn(userInfo));
};

export const getUserInfo = () => userInfo;

export const isUserInfoReady = () => isReady;

export const onUserInfoReady = callback => {
  if (isReady) {
    callback(userInfo);
  } else {
    listeners.push(callback);
  }
};