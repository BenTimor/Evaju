import { EVMValue, EVMValueTypes } from "../evm-value";
import { sliceBytes, toHex } from "../utils";

/**
 * Returns a known byte slice of the 256 bit word stored at `offset`, or
 * `undefined` when either the memory word or the size is symbolic.
 */
export function readMemorySlice(memory: Record<string, EVMValue>, offset: bigint, size: bigint): bigint | undefined {
    if (size < 0n) {
        return undefined;
    }

    // A zero sized read returns nothing, whether or not memory was written.
    if (size === 0n) {
        return 0n;
    }

    const entry = memory[toHex(offset)];

    if (!entry || entry.knownNumber === undefined) {
        return undefined;
    }

    // The memory model stores one 32 byte word per offset, so larger reads are
    // only partially modelled and stay symbolic.
    if (size > 32n) {
        return undefined;
    }

    return sliceBytes(entry.knownNumber, 0, Number(size));
}

/**
 * Renders a memory range for the output. A full word that is symbolic is
 * rendered by its description, so `RETURN` can show `[Calldata[0x04]]`
 * instead of a useless "Unknown".
 */
export function memoryText(memory: Record<string, EVMValue>, offset: bigint, size: bigint): string | undefined {
    if (size === 0n) {
        return "0x";
    }

    const entry = memory[toHex(offset)];

    if (entry === undefined) {
        return undefined;
    }

    if (size === 32n && entry.knownNumber === undefined) {
        return entry.toString();
    }

    const value = readMemorySlice(memory, offset, size);

    return value === undefined ? undefined : formatBytes(value, Number(size));
}

/** Formats a byte slice of a word the way a disassembler would show it. */
export function formatBytes(value: bigint, size: number): string {
    return size <= 0 ? "0x" : toHex(sliceBytes(value, 0, size), size);
}

/** Builds a known number value or falls back to a symbolic description. */
export function knownOrSymbolic(value: bigint | undefined, description: string): EVMValue {
    return value === undefined
        ? new EVMValue(description, EVMValueTypes.CUSTOM)
        : new EVMValue(value, EVMValueTypes.NUMBER);
}
