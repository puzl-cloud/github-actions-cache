import * as core from "@actions/core";
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
