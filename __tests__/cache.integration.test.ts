import * as core from "@actions/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Import after mocking
import * as cache from "../src/cache";
import * as actionUtils from "../src/utils/actionUtils";

// Mock CACHE_DIR to use our test directory
jest.mock("../src/constants", () => {
    const actual = jest.requireActual("../src/constants");
    return {
        ...actual,
        CACHE_DIR: {
            cache: path.join(os.tmpdir(), "test-cache-dir"),
            masterBranchCache: path.join(
                os.tmpdir(),
                "test-cache-dir",
                "master"
            ),
            defaultBranchCache: path.join(
                os.tmpdir(),
                "test-cache-dir",
                "default"
            )
        }
    };
});

const TEST_DIR = path.join(__dirname, "test-cache");
const TEST_CACHE_DIR = path.join(os.tmpdir(), "test-cache-dir");
const CACHE_KEY = "test-cache-key";
const TEST_FILES = {
    "file1.txt": "content1",
    "file2.txt": "content2",
    "subdir/file3.txt": "content3"
};

describe("Cache Integration", () => {
    beforeEach(async () => {
        jest.resetAllMocks();
        jest.useFakeTimers();

        // Create test directories
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
        await fs.promises.mkdir(TEST_CACHE_DIR, { recursive: true });
        await fs.promises.mkdir(path.join(TEST_DIR, "subdir"), {
            recursive: true
        });

        // Create test files
        for (const [filePath, content] of Object.entries(TEST_FILES)) {
            await fs.promises.writeFile(path.join(TEST_DIR, filePath), content);
        }

        // Mock necessary functions
        jest.spyOn(actionUtils, "isCacheFunctionEnabled").mockReturnValue(true);
        jest.spyOn(actionUtils, "getPrimaryKey").mockReturnValue(CACHE_KEY);
        jest.spyOn(actionUtils, "getInputAsArray").mockReturnValue([
            "file1.txt",
            "file2.txt",
            "subdir"
        ]);
    });

    afterEach(async () => {
        jest.useRealTimers();
        // Clean up test directories
        await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
        await fs.promises.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    });

    test("should save and restore cache", async () => {
        // Change working directory to test directory
        const originalCwd = process.cwd();
        process.chdir(TEST_DIR);

        try {
            // Step 1: Save cache
            const saveResult = await cache.saveCache(
                [
                    path.join(TEST_DIR, "file1.txt"),
                    path.join(TEST_DIR, "file2.txt"),
                    path.join(TEST_DIR, "subdir")
                ],
                CACHE_KEY
            );
            expect(saveResult).toBeGreaterThan(0);

            // Verify cache was created
            const cacheDir = path.join(TEST_CACHE_DIR, CACHE_KEY);
            const cacheExists = await fs.promises
                .access(cacheDir)
                .then(() => true)
                .catch(() => false);
            expect(cacheExists).toBe(true);

            // Step 2: Restore cache
            const restoreResult = await cache.restoreCache(
                CACHE_KEY,
                [],
                [TEST_CACHE_DIR]
            );
            expect(restoreResult).toBe(CACHE_KEY);

            // Verify files were restored
            for (const [filePath, content] of Object.entries(TEST_FILES)) {
                const restoredContent = await fs.promises.readFile(
                    path.join(TEST_DIR, filePath),
                    "utf8"
                );
                expect(restoredContent).toBe(content);
            }
        } finally {
            process.chdir(originalCwd);
        }
    });

    test("should handle cache miss", async () => {
        const nonExistentKey = "non-existent-key";

        // Try to restore non-existent cache
        const restoreResult = await cache.restoreCache(
            nonExistentKey,
            [],
            [TEST_CACHE_DIR]
        );

        expect(restoreResult).toBeUndefined();
    });

    test("should handle partial cache hits", async () => {
        // Change working directory to test directory
        const originalCwd = process.cwd();
        process.chdir(TEST_DIR);

        try {
            // Save initial cache
            const saveResult = await cache.saveCache(["file1.txt"], CACHE_KEY);
            expect(saveResult).toBeGreaterThan(0);

            // Verify cache was created
            const cacheDir = path.join(TEST_CACHE_DIR, CACHE_KEY);
            const cacheExists = await fs.promises
                .access(cacheDir)
                .then(() => true)
                .catch(() => false);
            expect(cacheExists).toBe(true);

            // Try to restore with different key
            const restoreResult = await cache.restoreCache(
                "different-key",
                [CACHE_KEY], // restore-keys
                [TEST_CACHE_DIR]
            );

            expect(restoreResult).toBe(CACHE_KEY);
        } finally {
            process.chdir(originalCwd);
        }
    });

    test("should handle non-existent directory gracefully", async () => {
        const nonExistentDir = path.join(TEST_DIR, "non-existent-dir");

        // Mock core.warning to verify it's called
        const warningSpy = jest.spyOn(core, "warning");

        // Try to save cache with non-existent directory
        await expect(
            cache.saveCache([nonExistentDir], CACHE_KEY)
        ).rejects.toThrow();

        // Try to restore cache with non-existent directory in cache paths
        const restoreResult = await cache.restoreCache(
            CACHE_KEY,
            [],
            [nonExistentDir]
        );

        // Verify warning was logged again for restore
        expect(warningSpy).toHaveBeenCalledWith(
            expect.stringContaining(`No such file or directory`)
        );

        // Should return undefined as no cache was found
        expect(restoreResult).toBeUndefined();

        warningSpy.mockRestore();
    });
});
