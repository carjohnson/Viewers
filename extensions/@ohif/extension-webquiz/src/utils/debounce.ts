/**
 * debounce - Creates a debounced version of a function that delays its execution
 * until after a specified wait time has elapsed since the last time it was invoked.
 * 
 * This is useful for limiting how often a function runs in response to rapid events,
 * such as annotation listeners, input changes, or resize events.
 * 
 * @template T = The type of the function being debounced.
 * @param {T} func - The original function to debounce.
 * @param {number} delay - The number of milliseconds to wait before invoking the function.
 * @returns {T} - A debounced version of the original function.
 *
 * Example usage:
 * const debouncedUpdate = debounce(() => {
 *   setAnnotationData(getAnnotationsStats());
 * }, 200);
 *
 * debouncedUpdate(); // Will only run if not called again within 200ms
 */
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timer: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  } as T;
}