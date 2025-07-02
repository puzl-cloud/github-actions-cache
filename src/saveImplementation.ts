import * as core from "@actions/core";

import * as cache from "./cache";
import { Inputs, State } from "./constants";
import * as utils from "./utils/actionUtils";
import { IStateProvider, StateProvider } from "./stateProvider";

// Catch and log any unhandled exceptions.  These exceptions can leak out of the uploadChunk method in
// @actions/toolkit when a failed upload closes the file descriptor causing any in-process reads to
// throw an uncaught exception.  Instead of failing this action, just warn.
process.on("uncaughtException", e => utils.logWarning(e.message));

async function run(stateProvider: IStateProvider): Promise<void> {
    if (!utils.isCacheFunctionEnabled()) {
        return;
    }

    try {
        const state = utils.getCacheState();

        // Inputs are re-evaluted before the post action, so we want the original key used for restore
        const primaryKey = stateProvider.getState(State.CachePrimaryKey);

        if (!primaryKey) {
            utils.logWarning(`Error retrieving key from state.`);
            return;
        }

        if (utils.isExactKeyMatch(primaryKey, state)) {
            core.info(
                `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
            );
            return;
        }

        const rawPath = utils.getInputAsArray(Inputs.Path, {
            required: true
        });
        const cachePaths = utils.parseCachePaths(rawPath);

        const cacheId = await cache.saveCache(cachePaths, primaryKey);

        if (cacheId != -1) {
            core.info(`Cache saved with key: ${primaryKey}`);
        }
    } catch (error: unknown) {
        utils.logWarning((error as Error).message);
    }
}

// Wrap the run function to handle errors
const wrappedRun = async () => {
    try {
        await run(new StateProvider());
    } catch (error: unknown) {
        core.setFailed((error as Error).message);
        throw error;
    }
};

export default wrappedRun;
