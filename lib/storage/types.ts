export interface StorageProvider {
  // Upload an object under `key` and return its publicly reachable URL.
  upload(
    key: string,
    file: File,
    opts: { cacheMaxAge: number }
  ): Promise<string>;

  // Delete a previously uploaded object, given the URL returned by upload().
  delete(url: string): Promise<void>;
}
