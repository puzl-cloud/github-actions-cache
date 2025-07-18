import * as core from "@actions/core";
import { execSync } from "child_process";
import * as fs from "fs";
import os from "os";
import * as path from "path";

import { Events, Outputs, RefKey, State, TAR_COMMAND } from "../src/constants";
import { StateProvider } from "../src/stateProvider";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("@actions/cache");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });
});

afterEach(() => {
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("isGhes returns true if server url is not github.com", () => {
    try {
        process.env["GITHUB_SERVER_URL"] = "http://example.com";
        expect(actionUtils.isGhes()).toBe(true);
    } finally {
        process.env["GITHUB_SERVER_URL"] = undefined;
    }
});

test("isGhes returns false when server url is github.com", () => {
    try {
        process.env["GITHUB_SERVER_URL"] = "http://github.com";
        expect(actionUtils.isGhes()).toBe(false);
    } finally {
        process.env["GITHUB_SERVER_URL"] = undefined;
    }
});

test("isExactKeyMatch with undefined cache key returns false", () => {
    const key = "linux-rust";
    const cacheKey = undefined;

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with empty cache key returns false", () => {
    const key = "linux-rust";
    const cacheKey = "";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with different keys returns false", () => {
    const key = "linux-rust";
    const cacheKey = "linux-";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with different key accents returns false", () => {
    const key = "linux-áccent";
    const cacheKey = "linux-accent";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(false);
});

test("isExactKeyMatch with same key returns true", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(true);
});

test("isExactKeyMatch with same key and different casing returns true", () => {
    const key = "linux-rust";
    const cacheKey = "LINUX-RUST";

    expect(actionUtils.isExactKeyMatch(key, cacheKey)).toBe(true);
});

test("setOutputAndState with undefined entry to set cache-hit output", () => {
    const key = "linux-rust";
    const cacheKey = undefined;

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledTimes(0);
});

test("setOutputAndState with exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust";

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "true");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(State.CacheMatchedKey, cacheKey);
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("setOutputAndState with no exact match to set cache-hit output and state", () => {
    const key = "linux-rust";
    const cacheKey = "linux-rust-bb828da54c148048dd17899ba9fda624811cfb43";

    const setOutputMock = jest.spyOn(core, "setOutput");
    const saveStateMock = jest.spyOn(core, "saveState");

    actionUtils.setOutputAndState(key, cacheKey);

    expect(setOutputMock).toHaveBeenCalledWith(Outputs.CacheHit, "false");
    expect(setOutputMock).toHaveBeenCalledTimes(1);

    expect(saveStateMock).toHaveBeenCalledWith(State.CacheMatchedKey, cacheKey);
    expect(saveStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with no state returns undefined", () => {
    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return "";
    });

    const state = actionUtils.getCacheState(new StateProvider());

    expect(state).toBe(undefined);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheMatchedKey);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("getCacheState with valid state", () => {
    const cacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";

    const getStateMock = jest.spyOn(core, "getState");
    getStateMock.mockImplementation(() => {
        return cacheKey;
    });

    const state = actionUtils.getCacheState(new StateProvider());

    expect(state).toEqual(cacheKey);

    expect(getStateMock).toHaveBeenCalledWith(State.CacheMatchedKey);
    expect(getStateMock).toHaveBeenCalledTimes(1);
});

test("logWarning logs a message with a warning prefix", () => {
    const message = "A warning occurred.";

    const infoMock = jest.spyOn(core, "info");

    actionUtils.logWarning(message);

    expect(infoMock).toHaveBeenCalledWith(`[warning]${message}`);
});

test("getInputAsArray returns empty array if not required and missing", () => {
    expect(actionUtils.getInputAsArray("foo")).toEqual([]);
});

test("getInputAsArray throws error if required and missing", () => {
    expect(() =>
        actionUtils.getInputAsArray("foo", { required: true })
    ).toThrowError();
});

test("getInputAsArray handles single line correctly", () => {
    testUtils.setInput("foo", "bar");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar"]);
});

test("getInputAsArray handles multiple lines correctly", () => {
    testUtils.setInput("foo", "bar\nbaz");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsArray handles different new lines correctly", () => {
    testUtils.setInput("foo", "bar\r\nbaz");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsArray handles empty lines correctly", () => {
    testUtils.setInput("foo", "\n\nbar\n\nbaz\n\n");
    expect(actionUtils.getInputAsArray("foo")).toEqual(["bar", "baz"]);
});

test("getInputAsArray removes spaces after ! at the beginning", () => {
    testUtils.setInput(
        "foo",
        "!   bar\n!  baz\n! qux\n!quux\ncorge\ngrault! garply\n!\r\t waldo"
    );
    expect(actionUtils.getInputAsArray("foo")).toEqual([
        "!bar",
        "!baz",
        "!qux",
        "!quux",
        "corge",
        "grault! garply",
        "!waldo"
    ]);
});

test("getInputAsInt returns undefined if input not set", () => {
    expect(actionUtils.getInputAsInt("undefined")).toBeUndefined();
});

test("getInputAsInt returns value if input is valid", () => {
    testUtils.setInput("foo", "8");
    expect(actionUtils.getInputAsInt("foo")).toBe(8);
});

test("getInputAsInt returns undefined if input is invalid or NaN", () => {
    testUtils.setInput("foo", "bar");
    expect(actionUtils.getInputAsInt("foo")).toBeUndefined();
});

test("getInputAsInt throws if required and value missing", () => {
    expect(() =>
        actionUtils.getInputAsInt("undefined", { required: true })
    ).toThrowError();
});

describe("runTarCommand (integration)", () => {
    let tempDir: string;
    let childProcesses: import("child_process").ChildProcess[];

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "tar-test-")
        );
        childProcesses = [];
    });

    afterEach(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    it("creates a tar archive from a directory", async () => {
        // Create a file to archive
        const srcDir = path.join(tempDir, "src");
        await fs.promises.mkdir(srcDir);
        const filePath = path.join(srcDir, "file.txt");
        await fs.promises.writeFile(filePath, "hello world");

        const destTar = path.join(tempDir, "archive.tar");

        await actionUtils.runTarCommand(srcDir, destTar, childProcesses);

        // Check that the tar file exists and is not empty
        const stat = await fs.promises.stat(destTar);
        expect(stat.isFile()).toBe(true);
        expect(stat.size).toBeGreaterThan(0);

        // Extract and verify contents
        const extractDir = path.join(tempDir, "extract");
        await fs.promises.mkdir(extractDir);
        const cmd = `bash -c "${TAR_COMMAND} -xf ${destTar} -C ${extractDir}"`;
        execSync(cmd, { stdio: "inherit" });

        const extractedFile = path.join(srcDir, "file.txt");
        const content = await fs.promises.readFile(extractedFile, "utf8");
        expect(content).toBe("hello world");
    });

    it("fails when the source directory does not exist", async () => {
        const nonExistentDir = path.join(tempDir, "does-not-exist");
        const destTar = path.join(tempDir, "archive-fail.tar");
        await expect(
            actionUtils.runTarCommand(nonExistentDir, destTar, childProcesses)
        ).rejects.toThrow(/Tar failed|no such file or directory|Error/);
    });

    it("fails when the destination path cannot be written", async () => {
        // Create a source directory and file
        const srcDir = path.join(tempDir, "src2");
        await fs.promises.mkdir(srcDir);
        const filePath = path.join(srcDir, "file.txt");
        await fs.promises.writeFile(filePath, "hello world");

        // Use a destination path in a non-existent directory
        const destTar = path.join(tempDir, "no-such-dir", "archive.tar");
        await expect(
            actionUtils.runTarCommand(srcDir, destTar, childProcesses)
        ).rejects.toThrow(/Tar failed|no such file or directory|Error/);
    });
});
