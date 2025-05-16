import * as core from "@actions/core";
import { ChildProcess } from "child_process";
import fs from "fs";

import * as cacheModule from "../src/cache";
import { CACHE_DIR } from "../src/constants";
import * as actionUtils from "../src/utils/actionUtils";
import * as cacheUtils from "../src/utils/cacheUtils";

const MOCKED_PRIMARY_KEY = "mocked-primary-key";
const MOCKED_RESTORED_KEY = MOCKED_PRIMARY_KEY;
const MOCKED_FALLBACK_KEYS = [];
const MOCKED_CACHE_DIRS = [CACHE_DIR.cache];
const MOCKED_RESTORE_OPTIONS = undefined;

jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    promises: {
        access: jest.fn(),
        readdir: jest.fn(),
        stat: jest.fn(),
        mkdir: jest.fn()
    }
}));

const accessMock = fs.promises.access as jest.Mock;
const readdirMock = fs.promises.readdir as jest.Mock;

jest.mock("@actions/core");

jest.mock("../src/utils/actionUtils", () => {
    const actual = jest.requireActual("../src/utils/actionUtils");
    return {
        ...actual,
        execAsync: jest.fn(),
        isCacheFunctionEnabled: jest.fn(),
        runTarCommand: jest.fn()
    };
});

jest.mock("../src/utils/cacheUtils", () => {
    const actual = jest.requireActual("../src/utils/cacheUtils");
    return {
        ...actual,
        tryRestoreFromKey: jest.fn()
    };
});

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    accessMock.mockReset();
    readdirMock.mockReset();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("ReserveCacheError", () => {
    test("should create an instance with correct name and message", () => {
        const message = "Test error message";
        const error = new cacheModule.ReserveCacheError(message);

        expect(error).toBeInstanceOf(cacheModule.ReserveCacheError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("ReserveCacheError");
        expect(error.message).toBe(message);
    });
});

describe("checkPaths", () => {
    test("should throw ValidationError if paths is undefined", () => {
        expect(() =>
            cacheModule.checkPaths(undefined as unknown as string[])
        ).toThrowError(cacheModule.ValidationError);
    });

    test("should throw ValidationError if paths is an empty array", () => {
        expect(() => cacheModule.checkPaths([])).toThrowError(
            cacheModule.ValidationError
        );
    });

    test("should not throw if paths contains at least one entry", () => {
        expect(() => cacheModule.checkPaths(["./dist"])).not.toThrow();
    });
});

describe("checkKey", () => {
    test("should throw ValidationError if key is longer than 255 characters", () => {
        const longKey = "a".repeat(256);
        expect(() => cacheModule.checkKey(longKey)).toThrowError(
            cacheModule.ValidationError
        );
    });

    test("should throw ValidationError if key contains a comma", () => {
        const badKey = "foo,bar";
        expect(() => cacheModule.checkKey(badKey)).toThrowError(
            cacheModule.ValidationError
        );
    });

    test("should not throw if key is valid", () => {
        const goodKey = "valid-cache-key";
        expect(() => cacheModule.checkKey(goodKey)).not.toThrow();
    });
});

describe("restoreCache", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        accessMock.mockResolvedValue(undefined);
        readdirMock.mockResolvedValue([
            { name: "file.tar", isFile: () => true }
        ]);
    });

    test("should throw if cacheDirs is empty", async () => {
        await expect(
            cacheModule.restoreCache(
                MOCKED_PRIMARY_KEY,
                MOCKED_FALLBACK_KEYS,
                [],
                MOCKED_RESTORE_OPTIONS
            )
        ).rejects.toThrow(cacheModule.ReserveCacheError);
    });

    test("should return restored key if it's found", async () => {
        const tryRestoreSpy = jest
            .spyOn(cacheUtils, "tryRestoreFromKey")
            .mockResolvedValue(MOCKED_RESTORED_KEY);

        const result = await cacheModule.restoreCache(
            MOCKED_PRIMARY_KEY,
            MOCKED_FALLBACK_KEYS,
            MOCKED_CACHE_DIRS,
            MOCKED_RESTORE_OPTIONS
        );

        expect(result).toBe(MOCKED_RESTORED_KEY);
        expect(tryRestoreSpy).toHaveBeenCalled();
    });

    test("should return fallback key if primary fails and fallback succeeds", async () => {
        (cacheUtils.tryRestoreFromKey as jest.Mock)
            .mockResolvedValueOnce(undefined) // primary miss
            .mockResolvedValueOnce("fallback-key"); // fallback hit

        const result = await cacheModule.restoreCache(
            MOCKED_PRIMARY_KEY,
            ["fallback-key"],
            MOCKED_CACHE_DIRS,
            MOCKED_RESTORE_OPTIONS
        );

        expect(result).toBe("fallback-key");
        expect(
            (cacheUtils.tryRestoreFromKey as jest.Mock).mock.calls.length
        ).toBe(2);
    });

    test("should return undefined if no keys are restored", async () => {
        (cacheUtils.tryRestoreFromKey as jest.Mock)
            .mockResolvedValueOnce(undefined) // primary miss
            .mockResolvedValueOnce(undefined); // fallback miss

        accessMock.mockResolvedValue(undefined);
        readdirMock.mockResolvedValue([]);

        const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});

        const result = await cacheModule.restoreCache(
            MOCKED_PRIMARY_KEY,
            ["fallback-key"],
            MOCKED_CACHE_DIRS,
            MOCKED_RESTORE_OPTIONS
        );

        expect(result).toBeUndefined();
        expect(infoMock).toHaveBeenCalledWith(
            "Cache not found for keys: mocked-primary-key, fallback-key"
        );
    });
});

