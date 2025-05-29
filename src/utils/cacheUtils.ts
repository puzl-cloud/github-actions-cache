import * as core from "@actions/core";
import fs from "fs";
import path, { dirname } from "path";
import prettyBytes from "pretty-bytes";

import { TAR_COMMAND } from "../constants";
import { CopyOptions } from "../options";
import { execAsync } from "./actionUtils";
import { streamOutputUntilResolved } from "./common";

export async function locateCacheFiles(cacheDir: string): Promise<string[]> {
    try {
        await fs.promises.access(cacheDir);
    } catch {
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
    const encodedBaseDir = path.basename(archivePath);

    if (!encodedBaseDir) {
        throw new Error("Failed to determine `encodedBaseDir`");
    }

    const cacheStats = await fs.promises.stat(archivePath);

    core.info(
        [
            `Restoring cache from ${archivePath}`,
            `Created: ${cacheStats.mtime}`,
            `Size: ${prettyBytes(cacheStats.size || 0)}`
        ].join("\n")
    );

    if (!encodedBaseDir)
        throw new Error("Failed to determine `encodedBaseDir`");

    const originalBaseDir = Buffer.from(encodedBaseDir, "base64").toString(
        "utf-8"
    );

    if (!originalBaseDir) {
        throw new Error("Failed to decode archive path from base64");
    }

    const parentDir = dirname(originalBaseDir);

    await fs.promises.mkdir(parentDir, { recursive: true });

    // Restoring the archive to the root project directory
    // Tar will automatically extract everything to the same paths it was created from
    const cmd = `bash -c "${TAR_COMMAND} -xf ${archivePath} -C ${parentDir}"`;
    const extractPromise = execAsync(cmd);

    try {
        await streamOutputUntilResolved(extractPromise);
    } catch (err) {
        const skipFailure = core.getInput("skip-failure") || false;
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
