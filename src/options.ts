/**
 * Options to control cache copy
 */
export interface CopyOptions {
    /**
     * Weather to skip copy the cache entry.
     * If lookupOnly is set to true, the restore function will only check if
     * a matching cache entry exists and return the cache key if it does.
     *
     * @default false
     */
    lookupOnly?: boolean;
}
