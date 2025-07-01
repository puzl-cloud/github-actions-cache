import * as core from "@actions/core";
import { ChildProcess } from "child_process";
import fs from "fs";
import { join } from "path";

import { CACHE_DIR, InputSkipFailure } from "./constants";
import { CopyOptions } from "./options";
import { isCacheFunctionEnabled, runTarCommand } from "./utils/actionUtils";
import { tryRestoreFromKey } from "./utils/cacheUtils";
import { resolvePaths } from "./utils/common";

export class ReserveCacheError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReserveCacheError";
        Object.setPrototypeOf(this, ReserveCacheError.prototype);
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export function checkPaths(paths: string[]): void {
    if (!paths || paths.length === 0) {
        throw new ValidationError(
            `Path Validation Error: At least one directory or file path is required`
        );
    }
}

export function checkKey(key: string): void {
    if (key.length > 255) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot be larger than 255 characters.`
        );
    }
    const regex = /^[^,]*$/;
    if (!regex.test(key)) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot contain commas.`
        );
    }
}

/**
 * Restores cache from keys
 *
 * @param primaryKey an explicit key for restoring the cache
 * @param fallbackKeys
 * @param cacheDirs
 * @param options
 * @returns string returns the key for the cache hit, otherwise returns undefined
 */
export async function restoreCache(
    primaryKey: string,
    fallbackKeys: string[] = [],
    cacheDirs: string[],
    options?: CopyOptions
): Promise<string | undefined> {
    checkKey(primaryKey);

    if (!cacheDirs?.length) {
        throw new ReserveCacheError(
            `Cache directories not provided. Unable to restore cache.`
        );
    }

    const restoredKey = await tryRestoreFromKey(primaryKey, cacheDirs, options);

    if (restoredKey) {
        return restoredKey;
    }

    for (const fallbackKey of fallbackKeys) {
        const restoredFallback = await tryRestoreFromKey(
            fallbackKey,
            cacheDirs,
            options
        );

        if (restoredFallback) {
            return restoredFallback;
        }
    }

    core.info(
        `Cache not found for keys: ${[primaryKey, ...fallbackKeys].join(", ")}`
    );

    return undefined;
}

/**
 * Saves a list of files with the specified key
 *
 * @param paths a list of file paths to be cached
 * @param key an explicit key for restoring the cache
 * @param concurrencyLimit is the number of concurrent processes to use for saving the cache
 * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
 */
export async function saveCache(
    paths: string[],
    key: string,
    concurrencyLimit: number = 10
): Promise<number> {
    if (!isCacheFunctionEnabled()) {
        return 0;
    }

    checkKey(key);

    const resolvedPaths = await resolvePaths(paths);

    checkPaths(resolvedPaths);

    const cacheDir: string | undefined = CACHE_DIR.cache;

    const keyCacheDir = join(cacheDir, key);

    await fs.promises.mkdir(keyCacheDir, { recursive: true });

    const skipFailure =
        core.getInput(InputSkipFailure)?.toLowerCase() === "true";

    const childProcesses: ChildProcess[] = [];

    try {
        for (
            let i = 0, j = 0;
            i < resolvedPaths.length;
            i += concurrencyLimit, j++
        ) {
            const batch = resolvedPaths.slice(i, i + concurrencyLimit);
            core.info(
                `Saving batch ${j + 1}; batch size: ${batch.length}; total paths: ${resolvedPaths.length}.`
            );

            await Promise.all(
                batch.map(path => {
                    const encodedPath = Buffer.from(path).toString("base64");
                    const cachePath = join(keyCacheDir, encodedPath);
                    return runTarCommand(path, cachePath, childProcesses);
                })
            );
        }
    } catch (err) {
        core.warning(`Error during saveCache: ${err}`);
        if (!skipFailure) {
            core.info(`Killing all running tar processes...`);
            for (const child of childProcesses) {
                try {
                    if (!child.killed) {
                        child.kill();
                    }
                } catch (killErr) {
                    core.warning(`Failed to kill process: ${killErr}`);
                }
            }
            throw err;
        }
    }

    return 420;
}
