import { Inputs } from "../constants";

// See: https://github.com/actions/toolkit/blob/master/packages/core/src/core.ts#L67
function getInputName(name: string): string {
    return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}

export function setInput(name: string, value: string): void {
    process.env[getInputName(name)] = value;
}

interface CacheInput {
    path: string;
    key: string;
    restoreKeys?: string[];
    failOnCacheMiss?: boolean;
    lookupOnly?: boolean;
}

export function setInputs(input: CacheInput): void {
    setInput(Inputs.Key, input.key);

    if (input.restoreKeys) {
        setInput(Inputs.RestoreKeys, input.restoreKeys.join("\n"));
    }

    if (input.failOnCacheMiss !== undefined) {
        setInput(Inputs.FailOnCacheMiss, input.failOnCacheMiss.toString());
    }

    if (input.lookupOnly !== undefined) {
        setInput(Inputs.LookupOnly, input.lookupOnly.toString());
    }
}

export function clearInputs(): void {
    delete process.env[getInputName(Inputs.Path)];
    delete process.env[getInputName(Inputs.Key)];
    delete process.env[getInputName(Inputs.RestoreKeys)];
    delete process.env[getInputName(Inputs.FailOnCacheMiss)];
    delete process.env[getInputName(Inputs.LookupOnly)];
}
