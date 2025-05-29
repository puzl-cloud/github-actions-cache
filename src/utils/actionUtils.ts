import * as core from "@actions/core";
import { ChildProcess, exec } from "child_process";
import { basename, dirname } from "path";
import { promisify } from "util";

import { Inputs, Outputs, State, TAR_COMMAND } from "../constants";

export function isCacheFunctionEnabled(): boolean {
    const enabled =
        process.env.__PUZL_PUB_CACHE_IS_AVAILABLE?.toLowerCase() == "true";

    if (enabled) {
        return true;
    } else {
        core.warning(
            "The cache function is unavailable on your current service level. To enable it, please upgrade your plan at https://console.puzl.cloud."
        );
        return false;
    }
}

export function getPrimaryKey(): string {
    return core.getInput(Inputs.Key, { required: true });
}

export function isGhes(): boolean {
    const ghUrl = new URL(
        process.env["GITHUB_SERVER_URL"] || "https://github.com"
    );
    return ghUrl.hostname.toUpperCase() !== "GITHUB.COM";
}

export function isExactKeyMatch(key: string, cacheKey?: string): boolean {
    return !!(
        cacheKey &&
        cacheKey.localeCompare(key, undefined, {
            sensitivity: "accent"
        }) === 0
    );
}

export function setCacheState(state: string): void {
    core.saveState(State.CacheMatchedKey, state);
}

export function setCacheHitOutput(isCacheHit: boolean): void {
    core.setOutput(Outputs.CacheHit, isCacheHit.toString());
}

export function setOutputAndState(key: string, cacheKey?: string): void {
    setCacheHitOutput(isExactKeyMatch(key, cacheKey));
    // Store the matched cache key if it exists
    cacheKey && setCacheState(cacheKey);
}

export function getCacheState(): string | undefined {
    const cacheKey = core.getState(State.CacheMatchedKey);
    if (cacheKey) {
        core.debug(`Cache state/key: ${cacheKey}`);
        return cacheKey;
    }

    return undefined;
}

export function logWarning(message: string): void {
    const warningPrefix = "[warning]";
    core.info(`${warningPrefix}${message}`);
}

export function getInputAsArray(
    name: string,
    options?: core.InputOptions
): string[] {
    return core
        .getInput(name, options)
        .split("\n")
        .map(s => s.replace(/^!\s+/, "!").trim())
        .filter(x => x !== "");
}

export function getInputAsInt(
    name: string,
    options?: core.InputOptions
): number | undefined {
    const value = parseInt(core.getInput(name, options));
    if (isNaN(value) || value < 0) {
        return undefined;
    }
    return value;
}

export function getInputAsBool(
    name: string,
    options?: core.InputOptions
): boolean {
    const result = core.getInput(name, options);
    return result.toLowerCase() === "true";
}

export async function runTarCommand(
    srcPath: string,
    destPath: string,
    childProcesses: ChildProcess[]
): Promise<void> {
    const baseDir = dirname(srcPath);
    const folderName = basename(srcPath);

    const cmd = `bash -c "${TAR_COMMAND} -cf ${destPath} -C ${baseDir} ${folderName}"`;

    core.info(
        `Save cache for ${srcPath}: ${Buffer.from(srcPath).toString("base64")}`
    );

    const child = exec(cmd, { maxBuffer: 10 * 1024 * 1024 });

    let stderr = "";

    child.stderr?.on("data", data => {
        stderr += data.toString();
    });

    childProcesses.push(child);

    await new Promise<void>((resolve, reject) => {
        child.on("exit", code => {
            if (code === 0) {
                core.info(`Tar command completed successfully for ${srcPath}`);
                resolve();
            } else {
                reject(
                    new Error(
                        `Tar failed with exit code ${code} for ${srcPath}. Details: ${stderr.trim()}`
                    )
                );
            }
        });
        child.on("error", err => {
            reject(new Error(`Tar process error: ${err.message}`));
        });
    });
}

export const execAsync = promisify(exec);
