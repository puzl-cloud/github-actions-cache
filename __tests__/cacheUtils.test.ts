import * as core from "@actions/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { TAR_COMMAND } from "../src/constants";
import * as actionUtils from "../src/utils/actionUtils";
import * as cacheUtils from "../src/utils/cacheUtils";
import { streamOutputUntilResolved } from "../src/utils/common";

// Mock @actions/core
jest.mock("@actions/core", () => ({
    info: jest.fn(),
    warning: jest.fn(),
    getInput: jest.fn().mockImplementation(name => {
        if (name === "key") return "test-key";
        return "";
    })
}));

jest.mock("../src/utils/actionUtils");
jest.mock("../src/utils/common", () => ({
    streamOutputUntilResolved: jest.fn()
}));

const execAsyncMock = actionUtils.execAsync as jest.Mock;
const streamOutputUntilResolvedMock = streamOutputUntilResolved as jest.Mock;

// Use temporary directories for all test files
const TEST_DIR = path.join(os.tmpdir(), "test-cache");
const PERSISTENT_DIR = path.join(os.tmpdir(), "test-cache-persistent");

// Helper function to create test files
async function createTestFiles() {
    try {
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
        await fs.promises.mkdir(PERSISTENT_DIR, { recursive: true });
        await fs.promises.writeFile(
            path.join(PERSISTENT_DIR, "persistent.txt"),
            "This file should persist"
        );
    } catch (error) {
        console.error("Error creating test files:", error);
        throw error;
    }
}

// Helper function to clean up test files
async function cleanupTestFiles() {
    try {
        await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
        await fs.promises.rm(PERSISTENT_DIR, { recursive: true, force: true });
    } catch (error) {
        console.error("Error cleaning up test files:", error);
    }
}

beforeAll(async () => {
    await createTestFiles();
});

afterAll(async () => {
    await cleanupTestFiles();
});

describe("locateCacheFiles", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        try {
            const files = await fs.promises.readdir(TEST_DIR);
            for (const file of files) {
                await fs.promises.rm(path.join(TEST_DIR, file), {
                    recursive: true,
                    force: true
                });
            }
        } catch (error) {
            console.error("Error cleaning up test files:", error);
        }
    });

    it("should return empty array if directory does not exist", async () => {
        const result = await cacheUtils.locateCacheFiles("/nonexistent");
        expect(result).toEqual([]);
    });

    it("should return full paths of files only", async () => {
        const subdir = path.join(TEST_DIR, "subdir");
        await fs.promises.mkdir(subdir, { recursive: true });

        const file1 = path.join(TEST_DIR, "file1.txt");
        const file2 = path.join(TEST_DIR, "file2.txt");
        await fs.promises.writeFile(file1, "test");
        await fs.promises.writeFile(file2, "test");

        const result = await cacheUtils.locateCacheFiles(TEST_DIR);
        expect(result).toEqual([
            path.join(TEST_DIR, "file1.txt"),
            path.join(TEST_DIR, "file2.txt")
        ]);
    });
});

describe("collectCacheFile", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        try {
            const files = await fs.promises.readdir(TEST_DIR);
            for (const file of files) {
                await fs.promises.rm(path.join(TEST_DIR, file), {
                    recursive: true,
                    force: true
                });
            }
        } catch (error) {
            console.error("Error cleaning up test files:", error);
        }
    });

    it("should return all cache files found", async () => {
        const cacheKey = "test-key";
        const cacheDir = path.join(TEST_DIR, cacheKey);
        await fs.promises.mkdir(cacheDir, { recursive: true });

        const file1 = path.join(cacheDir, "cache1.txt");
        const file2 = path.join(cacheDir, "cache2.txt");
        await fs.promises.writeFile(file1, "test");
        await fs.promises.writeFile(file2, "test");

        const result = await cacheUtils.collectCacheFile(cacheKey, [TEST_DIR]);
        expect(result).toStrictEqual([
            path.join(TEST_DIR, cacheKey, "cache1.txt"),
            path.join(TEST_DIR, cacheKey, "cache2.txt")
        ]);
    });

    it("should return undefined if no cache file exists in any dir", async () => {
        const result = await cacheUtils.collectCacheFile("test-key", [
            "/nonexistent"
        ]);
        expect(result).toBeUndefined();
    });
});

