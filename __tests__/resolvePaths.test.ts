import fs from "fs";
import path from "path";

import { resolvePaths } from "../src/utils/common";

const TEST_DIR = path.join(__dirname, "glob-test");

beforeAll(async () => {
    await fs.promises.mkdir(TEST_DIR, { recursive: true });

    await fs.promises.writeFile(path.join(TEST_DIR, "file1.txt"), "1");
    await fs.promises.writeFile(path.join(TEST_DIR, "fileA.txt"), "A");
    await fs.promises.writeFile(path.join(TEST_DIR, "fileB.log"), "B");
    await fs.promises.writeFile(path.join(TEST_DIR, "fileC.txt"), "C");
    await fs.promises.writeFile(path.join(TEST_DIR, "data123.csv"), "csv");
    await fs.promises.writeFile(path.join(TEST_DIR, "fyle.txt"), "y");

    const subDir = path.join(TEST_DIR, "subdir");
    await fs.promises.mkdir(subDir, { recursive: true });
    await fs.promises.writeFile(path.join(subDir, "nested.txt"), "nested");

    const deepSubDir = path.join(TEST_DIR, "deep", "inner");
    await fs.promises.mkdir(deepSubDir, { recursive: true });
    await fs.promises.writeFile(path.join(deepSubDir, "deep.txt"), "deep");
});

afterAll(async () => {
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
});

describe("resolvePaths", () => {
    test("matches * pattern", async () => {
        process.chdir(TEST_DIR);
        const result = await resolvePaths(["*.txt"]);
        expect(result).toEqual(
            expect.arrayContaining([
                path.join(TEST_DIR, "file1.txt"),
                path.join(TEST_DIR, "fileA.txt"),
                path.join(TEST_DIR, "fileC.txt"),
                path.join(TEST_DIR, "fyle.txt")
            ])
        );
    });

    test("matches ? pattern", async () => {
        process.chdir(TEST_DIR);
        const result = await resolvePaths(["file?.txt"]);
        expect(result).toEqual(
            expect.arrayContaining([
                path.join(TEST_DIR, "file1.txt"),
                path.join(TEST_DIR, "fileA.txt"),
                path.join(TEST_DIR, "fileC.txt")
            ])
        );
    });

    test("matches [...] pattern", async () => {
        process.chdir(TEST_DIR);
        const result = await resolvePaths(["file[AB].txt"]);
        expect(result).toEqual(
            expect.arrayContaining([path.join(TEST_DIR, "fileA.txt")])
        );
        expect(result).not.toContain(path.join(TEST_DIR, "file1.txt"));
    });

    test("matches ** pattern for nested dirs", async () => {
        process.chdir(TEST_DIR);
        const result = await resolvePaths(["**/*.txt"]);
        expect(result).toEqual(
            expect.arrayContaining([
                path.join(TEST_DIR, "deep", "inner", "deep.txt"),
                path.join(TEST_DIR, "file1.txt"),
                path.join(TEST_DIR, "fileA.txt"),
                path.join(TEST_DIR, "fileC.txt"),
                path.join(TEST_DIR, "fyle.txt"),
                path.join(TEST_DIR, "subdir", "nested.txt")
            ])
        );
    });
});
