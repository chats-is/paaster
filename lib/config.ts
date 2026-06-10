// Upload limits, configurable via environment variables.
// Use the NEXT_PUBLIC_ prefix so the same values are available both in the
// browser (create page validation) and on the server (API enforcement).

export const MAX_FILE_COUNT = parseInt(
  process.env.NEXT_PUBLIC_MAX_FILE_COUNT || "10",
  10
);

// Combined size of all files in a single paste, in megabytes.
export const MAX_TOTAL_SIZE_MB = parseInt(
  process.env.NEXT_PUBLIC_MAX_TOTAL_SIZE_MB || "50",
  10
);

export const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