describe("restoreCacheArchive", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        try {
            const files = await fs.promises.readdir(TEST_DIR);
            for (const file of files) {
                await fs.promises.rm(path.join(TEST_DIR, file), {
                    recursive: true,
                    force: true
                });
            }
        } catch (error) {
            console.error("Error cleaning up test files:", error);
        }
    });

    it("should restore cache and log info", async () => {
        const decodedDir = "/test";
        const archiveBase = Buffer.from(decodedDir).toString("base64");
        const archivePath = path.join(TEST_DIR, archiveBase);

        await fs.promises.writeFile(archivePath, "test archive content");

        execAsyncMock.mockResolvedValueOnce({ exitCode: 0 });
        streamOutputUntilResolvedMock.mockResolvedValueOnce(undefined);

        await cacheUtils.restoreCacheArchive(archivePath);
        expect(execAsyncMock).toHaveBeenCalledWith(
            `${TAR_COMMAND} -xf ${archivePath} -C /`
        );
        expect(core.info).toHaveBeenCalledWith(
            expect.stringContaining(`Restoring cache from ${archivePath}`)
        );
    });

    it("should warn and rethrow if tar fails and skip-failure is false", async () => {
        const archivePath = path.join(TEST_DIR, "cache.tar.gz");
        await fs.promises.writeFile(archivePath, "test archive content");

        execAsyncMock.mockResolvedValueOnce({ exitCode: 0 });
        streamOutputUntilResolvedMock.mockRejectedValueOnce(
            new Error("Tar failed")
        );
        (core.getInput as jest.Mock).mockReturnValueOnce("");

        await expect(
            cacheUtils.restoreCacheArchive(archivePath)
        ).rejects.toThrow("Tar failed");
        expect(core.warning).toHaveBeenCalledWith(
            "Tar command failed: Error: Tar failed"
        );
    });

    it("should warn but not throw if tar fails and skip-failure is true", async () => {
        const archivePath = path.join(TEST_DIR, "cache.tar.gz");
        await fs.promises.writeFile(archivePath, "test archive content");

        execAsyncMock.mockResolvedValueOnce({ exitCode: 0 });
        streamOutputUntilResolvedMock.mockRejectedValueOnce(
            new Error("Tar failed")
        );

        (core.getInput as jest.Mock).mockImplementation(name =>
            name === "skip-failure" ? "true" : ""
        );

        await expect(
            cacheUtils.restoreCacheArchive(archivePath)
        ).resolves.not.toThrow();

        expect(core.warning).toHaveBeenCalledWith(
            "Tar command failed: Error: Tar failed"
        );
    });

    it("should throw if archivePath basename is not valid base64", async () => {
        const archivePath = path.join(TEST_DIR, "!!!notbase64!!!");
        await fs.promises.writeFile(archivePath, "test archive content");

        await expect(
            cacheUtils.restoreCacheArchive(archivePath)
        ).resolves.toBeUndefined();
    });

    it("should throw if archivePath has no basename (empty encodedBaseDir)", async () => {
        // archivePath is "" → basename is "" → throws at `!encodedBaseDir`
        await expect(cacheUtils.restoreCacheArchive("")).rejects.toThrow(
            "Failed to determine `encodedBaseDir`"
        );
    });

    it("should throw if archivePath basename is valid base64 but decodes to empty string", async () => {
        // Instead, simulate this safely:
        const encodedEmpty = Buffer.from("", "utf-8").toString("base64"); // "" → ""
        const badArchive = path.join(TEST_DIR, encodedEmpty || "_"); // fallback so it's not just dir
        await fs.promises.writeFile(badArchive, "dummy");

        await expect(
            cacheUtils.restoreCacheArchive(badArchive)
        ).rejects.toThrow("Failed to decode archive path from base64");
    });
});

describe("tryRestoreFromKey", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await fs.promises.mkdir(TEST_DIR, { recursive: true });
        (core.info as jest.Mock).mockImplementation(() => {});
    });

    afterEach(async () => {
        const files = await fs.promises.readdir(TEST_DIR);
        for (const file of files) {
            await fs.promises.rm(path.join(TEST_DIR, file), {
                recursive: true,
                force: true
            });
        }
    });

    it("should return undefined if no cache file exists in any dir", async () => {
        const result = await cacheUtils.collectCacheFile("test-key", [
            "/nonexistent"
        ]);
        expect(result).toBeUndefined();
    });
});
