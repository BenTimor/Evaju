import { BASES_PREFIX, MAX_UINT256, SIGN_BIT_256, WORD_BYTES } from "./constants";

export function getInstructionFromLine(line: string): string {
    const instruct = line.trim().split(/\s+/)[0];

    if (!instruct) {
        throw new Error(`Cannot read an instruction out of an empty line: ${JSON.stringify(line)}`);
    }

    return instruct;
}

/** Arguments of an instruction line, without the instruction itself. */
export function getInstructionArgs(line: string): string[] {
    return line.trim().split(/\s+/).slice(1).filter(arg => arg.length > 0);
}

/**
 * Parses a number written with any of the supported base prefixes (see `BASES_PREFIX`)
 * or as plain decimal. Returns a (possibly negative) BigInt; callers that need an EVM
 * word should normalize the result with `normalizeUint256`.
 */
export function unknownBaseStringToNumber(str: string): bigint {
    const raw = str.trim();

    if (raw.length === 0) {
        throw new Error("Cannot convert an empty string to a number");
    }

    const negative = raw.startsWith("-");
    const unsigned = raw.replace(/^[+-]/, "");

    let digits = unsigned;
    let base = 10;

    for (const [prefix, prefixBase] of Object.entries(BASES_PREFIX)) {
        if (unsigned.toLowerCase().startsWith(prefix)) {
            digits = unsigned.slice(prefix.length);
            base = prefixBase;
            break;
        }
    }

    if (digits.length === 0) {
        throw new Error(`Cannot convert "${str}" to a number: no digits`);
    }

    let value = 0n;

    for (const char of digits.toLowerCase()) {
        const digit = "0123456789abcdef".indexOf(char);

        if (digit === -1 || digit >= base) {
            throw new Error(`Cannot convert "${str}" to a number: "${char}" is not a base ${base} digit`);
        }

        value = value * BigInt(base) + BigInt(digit);
    }

    return negative ? -value : value;
}

/** Wraps a BigInt into the unsigned 256 bit range, the way the EVM does. */
export function normalizeUint256(value: bigint): bigint {
    // Bitwise AND already behaves like two's complement for negative values.
    return value & MAX_UINT256;
}

/** Reinterprets an EVM word as a signed 256 bit integer. */
export function toSignedUint256(value: bigint): bigint {
    const normalized = normalizeUint256(value);

    return normalized >= SIGN_BIT_256 ? normalized - (1n << 256n) : normalized;
}

/** Formats a BigInt as a byte aligned `0x` hex string, optionally padded. */
export function toHex(value: bigint, padBytes = 0): string {
    let hex = normalizeUint256(value).toString(16);

    if (padBytes > 0) {
        hex = hex.padStart(padBytes * 2, "0");
    }
    else if (hex.length % 2 !== 0) {
        // Keep full bytes so hex slices never end up half a nibble off.
        hex = `0${hex}`;
    }

    return `0x${hex}`;
}

/**
 * Extracts `size` bytes starting at `offset` (both in bytes) out of a 256 bit word.
 * Returns an unsigned BigInt containing that byte range, right aligned.
 */
export function sliceBytes(value: bigint, offset: number, size: number): bigint {
    if (size <= 0 || offset < 0) {
        return 0n;
    }

    const startBit = BigInt(offset) * 8n;

    if (startBit >= 256n) {
        return 0n;
    }

    const mask = (1n << BigInt(size * 8)) - 1n;
    const shifted = normalizeUint256(value) >> startBit;

    return shifted & mask;
}

/** Byte length of a `0x` prefixed (or bare) hex string. */
export function hexByteLength(hex: string): number {
    return Math.ceil(stripHexPrefix(hex).length / 2);
}

export function stripHexPrefix(hex: string): string {
    return hex.trim().toLowerCase().replace(/^0x/, "");
}

/**
 * Reads `size` bytes of a hex encoded byte array starting at `offset`.
 * Bytes past the end read as zero, which is what `CALLDATACOPY`/`CODECOPY` do.
 */
export function readHexBytes(hex: string, offset: number, size = WORD_BYTES): bigint {
    if (size <= 0) {
        return 0n;
    }

    const data = stripHexPrefix(hex);
    const start = offset * 2;

    if (!Number.isSafeInteger(start) || start < 0 || start >= data.length) {
        return 0n;
    }

    // Hard cap so a bogus (or symbolic) size can never allocate unbounded memory.
    const length = Math.min(size * 2, 2 * 4096);
    const slice = data.slice(start, start + length).padEnd(length, "0");

    return slice.length === 0 ? 0n : BigInt(`0x${slice}`);
}

/**
 * Converts a BigInt into a JS number when it is small enough to be used as an
 * array/string offset, `undefined` otherwise.
 */
export function toSafeNumber(value: bigint, max = 1_000_000n): number | undefined {
    return value >= 0n && value <= max ? Number(value) : undefined;
}

export type LinesByOffset = Record<number, {
    line: string,
    lineNumber: number,
}>;

/**
 * Maps a byte offset to the line of disassembly that lives at that offset.
 * `PUSHn` occupies `n + 1` bytes, every other instruction occupies a single byte.
 */
export function calculateLinesByOffset(lines: string[]): LinesByOffset {
    const linesByOffset: LinesByOffset = {};
    let currentOffset = 0;

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber];

        if (line === undefined) {
            continue;
        }

        linesByOffset[currentOffset] = {
            line,
            lineNumber,
        };
        currentOffset += lineBytes(line);
    }

    return linesByOffset;
}

/** Number of bytes an instruction line occupies in the deployed bytecode. */
export function lineBytes(line: string): number {
    const instruct = getInstructionFromLine(line);

    if (instruct.startsWith("PUSH")) {
        const pushedBytes = Number(instruct.slice("PUSH".length));

        // PUSH0 (and any malformed PUSH suffix) still occupies a single byte.
        return Number.isFinite(pushedBytes) ? pushedBytes + 1 : 1;
    }

    return 1;
}

export function shiftMultilineText(text: string, indent = "  "): string {
    return text.split("\n").map(line => `${indent}${line}`).join("\n");
}

/**
 * Turns the raw textual opcode listing into a list of clean instruction lines.
 * Disassemblers render bytes they cannot decode as `'a8'(Unknown Opcode)`, so
 * quotes and parenthesised annotations are stripped here.
 */
export function normalizeDisassembly(source: string): string[] {
    return source
        .split(/\r?\n/)
        .map(line => line
            .replace(/\([^)]*\)/g, " ")
            .replace(/'/g, " ")
            .trim()
            .replace(/\s+/g, " "))
        .filter(line => line.length > 0);
}
