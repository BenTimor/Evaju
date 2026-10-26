import { AbstractInstruction, CustomInstruction, stringifyBody } from "./code-builder";
import { DEFAULT_MAX_DEPTH } from "./constants";
import { EVMValue } from "./evm-value";
import { OpcodeCSV } from "./opcodes";
import { getOpcodeParser } from "./opcode-parsers";
import type { ExecutionContext } from "./opcode-parsers/base";
import {
    calculateLinesByOffset,
    getInstructionArgs,
    getInstructionFromLine,
    lineBytes,
    normalizeDisassembly,
    type LinesByOffset,
} from "./utils";

export type DecompileOptions = {
    /** Transaction/account details used to resolve environment opcodes. */
    context?: ExecutionContext,
    /** Maximum recursion depth while following jumps. */
    maxDepth?: number,
    /** Memoize jump targets. Disable only when debugging. */
    cache?: boolean,
    /** Path to a custom `opcodes.csv`. */
    opcodeCsvPath?: string,
};

export type DecompileReport = {
    /** The decompiled pseudo-code. */
    code: string,
    instructions: AbstractInstruction[],
    /** Non fatal issues found while parsing (unknown instructions, ...). */
    warnings: string[],
    /** Bytecode reconstructed from the listing. */
    bytecode: string,
    /** Number of EVM instructions in the listing. */
    instructionCount: number,
};

type WalkState = {
    source: string,
    lines: string[],
    linesByOffset: LinesByOffset,
    context: ExecutionContext,
    maxDepth: number,
    cache: Map<string, AbstractInstruction[]> | undefined,
    warnings: Set<string>,
    /** Incremented whenever a path is cut short by loop detection. */
    pathBreaks: number,
};

function createState(source: string, options: DecompileOptions): WalkState {
    const lines = normalizeDisassembly(source);
    // Re-join so parsers (CODECOPY, CODESIZE) always see a canonical listing.
    const normalizedSource = lines.join("\n");

    if (options.opcodeCsvPath !== undefined) {
        OpcodeCSV.ensureLoaded(options.opcodeCsvPath);
    }

    return {
        source: normalizedSource,
        lines,
        linesByOffset: calculateLinesByOffset(lines),
        context: options.context ?? {},
        maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
        cache: options.cache === false ? undefined : new Map(),
        warnings: new Set(),
        pathBreaks: 0,
    };
}

function describeValues(values: EVMValue[]): string {
    return values.map(value => value.toString()).join("\u0001");
}

function describeRecord(record: Record<string, EVMValue>): string {
    return Object.entries(record).map(([key, value]) => `${key}=${value.toString()}`).join("\u0001");
}

function cacheKey(offset: number, depth: number, stack: EVMValue[], memory: Record<string, EVMValue>, storage: Record<string, EVMValue>): string {
    return [
        offset,
        depth,
        describeValues(stack),
        describeRecord(memory),
        describeRecord(storage),
    ].join("\u0002");
}

function walk(
    state: WalkState,
    offset: number,
    stack: EVMValue[],
    memory: Record<string, EVMValue>,
    storage: Record<string, EVMValue>,
    visitedOffset: Set<number>,
    depth: number,
): AbstractInstruction[] {
    const startLineDetails = state.linesByOffset[offset];

    if (!startLineDetails) {
        return [new CustomInstruction(`// End of code (offset ${offset})`)];
    }

    if (depth > state.maxDepth) {
        return [new CustomInstruction(`// Depth limit reached (${state.maxDepth} nested jumps)`)];
    }

    const key = state.cache ? cacheKey(offset, depth, stack, memory, storage) : undefined;
    const cached = key === undefined ? undefined : state.cache?.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const pathBreaksBefore = state.pathBreaks;
    const codeBuilder: AbstractInstruction[] = [];
    const visitedHere: number[] = [];
    let currentOffset = offset;

    try {
        for (let lineIndex = startLineDetails.lineNumber; lineIndex < state.lines.length; lineIndex++) {
            const line = state.lines[lineIndex];

            if (line === undefined) {
                break;
            }

            if (visitedOffset.has(currentOffset)) {
                state.pathBreaks++;
                codeBuilder.push(new CustomInstruction(`// Loop back to offset ${currentOffset}`));
                break;
            }

            visitedOffset.add(currentOffset);
            visitedHere.push(currentOffset);

            const instruction = getInstructionFromLine(line);
            const parser = getOpcodeParser(instruction);

            if (!parser) {
                state.warnings.add(`Unknown instruction "${instruction}" (treated as a 1 byte data byte)`);
                // Unknown bytes still occupy space, otherwise every later jump offset is wrong.
                currentOffset += lineBytes(line);
                continue;
            }

            const done = parser.parse({
                currentOffset,
                args: getInstructionArgs(line),
                line,
                lines: state.lines,
                linesByOffset: state.linesByOffset,
                memory,
                storage,
                opcode: state.source,
                originalOffset: offset,
                stack,
                codeBuilder,
                parentCallback: (_opcode, targetOffset, childStack, childMemory, childStorage) =>
                    walk(state, targetOffset, childStack, childMemory, childStorage, visitedOffset, depth + 1),
                config: state.context,
            });

            if (done) {
                break;
            }

            currentOffset += lineBytes(line);
        }
    }
    finally {
        // Backtrack: `visitedOffset` only ever contains the current path.
        for (const addedOffset of visitedHere) {
            visitedOffset.delete(addedOffset);
        }
    }

    // Only cache paths that were not cut short by loop detection, since those
    // results depend on the path that reached them.
    if (key !== undefined && state.cache && state.pathBreaks === pathBreaksBefore) {
        state.cache.set(key, codeBuilder);
    }

    return codeBuilder;
}

/**
 * Parses the opcode listing starting at `offset` and returns the instruction tree.
 * Exported for backwards compatibility; prefer `decompile`.
 */
export function parseOpcode(
    opcode: string,
    offset = 0,
    stack: EVMValue[] = [],
    memory: Record<string, EVMValue> = {},
    storage: Record<string, EVMValue> = {},
    _unknownInstructions: Set<string> = new Set(),
    visitedOffset: Set<number> = new Set(),
    depth = 0,
    config: ExecutionContext = {},
    cache: Map<string, AbstractInstruction[]> = new Map(),
): AbstractInstruction[] {
    const state = createState(opcode, { context: config });
    state.cache = cache;

    return walk(state, offset, stack, memory, storage, visitedOffset, depth);
}

/** Decompiles an opcode listing into pseudo-code, plus diagnostics. */
export function decompileWithReport(source: string, options: DecompileOptions = {}): DecompileReport {
    const state = createState(source, options);
    const instructions = walk(state, 0, [], {}, {}, new Set(), 0);

    return {
        code: stringifyBody(instructions),
        instructions,
        warnings: [...state.warnings],
        bytecode: safeBytecode(state),
        instructionCount: state.lines.length,
    };
}

/** Decompiles an opcode listing into pseudo-code. */
export function decompile(source: string, options: DecompileOptions = {}): string {
    return decompileWithReport(source, options).code;
}

function safeBytecode(state: WalkState): string {
    try {
        return OpcodeCSV.toBytecode(state.source);
    }
    catch {
        // Some listings contain instructions that are not in opcodes.csv at all.
        return "";
    }
}
