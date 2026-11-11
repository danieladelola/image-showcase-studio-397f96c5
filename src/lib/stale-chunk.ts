// After a new deploy, an open tab may still reference old hashed JS files that
// no longer exist. Detect that and reload once so the tab picks up the new build.

const STORAGE_KEY = "ruwata:stale-chunk-reload";
const RETRY_WINDOW_MS = 10_000;

const STALE_CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk [\w-]+ failed/i,
];

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

/** Reloads the page unless we already reloaded for this reason very recently. */
export function reloadForStaleChunk(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() - last < RETRY_WINDOW_MS) return false;
    window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — still reload once.
  }
  window.location.reload();
  return true;
}
