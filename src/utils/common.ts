import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { PromiseWithChild } from "child_process";

export async function streamOutputUntilResolved(
    promise: PromiseWithChild<unknown>
): Promise<unknown> {
    const { child } = promise;
    const { stdout, stderr } = child;

    if (stdout) {
        stdout.on("data", data => {
            core.info(data.toString().trim());
        });
    }

    if (stderr) {
        stderr.on("data", data => {
            if (!data) {
                return;
            }
            core.warning(data.toString().trim());
        });
    }

    return promise;
}

export async function resolvePaths(inputPaths: string[]): Promise<string[]> {
    const matchedPaths = new Set<string>();

    for (const pattern of inputPaths) {
        const globber = await glob.create(pattern);
        for await (const file of globber.globGenerator()) {
            matchedPaths.add(file);
        }
    }

    return [...matchedPaths];
}