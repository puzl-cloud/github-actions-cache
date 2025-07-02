import * as core from "@actions/core";
import path from "path";

import * as cache from "../src/cache";
import { saveRun as run } from "../src/saveImplementation";
import * as actionUtils from "../src/utils/actionUtils";

const MOCK_PRIMARY_KEY = "default-key";
const MOCK_SAVED_KEY = "saved-key";
const MOCK_PATHS = ["node_modules"];

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.spyOn(actionUtils, "isCacheFunctionEnabled").mockReturnValue(true);
});

afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
});

describe("save", () => {
    test("should not run if cache function is disabled", async () => {
        const disabledMock = jest.spyOn(actionUtils, "isCacheFunctionEnabled");
        disabledMock.mockReturnValue(false);

        const getCacheStateMock = jest.spyOn(actionUtils, "getCacheState");

        await run();

        expect(getCacheStateMock).toHaveBeenCalledTimes(0);
        expect(disabledMock).toHaveBeenCalled();
    });

    test("should warn if primary key is missing", async () => {
        const logWarningMock = jest
            .spyOn(actionUtils, "logWarning")
            .mockImplementation(() => {});
        jest.spyOn(core, "getState").mockReturnValue("");

        await run();

        expect(logWarningMock).toHaveBeenCalled();
    });
    test("should not save cache if key is exact match", async () => {
        const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});
        jest.spyOn(core, "getState").mockReturnValue(MOCK_PRIMARY_KEY);
        jest.spyOn(actionUtils, "getCacheState").mockReturnValue(
            MOCK_PRIMARY_KEY
        );
        const saveCacheMock = jest.spyOn(cache, "saveCache");

        await run();

        expect(infoMock).toHaveBeenCalled();
        expect(saveCacheMock).not.toHaveBeenCalled();
    });
    test("should save cache if key is not exact match", async () => {
        const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});
        jest.spyOn(core, "getState").mockReturnValue(MOCK_PRIMARY_KEY);
        jest.spyOn(actionUtils, "getCacheState").mockReturnValue(
            MOCK_SAVED_KEY
        );
        jest.spyOn(actionUtils, "isExactKeyMatch").mockReturnValue(false);
        jest.spyOn(cache, "saveCache").mockResolvedValue(123);

        const expectedPaths = MOCK_PATHS.map(p =>
            path.resolve(process.cwd(), p)
        );
        jest.spyOn(actionUtils, "getInputAsArray").mockReturnValue(
            expectedPaths
        );

        await run();

        expect(cache.saveCache).toHaveBeenCalledWith(
            expectedPaths,
            MOCK_PRIMARY_KEY
        );
        expect(infoMock).toHaveBeenCalled();
    });

    test("should not log success message if cacheId is -1", async () => {
        const infoMock = jest.spyOn(core, "info").mockImplementation(() => {});
        jest.spyOn(core, "getState").mockReturnValue(MOCK_PRIMARY_KEY);
        jest.spyOn(actionUtils, "getCacheState").mockReturnValue(
            MOCK_SAVED_KEY
        );
        jest.spyOn(actionUtils, "isExactKeyMatch").mockReturnValue(false);
        (cache.saveCache as jest.Mock).mockResolvedValue(-1);

        await run();

        expect(infoMock).not.toHaveBeenCalledWith(
            expect.stringContaining("Cache saved with key")
        );
    });
    test("should warn if saveCache throws", async () => {
        const logWarningMock = jest
            .spyOn(actionUtils, "logWarning")
            .mockImplementation(() => {});
        jest.spyOn(core, "getState").mockReturnValue(MOCK_PRIMARY_KEY);
        jest.spyOn(actionUtils, "getCacheState").mockReturnValue(
            MOCK_SAVED_KEY
        );
        jest.spyOn(actionUtils, "isExactKeyMatch").mockReturnValue(false);
        jest.spyOn(cache, "saveCache").mockRejectedValue(new Error("fail"));
        jest.spyOn(actionUtils, "getInputAsArray").mockReturnValue(MOCK_PATHS);

        await run();

        expect(logWarningMock).toHaveBeenCalledWith("fail");
    });
});
