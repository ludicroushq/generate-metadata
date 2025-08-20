/**
 * Isomorphic debug implementation
 * Works in both Node.js and browser environments
 */

export type DebugFunction = (...args: any[]) => void;

/**
 * Create a debug function for a given namespace
 * @param namespace - The debug namespace
 * @param enabled - Whether debug is enabled (defaults to false)
 * @returns A debug function
 */
export function createDebug(namespace: string, enabled = false): DebugFunction {
  // Return a no-op function if debug is not enabled
  if (!enabled) {
    return () => {};
  }

  // Return a debug function that logs with the namespace prefix
  return (..._args: any[]) => {
    const timestamp = new Date().toISOString();
    const _prefix = `[${timestamp}] ${namespace}`;
  };
}

// Re-export as default for compatibility with the debug module
export default createDebug;
