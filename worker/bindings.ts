export interface Bindings {
  PAASTER: DurableObjectNamespace;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  MAX_FILE_COUNT?: string;
  MAX_TOTAL_SIZE_MB?: string;
  /** Public base URL of the bucket, no trailing slash. */
  R2_PUBLIC_URL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}
