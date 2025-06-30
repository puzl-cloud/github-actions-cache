import * as core from "@actions/core";
import fs from "fs";
import path from "path";
import prettyBytes from "pretty-bytes";

import { InputSkipFailure, TAR_COMMAND } from "../constants";
import { CopyOptions } from "../options";
import { execAsync } from "./actionUtils";
import { streamOutputUntilResolved } from "./common";

export async function locateCacheFiles(cacheDir: string): Promise<string[]> {
    try {
        await fs.promises.access(cacheDir);
    } catch {
        core.warning(
            `Cache directory "${cacheDir}" does not exist or is inaccessible.`
        );
        return [];
    }

    const dirents = await fs.promises.readdir(cacheDir, {
        withFileTypes: true
    });

    return dirents
        .filter(entry => entry.isFile())
        .map(entry => path.join(cacheDir, entry.name));
}

export async function collectCacheFile(
    key: string,
    cacheDirs: string[]
): Promise<string[] | undefined> {
    for (const dir of cacheDirs) {
        const cachePath = path.join(dir, key);
        const files = await locateCacheFiles(cachePath);

        if (files.length > 0) {
            core.info(
                `Found ${files.length} cache file${files.length > 1 ? "s" : ""} for key '${key}' in ${cachePath}`
            );
            return files;
        }
    }

    return undefined;
}

export async function restoreCacheArchive(archivePath: string): Promise<void> {
    const cacheStats = await fs.promises.stat(archivePath);

    core.info(
        [
            `Restoring cache from ${archivePath}`,
            `Created: ${cacheStats.mtime}`,
            `Size: ${prettyBytes(cacheStats.size || 0)}`
        ].join("\n")
    );

    // Restoring the archive
    const cmd = `bash -c "${TAR_COMMAND} -xf ${archivePath} -C /"`;
    const extractPromise = execAsync(cmd);

    try {
        await streamOutputUntilResolved(extractPromise);
    } catch (err) {
        const skipFailure = core.getInput(InputSkipFailure) || false;
        core.warning(`Tar command failed: ${err}`);
        if (!skipFailure) {
            throw err;
        }
    }
}

export async function tryRestoreFromKey(
    key: string,
    cacheDirs: string[],
    options?: CopyOptions
): Promise<string | undefined> {
    const archiveFiles = await collectCacheFile(key, cacheDirs);
    if (!archiveFiles?.length) return undefined;

    core.info(`Restoring cache for key: ${key}`);

    if (options?.lookupOnly) {
        core.info(`Only checking key "${key}". Skipping restore.`);
        return key;
    }

    try {
        await Promise.all(archiveFiles.map(file => restoreCacheArchive(file)));
    } catch (err) {
        core.warning(`Restore failed for key "${key}": ${err}`);
    }

    return key;
}
