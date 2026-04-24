require("nock").disableNetConnect();

module.exports = {
    clearMocks: true,
    moduleFileExtensions: ["js", "ts"],
    testEnvironment: "node",
    testMatch: ["**/*.test.ts"],
    testRunner: "jest-circus/runner",
    transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
        "^.+\\.js$": [
            "babel-jest",
            {
                plugins: [
                    "@babel/plugin-transform-modules-commonjs",
                    "@babel/plugin-transform-export-namespace-from"
                ]
            }
        ]
    },
    transformIgnorePatterns: [
        "[/\\\\]node_modules[/\\\\](?!@actions[/\\\\])"
    ],
    resolver: "./jest-resolver.cjs",
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    },
    verbose: true
};

const processStdoutWrite = process.stdout.write.bind(process.stdout);
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
process.stdout.write = (str, encoding, cb) => {
    // Core library will directly call process.stdout.write for commands
    // We don't want :: commands to be executed by the runner during tests
    if (!String(str).match(/^::/)) {
        return processStdoutWrite(str, encoding, cb);
    }
};
