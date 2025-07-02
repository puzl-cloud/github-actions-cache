import * as core from "@actions/core";

import * as cache from "./cache";
import { CACHE_DIR, Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";
import { IStateProvider } from "./stateProvider";

async function run(stateProvider: IStateProvider): Promise<void> {
    if (!utils.isCacheFunctionEnabled()) {
        return;
    }

    const lookupInDirs = [
        CACHE_DIR.cache,
        CACHE_DIR.masterBranchCache,
        CACHE_DIR.defaultBranchCache
    ];

    const primaryKey = utils.getPrimaryKey();

    stateProvider.setState(State.CachePrimaryKey, primaryKey);

    const restoreKeys = utils.getInputAsArray(Inputs.RestoreKeys);
    const failOnCacheMiss = utils.getInputAsBool(Inputs.FailOnCacheMiss);
    const lookupOnly = utils.getInputAsBool(Inputs.LookupOnly);

    const cacheKey = await cache.restoreCache(
        primaryKey,
        restoreKeys,
        lookupInDirs,
        {
            lookupOnly: lookupOnly
        }
    );

    if (!cacheKey) {
        if (failOnCacheMiss) {
            throw new Error(
                `Failed to restore cache entry. Exiting as fail-on-cache-miss is set. Input key: ${primaryKey}`
            );
        }
        core.info(
            `Cache not found for input keys: ${[
                primaryKey,
                ...restoreKeys
            ].join(", ")}`
        );

        return;
    }

    // Store the matched cache key
    utils.setCacheState(cacheKey);

    const isExactKeyMatch = utils.isExactKeyMatch(primaryKey, cacheKey);
    utils.setCacheHitOutput(isExactKeyMatch);
    if (lookupOnly) {
        core.info(`Cache found and can be restored from key: ${cacheKey}`);
    } else {
        core.info(`Cache restored from key: ${cacheKey}`);
    }
}

// Wrap the run function to handle errors
const wrappedRun = async (stateProvider: IStateProvider) => {
    try {
        await run(stateProvider);
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
        throw error; // Re-throw the error for testing
    }
};

export default wrappedRun;