describe("saveCache", () => {
    const mkdirMock = fs.promises.mkdir as jest.Mock;
    const getInputMock = jest.spyOn(core, "getInput");
    const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});
    const warningMock = jest
        .spyOn(core, "warning")
        .mockImplementation(() => {});

    beforeEach(() => {
        jest.resetAllMocks();
        jest.useFakeTimers();
        mkdirMock.mockReset();
        accessMock.mockResolvedValue(undefined);
        readdirMock.mockResolvedValue([]);
        getInputMock.mockReset();
        infoMock.mockClear();
        warningMock.mockClear();
    });

    test("should return 0 if cache function is disabled", async () => {
        (actionUtils.isCacheFunctionEnabled as jest.Mock).mockReturnValue(
            false
        );

        const result = await cacheModule.saveCache(["./dist"], "my-key");
        expect(result).toBe(0);
    });

    test("should save cache and run tar command", async () => {
        (actionUtils.isCacheFunctionEnabled as jest.Mock).mockReturnValue(true);
        accessMock.mockResolvedValue(undefined);
        mkdirMock.mockResolvedValue(undefined);

        const runTarMock = (
            actionUtils.runTarCommand as jest.Mock
        ).mockResolvedValue(undefined);

        const result = await cacheModule.saveCache(
            ["file-a", "file-b"],
            "my-key",
            1 // concurrency = 1
        );

        expect(mkdirMock).toHaveBeenCalledWith(
            expect.stringContaining("my-key"),
            {
                recursive: true
            }
        );

        expect(runTarMock).toHaveBeenCalledTimes(2);
        expect(result).toBe(420);
        expect(infoMock).toHaveBeenCalledWith(
            expect.stringContaining("Saving batch 1")
        );
        expect(infoMock).toHaveBeenCalledWith(
            expect.stringContaining("Saving batch 2")
        );
    });

    test("should kill child processes and rethrow error if save fails and skip-failure is false", async () => {
        (actionUtils.isCacheFunctionEnabled as jest.Mock).mockReturnValue(true);
        accessMock.mockResolvedValue(undefined);
        mkdirMock.mockResolvedValue(undefined);
        getInputMock.mockReturnValue("false");

        (actionUtils.runTarCommand as jest.Mock).mockImplementation(() => {
            throw new Error("tar failed");
        });

        await expect(
            cacheModule.saveCache(["file-a"], "key", 1)
        ).rejects.toThrow("tar failed");

        expect(warningMock).toHaveBeenCalledWith(
            expect.stringContaining("Error during saveCache")
        );
        expect(infoMock).toHaveBeenCalledWith(
            expect.stringContaining("Killing all running tar processes")
        );
    });

    test("should log warning but not throw if save fails and skip-failure is true", async () => {
        (actionUtils.isCacheFunctionEnabled as jest.Mock).mockReturnValue(true);
        accessMock.mockResolvedValue(undefined);
        mkdirMock.mockResolvedValue(undefined);
        getInputMock.mockReturnValue("true");

        (actionUtils.runTarCommand as jest.Mock).mockImplementation(() => {
            throw new Error("expected failure");
        });

        const result = await cacheModule.saveCache(["file-a"], "key", 1);

        expect(result).toBe(420);
        expect(warningMock).toHaveBeenCalledWith(
            expect.stringContaining("Error during saveCache")
        );
    });

    test("should warn if killing a child process fails during save error", async () => {
        jest.spyOn(actionUtils, "isCacheFunctionEnabled").mockReturnValue(true);
        accessMock.mockResolvedValue(undefined);
        mkdirMock.mockResolvedValue(undefined);
        getInputMock.mockReturnValue(""); // skip-failure = false

        // Mock runTarCommand to push a broken child process into the array and throw
        const mockChild = {
            killed: false,
            kill: jest.fn(() => {
                throw new Error("kill error");
            })
        } as unknown as ChildProcess;

        jest.spyOn(actionUtils, "runTarCommand").mockImplementation(
            (_, __, children) => {
                children.push(mockChild);
                throw new Error("tar error");
            }
        );

        const warnSpy = jest
            .spyOn(core, "warning")
            .mockImplementation(() => {});
        const infoSpy = jest.spyOn(core, "info").mockImplementation(() => {});

        await expect(
            cacheModule.saveCache(["./fail-path"], "failing-key")
        ).rejects.toThrow("tar error");

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Failed to kill process")
        );
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining("Killing all running tar processes")
        );
    });
});
