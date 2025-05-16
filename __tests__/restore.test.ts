import type { restoreCache as restoreCacheFn } from "../src/cache";

const DEFAULT_PRIMARY_KEY = "default-key";
const DEFAULT_RESTORE_KEYS: string[] = [];
const DEFAULT_OPTIONS = {
    lookupOnly: false
};

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

type Mocks = {
    restoreCache: jest.SpiedFunction<typeof restoreCacheFn>;
    core: typeof import("@actions/core");
    actionUtils: typeof import("../src/utils/actionUtils");
};

async function runWithMocks(overrides: Record<string, string> = {}) {
    jest.resetModules();

    jest.doMock("@actions/core", () => ({
        getInput: jest.fn((name: string) => {
            const inputs = {
                key: DEFAULT_PRIMARY_KEY,
                path: "some/path",
                "restore-only": "false",
                ...overrides
            };
            return inputs[name] || "";
        }),
        setOutput: jest.fn(),
        saveState: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
        setFailed: jest.fn()
    }));

    let run!: () => Promise<void>;
    let mocks!: Mocks;

    await jest.isolateModulesAsync(async () => {
        const core = await import("@actions/core");
        const cacheModule = await import("../src/cache");
        const actionUtils = await import("../src/utils/actionUtils");

        jest.spyOn(actionUtils, "isCacheFunctionEnabled").mockReturnValue(true);
        jest.spyOn(actionUtils, "getPrimaryKey").mockReturnValue(
            DEFAULT_PRIMARY_KEY
        );

        const restoreCache = jest.spyOn(cacheModule, "restoreCache");

        mocks = {
            restoreCache,
            core,
            actionUtils
        };

        run = (await import("../src/restore")).default;
    });

    return { run, mocks };
}

describe("restore", () => {
    test("cache should be checked in the pull request cache directory", async () => {
        const { run, mocks } = await runWithMocks();

        await run();

        expect(mocks.restoreCache).toHaveBeenCalledWith(
            DEFAULT_PRIMARY_KEY,
            DEFAULT_RESTORE_KEYS,
            [
                "/.puzl/cache",
                "/.puzl/master-branch-cache",
                "/.puzl/default-branch-cache"
            ],
            DEFAULT_OPTIONS
        );
    });

    test("should throw error if cache key not found and failOnCacheMiss=true", async () => {
        const { run, mocks } = await runWithMocks();

        mocks.restoreCache.mockResolvedValueOnce(undefined);
        jest.spyOn(mocks.actionUtils, "getInputAsBool").mockReturnValue(true);

        await expect(run()).rejects.toThrow(
            "Failed to restore cache entry. Exiting as fail-on-cache-miss is set. Input key: default-key"
        );
    });

    test("should not throw error if cache key not found and failOnCacheMiss=false", async () => {
        const { run, mocks } = await runWithMocks();

        mocks.restoreCache.mockResolvedValueOnce(undefined);
        jest.spyOn(mocks.actionUtils, "getInputAsBool").mockReturnValue(false);
        const setFailedMock = jest.spyOn(mocks.core, "setFailed");

        await run();

        expect(mocks.restoreCache).toHaveBeenCalled();
        expect(setFailedMock).not.toHaveBeenCalled();
    });

    test("should log lookupOnly message when cache hit is found and lookupOnly=true", async () => {
        const { run, mocks } = await runWithMocks();

        mocks.restoreCache.mockResolvedValueOnce("restored-key");
        jest.spyOn(mocks.actionUtils, "isExactKeyMatch").mockReturnValue(true);
        jest.spyOn(mocks.actionUtils, "getInputAsBool").mockReturnValue(true);
        const infoMock = jest.spyOn(mocks.core, "info");

        await run();

        expect(infoMock).toHaveBeenCalledWith(
            expect.stringContaining("Cache found and can be restored from key")
        );
    });

    test("should log lookupOnly message when cache hit is found and lookupOnly=false", async () => {
        const { run, mocks } = await runWithMocks();

        mocks.restoreCache.mockResolvedValueOnce("restored-key");
        jest.spyOn(mocks.actionUtils, "isExactKeyMatch").mockReturnValue(true);
        jest.spyOn(mocks.actionUtils, "getInputAsBool").mockReturnValue(false);
        const infoMock = jest.spyOn(mocks.core, "info");

        await run();

        expect(infoMock).toHaveBeenCalledWith(
            expect.stringContaining("Cache restored from key")
        );
    });
});
