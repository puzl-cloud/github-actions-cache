import { PassThrough } from "node:stream";

import * as core from "@actions/core";
import { ChildProcess, PromiseWithChild } from "child_process";

import { streamOutputUntilResolved } from "../src/utils/common";

describe("streamOutputUntilResolved", () => {
    test("should log info from stdout", async () => {
        const stdout = new PassThrough();

        const promise = Promise.resolve(
            "resolved-value"
        ) as PromiseWithChild<unknown>;
        promise.child = {
            stdout,
            stderr: null
        } as unknown as ChildProcess;

        const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});

        const result = streamOutputUntilResolved(promise);

        stdout.emit("data", Buffer.from("hello stdout\n"));
        stdout.end();

        await expect(result).resolves.toBe("resolved-value");

        expect(infoMock).toHaveBeenCalledWith("hello stdout");
    });

    test("should log warning from stderr", async () => {
        const stderr = new PassThrough();

        const promise = Promise.resolve(
            "resolved-value"
        ) as PromiseWithChild<unknown>;
        promise.child = {
            stdout: null,
            stderr
        } as unknown as ChildProcess;

        const warnMock = jest
            .spyOn(core, "warning")
            .mockImplementation(() => {});

        const result = streamOutputUntilResolved(promise);

        stderr.emit("data", Buffer.from("error occurred\n"));
        stderr.end();

        await expect(result).resolves.toBe("resolved-value");

        expect(warnMock).toHaveBeenCalledWith("error occurred");
    });

    test("should do nothing if both stdout and stderr are null", async () => {
        const promise = Promise.resolve(
            "resolved-value"
        ) as PromiseWithChild<unknown>;
        promise.child = {
            stdout: null,
            stderr: null
        } as unknown as ChildProcess;

        const infoMock = jest.spyOn(core, "info");
        const warnMock = jest.spyOn(core, "warning");

        await expect(streamOutputUntilResolved(promise)).resolves.toBe(
            "resolved-value"
        );

        expect(infoMock).not.toHaveBeenCalled();
        expect(warnMock).not.toHaveBeenCalled();
    });

    test("should ignore falsy stderr data", async () => {
        const stderr = new PassThrough();

        const fakePromise: PromiseWithChild<unknown> = Promise.resolve(
            "done"
        ) as PromiseWithChild<unknown>;
        fakePromise.child = {
            stdout: null,
            stderr
        } as unknown as ChildProcess;

        const warnMock = jest.spyOn(core, "warning");

        const result = streamOutputUntilResolved(fakePromise);

        stderr.emit("data", null); // This triggers the `if (!data)` line
        stderr.end();

        await expect(result).resolves.toBe("done");

        expect(warnMock).not.toHaveBeenCalled();
    });
});
