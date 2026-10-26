import { EVMValue, EVMValueTypes } from "../evm-value";

/** Builds a known number value or falls back to a symbolic description. */
export function knownOrSymbolic(value: bigint | undefined, description: string): EVMValue {
    return value === undefined
        ? new EVMValue(description, EVMValueTypes.CUSTOM)
        : new EVMValue(value, EVMValueTypes.NUMBER);
}
