export enum Inputs {
    Key = "key",
    Path = "path",
    RestoreKeys = "restore-keys",
    FailOnCacheMiss = "fail-on-cache-miss", // Input for cache, restore action
    LookupOnly = "lookup-only" // Input for cache, restore action
}

export const InputSkipFailure = "skip-failure";

export enum Outputs {
    CacheHit = "cache-hit"
}

export enum State {
    CachePrimaryKey = "CACHE_KEY",
    CacheMatchedKey = "CACHE_RESULT"
}

export enum Events {
    Key = "GITHUB_EVENT_NAME",
    Push = "push",
    PullRequest = "pull_request"
}

export const RefKey = "GITHUB_REF";

export const CACHE_DIR = {
    cache: process.env.__PUZL_CACHE_DIR || "/.puzl/cache",
    masterBranchCache:
        process.env.__PUZL_MASTER_BRANCH_CACHE_DIR ||
        "/.puzl/master-branch-cache",
    defaultBranchCache:
        process.env.__PUZL_DEFAULT_BRANCH_CACHE_DIR ||
        "/.puzl/default-branch-cache"
};

export const TAR_COMMAND = "tar -I pigz";
