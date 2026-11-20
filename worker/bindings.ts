export interface Bindings {
  PAASTER: DurableObjectNamespace;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  MAX_FILE_COUNT?: string;
  MAX_TOTAL_SIZE_MB?: string;
  /** Public base URL of the bucket, no trailing slash. */
  R2_PUBLIC_URL?: string;
}
