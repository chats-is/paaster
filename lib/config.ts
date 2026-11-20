// Upload limits. The Worker enforces the same numbers from its own vars
// (MAX_FILE_COUNT, MAX_TOTAL_SIZE_MB). Override the browser copy with
// VITE_MAX_FILE_COUNT and VITE_MAX_TOTAL_SIZE_MB, and keep the two in step.

export const MAX_FILE_COUNT = parseInt(
  import.meta.env.VITE_MAX_FILE_COUNT || "10",
  10
);

// Combined size of all files in a single paste, in megabytes.
export const MAX_TOTAL_SIZE_MB = parseInt(
  import.meta.env.VITE_MAX_TOTAL_SIZE_MB || "50",
  10
);

export const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
