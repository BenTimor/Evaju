import { AbstractInstruction, CustomInstruction, FunctionCallInstruction, stringifyBody } from "./code-builder";
import { DEFAULT_MAX_DEPTH } from "./constants";
import { EVMValue, EVMValueTypes } from "./evm-value";
import { EVMMemory } from "./memory";
import { OpcodeCSV } from "./opcodes";
import { getOpcodeParser } from "./opcode-parsers";
import type { ExecutionContext, JumpSite } from "./opcode-parsers/base";
import {
    calculateLinesByOffset,
    getInstructionArgs,
    getInstructionFromLine,
    lineBytes,
    normalizeDisassembly,
    normalizeUint256,
    shiftMultilineText,
    toSafeNumber,
    unknownBaseStringToNumber,
    type LinesByOffset,
} from "./utils";

export type DecompileOptions = {
    /** Transaction/account details used to resolve environment opcodes. */
    context?: ExecutionContext,
    /** Maximum recursion depth while following jumps. */
    maxDepth?: number,
    /** Memoize jump targets. Disable only when debugging. */
    cache?: boolean,
    /** Hoist shared jump targets into named functions (default true). */
    extractFunctions?: boolean,
    /** Path to a custom `opcodes.csv`. */
    opcodeCsvPath?: string,
};

/** A jump target that is called from several places and was hoisted out. */
export type DecompiledFunction = {
    label: string,
    offset: number,
    /** Dispatcher selector, when the function is an external entry point. */
    selector?: bigint,
    /** True when the body returns to its caller instead of halting. */
    returns: boolean,
    /** Net stack change caused by the call (returned values minus arguments). */
    stackDelta: number,
    body: AbstractInstruction[],
};

export type DecompileReport = {
    /** The decompiled pseudo-code, including extracted functions. */
    code: string,
    instructions: AbstractInstruction[],
    /** Jump targets that were extracted into named functions. */
    functions: DecompiledFunction[],
    /** Non fatal issues found while parsing (unknown instructions, ...). */
    warnings: string[],
    /** Bytecode reconstructed from the listing. */
    bytecode: string,
    /** Number of EVM instructions in the listing. */
    instructionCount: number,
};

type JumpTargetState = {
    /** Offsets of the JUMP instructions that target this offset. */
    sites: Set<number>,
    /** Set when the target turns out to be a loop or hit the depth limit. */
    disqualified: boolean,
};

type FunctionParse = {
    offset: number,
    entrySize: number,
    /** Continuation offsets of the call sites; jumping there means "return". */
    returnTargets: Set<number>,
    returnStack?: EVMValue[],
};

type WalkState = {
    source: string,
    lines: string[],
    linesByOffset: LinesByOffset,
    context: ExecutionContext,
    maxDepth: number,
    cache: Map<string, AbstractInstruction[]> | undefined,
    warnings: Set<string>,
    /** Incremented whenever a path is cut short (loop or depth limit). */
    pathBreaks: number,
    /** Highest offset each frame processed directly, used to spot loops. */
    frameExtents: Map<number, number>,
    /** Discovery pass: every unconditional jump target and its call sites. */
    jumpTargets?: Map<number, JumpTargetState>,
    /** Discovery pass: dispatcher targets mapped to their selector. */
    selectorTargets?: Map<number, bigint>,
    /** Discovery pass: call sites of dispatcher targets. */
    selectorSites?: Map<number, Set<number>>,
    /** Second pass: targets that should become functions, with their call sites. */
    extractTargets?: Set<number>,
    extractSites?: Map<number, Set<number>>,
    extractSelectors?: Map<number, bigint>,
    functions?: Map<number, DecompiledFunction>,
    /** Functions that were actually referenced by a call. */
    usedFunctions?: Set<number>,
    /** Internal per-function data: exact return state of the analysed call site. */
    functionAnalysis?: Map<number, { analysisSite: number, returnStack?: EVMValue[] }>,
    functionsInProgress?: Set<number>,
    functionStack?: FunctionParse[],
};

const LOOP_MARKER = "// Loop back to offset";
const DEPTH_MARKER = "// Depth limit reached";

/** Instructions that end a basic block, so a pushed value cannot flow past them. */
const BLOCK_ENDERS = new Set([
    "JUMP",
    "JUMPI",
    "JUMPDEST",
    "STOP",
    "RETURN",
    "REVERT",
    "INVALID",
    "SELFDESTRUCT",
]);

/** How many instructions to look back for the return label of a call site. */
const RETURN_LABEL_SCAN = 16;

function createState(source: string, options: DecompileOptions, extraction: boolean): WalkState {
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
        frameExtents: new Map(),
        ...(extraction
            ? {
                extractTargets: new Set<number>(),
                functions: new Map<number, DecompiledFunction>(),
                usedFunctions: new Set<number>(),
                functionAnalysis: new Map<number, { analysisSite: number, returnStack?: EVMValue[] }>(),
                functionsInProgress: new Set<number>(),
                functionStack: [] as FunctionParse[],
            }
            : {
                jumpTargets: new Map<number, JumpTargetState>(),
                selectorTargets: new Map<number, bigint>(),
                selectorSites: new Map<number, Set<number>>(),
            }),
    };
}

function describeValues(values: EVMValue[]): string {
    return values.map(value => value.toString()).join("\u0001");
}

function describeRecord(record: Record<string, EVMValue>): string {
    return Object.entries(record).map(([key, value]) => `${key}=${value.toString()}`).join("\u0001");
}

function cacheKey(offset: number, stack: EVMValue[], memory: EVMMemory, storage: Record<string, EVMValue>): string {
    return [
        offset,
        describeValues(stack),
        memory.signature,
        describeRecord(storage),
    ].join("\u0002");
}

function functionLabel(offset: number, selector?: bigint): string {
    if (selector !== undefined) {
        return `function_${selector.toString(16).padStart(8, "0")}`;
    }

    return `function_${offset.toString(16)}`;
}

/**
 * Offset a call site continues at once its callee returned.
 *
 * Solidity pushes that label before it arranges the arguments and jumps to the
 * callee:
 *
 *     PUSH2 0x1091   ; where to continue after the call
 *     DUP2           ; argument
 *     PUSH2 0x1098   ; callee
 *     JUMP
 *
 * The label is *not* always the instruction right after the JUMP: the compiler
 * reuses shared epilogues for tail calls, and then the continuation lives
 * somewhere else entirely. It therefore has to be read out of the listing.
 */
function findReturnLabel(state: WalkState, site: number, callee: number): number | undefined {
    const siteLine = state.linesByOffset[site];

    // Only unconditional jumps follow the push-return-label convention; a JUMPI
    // branches to its target and falls through to the next instruction instead.
    if (siteLine === undefined || getInstructionFromLine(siteLine.line) !== "JUMP") {
        return undefined;
    }

    const firstLineNumber = siteLine.lineNumber - RETURN_LABEL_SCAN;

    for (let lineNumber = siteLine.lineNumber - 1; lineNumber >= 0 && lineNumber >= firstLineNumber; lineNumber--) {
        const line = state.lines[lineNumber];

        if (line === undefined) {
            break;
        }

        const instruction = getInstructionFromLine(line);

        // Crossing a block boundary means the label is not on this path.
        if (BLOCK_ENDERS.has(instruction)) {
            break;
        }

        if (!instruction.startsWith("PUSH")) {
            continue;
        }

        const [argument] = getInstructionArgs(line);

        if (argument === undefined) {
            continue;
        }

        let pushedValue: number | undefined;

        try {
            pushedValue = toSafeNumber(normalizeUint256(unknownBaseStringToNumber(argument)));
        }
        catch {
            continue;
        }

        if (pushedValue === undefined || pushedValue === 0 || pushedValue === callee) {
            continue;
        }

        const labelLine = state.linesByOffset[pushedValue];

        if (labelLine !== undefined && getInstructionFromLine(labelLine.line) === "JUMPDEST") {
            return pushedValue;
        }
    }

    return undefined;
}

/**
 * Parses the body of a function-like jump target once, so every call site can
 * reference it instead of inlining a copy.
 *
 * The body is analysed with the stack of the first call site. A jump to a label
 * one of the call sites pushed is treated as "return to caller", which is the
 * convention produced by Solidity-style compilers.
 */
function parseFunctionBody(state: WalkState, jump: JumpSite, depth: number): DecompiledFunction {
    const entryStack = [...jump.stack];
    const sites = state.extractSites?.get(jump.target) ?? new Set<number>();
    const selector = state.extractSelectors?.get(jump.target);
    const returnTargets = new Set<number>();

    for (const site of sites) {
        // The label right after the jump is the common case, the pushed one the
        // accurate one; accepting both keeps hand written listings working.
        returnTargets.add(site + 1);

        const label = findReturnLabel(state, site, jump.target);

        if (label !== undefined) {
            returnTargets.add(label);
        }
    }

    // The body is walked with this call site's stack, so its label has to be a
    // return target even when the site was not seen during the discovery pass.
    const analysisLabel = findReturnLabel(state, jump.site, jump.target);

    if (analysisLabel !== undefined) {
        returnTargets.add(analysisLabel);
    }

    const parse: FunctionParse = {
        offset: jump.target,
        entrySize: entryStack.length,
        returnTargets,
    };

    state.functionsInProgress!.add(jump.target);
    state.functionStack!.push(parse);

    try {
        const body = walk(state, jump.target, entryStack, jump.memory.clone(), { ...jump.storage }, new Set(), depth + 1);
        const returns = parse.returnStack !== undefined;
        const fn: DecompiledFunction = {
            label: functionLabel(jump.target, selector),
            offset: jump.target,
            ...(selector === undefined ? {} : { selector }),
            returns,
            stackDelta: returns ? parse.returnStack!.length - parse.entrySize : 0,
            body,
        };

        state.functions!.set(jump.target, fn);
        state.functionAnalysis!.set(jump.target, { analysisSite: jump.site, ...(parse.returnStack === undefined ? {} : { returnStack: parse.returnStack }) });

        return fn;
    }
    finally {
        state.functionStack!.pop();
        state.functionsInProgress!.delete(jump.target);
    }
}

/**
 * Approximates the caller's stack after a call returned: the return label and the
 * arguments are dropped and the net effect of the callee is applied. Argument
 * values are kept when possible, otherwise the missing slots become symbolic
 * results.
 */
function adaptStack(callerStack: EVMValue[], fn: DecompiledFunction, returnLabel: number | undefined): EVMValue[] {
    // Neither the pushed label nor the arguments survive the call, so both are
    // dropped before the net effect of the callee is applied.
    const caller = dropReturnLabel(callerStack, returnLabel);
    const stack = caller.slice(0, Math.max(0, caller.length - 1));
    const targetSize = Math.max(0, callerStack.length + fn.stackDelta);

    while (stack.length > targetSize) {
        stack.pop();
    }

    while (stack.length < targetSize) {
        stack.push(new EVMValue(`[${fn.label} result]`, EVMValueTypes.CUSTOM));
    }

    return stack;
}

/** Removes the return label a call site pushed, closest to the top of the stack. */
function dropReturnLabel(stack: EVMValue[], returnLabel: number | undefined): EVMValue[] {
    if (returnLabel === undefined) {
        return [...stack];
    }

    const label = BigInt(returnLabel);

    for (let index = stack.length - 1; index >= 0; index--) {
        if (stack[index]?.knownNumber === label) {
            return [...stack.slice(0, index), ...stack.slice(index + 1)];
        }
    }

    return [...stack];
}

/** A body that only returns is a trampoline: not worth a named function. */
function isTrivialBody(fn: DecompiledFunction): boolean {
    if (fn.body.length === 0) {
        return true;
    }

    return fn.body.length === 1
        && fn.body[0] instanceof CustomInstruction
        && fn.body[0].text === "// return";
}

function emitFunctionCall(state: WalkState, jump: JumpSite, visitedOffset: Set<number>, depth: number): AbstractInstruction[] {
    if (state.functionsInProgress!.has(jump.target)) {
        // Recursive call: reference the function instead of expanding it again.
        state.usedFunctions!.add(jump.target);
        return [new FunctionCallInstruction(functionLabel(jump.target, state.extractSelectors?.get(jump.target)))];
    }

    const fn = state.functions!.get(jump.target) ?? parseFunctionBody(state, jump, depth);
    const instructions: AbstractInstruction[] = [];

    if (!isTrivialBody(fn)) {
        state.usedFunctions!.add(fn.offset);
        instructions.push(new FunctionCallInstruction(fn.label));
    }

    if (!fn.returns) {
        return instructions;
    }

    // A returning function continues at the label its call site pushed. That is
    // only coincidentally the instruction right after the JUMP.
    const returnLabel = findReturnLabel(state, jump.site, jump.target);
    const continuationOffset = returnLabel ?? jump.site + jump.jumpBytes;

    if (state.linesByOffset[continuationOffset] === undefined) {
        return instructions;
    }

    // The analysed call site has an exact return state; other sites are adapted.
    const analysis = state.functionAnalysis!.get(jump.target);
    const continuationStack = analysis !== undefined && analysis.analysisSite === jump.site && analysis.returnStack !== undefined
        ? [...analysis.returnStack]
        : adaptStack(jump.stack, fn, returnLabel);

    instructions.push(...walk(
        state,
        continuationOffset,
        continuationStack,
        jump.memory.clone(),
        { ...jump.storage },
        visitedOffset,
        depth + 1,
    ));

    return instructions;
}

function recordJumpTarget(state: WalkState, target: number, site: number): void {
    if (state.jumpTargets === undefined) {
        return;
    }

    let info = state.jumpTargets.get(target);

    if (info === undefined) {
        info = { sites: new Set(), disqualified: false };
        state.jumpTargets.set(target, info);
    }

    info.sites.add(site);

    if (info.disqualified) {
        return;
    }

    // A site inside the target's own linear extent means the target jumps back
    // to itself: that is a loop, not a function.
    const extent = state.frameExtents.get(target);

    if (extent === undefined || (site > target && site <= extent)) {
        info.disqualified = true;
    }
}

/** Records a `msg.sig == 0x...` dispatch target. */
function recordSelectorTarget(state: WalkState, target: number, selector: bigint, site: number): void {
    if (state.selectorTargets === undefined) {
        return;
    }

    if (!state.selectorTargets.has(target)) {
        state.selectorTargets.set(target, selector);
    }

    let sites = state.selectorSites!.get(target);

    if (sites === undefined) {
        sites = new Set<number>();
        state.selectorSites!.set(target, sites);
    }

    sites.add(site);
}

/**
 * Targets that deserve a named function:
 *  - dispatcher entries (`msg.sig == ...`), which are external functions, and
 *  - any other target that is reached from more than one jump site.
 * Other targets stay inlined, which keeps small local control flow readable.
 */
function computeExtractTargets(state: WalkState): { targets: Set<number>, sites: Map<number, Set<number>>, selectors: Map<number, bigint> } {
    const targets = new Set<number>();
    const sites = new Map<number, Set<number>>();
    const selectors = new Map<number, bigint>();

    for (const [offset, info] of state.jumpTargets ?? []) {
        if (offset === 0 || info.disqualified || info.sites.size < 2) {
            continue;
        }

        targets.add(offset);
        sites.set(offset, info.sites);
    }

    for (const [offset, selector] of state.selectorTargets ?? []) {
        if (offset === 0) {
            continue;
        }

        targets.add(offset);
        selectors.set(offset, selector);

        const merged = sites.get(offset) ?? new Set<number>();

        for (const site of state.selectorSites?.get(offset) ?? []) {
            merged.add(site);
        }

        sites.set(offset, merged);
    }

    return { targets, sites, selectors };
}

function walk(
    state: WalkState,
    offset: number,
    stack: EVMValue[],
    memory: EVMMemory,
    storage: Record<string, EVMValue>,
    visitedOffset: Set<number>,
    depth: number,
): AbstractInstruction[] {
    const startLineDetails = state.linesByOffset[offset];

    if (!startLineDetails) {
        return [new CustomInstruction(`// End of code (offset ${offset})`)];
    }

    if (depth > state.maxDepth) {
        state.pathBreaks++;
        return [new CustomInstruction(`${DEPTH_MARKER} (${state.maxDepth} nested jumps)`)];
    }

    const key = state.cache ? cacheKey(offset, stack, memory, storage) : undefined;
    const cached = key === undefined ? undefined : state.cache?.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const pathBreaksBefore = state.pathBreaks;
    const codeBuilder: AbstractInstruction[] = [];
    const visitedHere: number[] = [];
    let currentOffset = offset;
    let lastDirectOffset = offset;

    const onJumpTarget = state.extractTargets === undefined
        ? undefined
        : (jump: JumpSite) => state.extractTargets!.has(jump.target)
            ? emitFunctionCall(state, jump, visitedOffset, depth)
            : undefined;

    const onJumpParsed = state.jumpTargets === undefined
        ? undefined
        : (target: number, site: number) => recordJumpTarget(state, target, site);

    const onSelectorDispatch = state.selectorTargets === undefined
        ? undefined
        : (target: number, selector: bigint, site: number) => recordSelectorTarget(state, target, selector, site);

    const functionStack = state.functionStack;
    const currentFunction = functionStack === undefined ? undefined : functionStack[functionStack.length - 1];

    const onReturn = functionStack === undefined || functionStack.length === 0
        ? undefined
        : (returnStack: EVMValue[]) => {
            const current = functionStack[functionStack.length - 1]!;

            if (current.returnStack === undefined) {
                current.returnStack = returnStack;
            }
        };

    try {
        for (let lineIndex = startLineDetails.lineNumber; lineIndex < state.lines.length; lineIndex++) {
            const line = state.lines[lineIndex];

            if (line === undefined) {
                break;
            }

            if (visitedOffset.has(currentOffset)) {
                state.pathBreaks++;
                codeBuilder.push(new CustomInstruction(`${LOOP_MARKER} ${currentOffset}`));
                break;
            }

            visitedOffset.add(currentOffset);
            visitedHere.push(currentOffset);
            lastDirectOffset = currentOffset;

            const instruction = getInstructionFromLine(line);
            const parser = getOpcodeParser(instruction);

            if (!parser) {
                state.warnings.add(`Unknown instruction "${instruction}" (treated as a 1 byte data byte)`);
                // Unknown bytes still occupy space, otherwise every later jump offset is wrong.
                currentOffset += lineBytes(line);
                continue;
            }

            let done: boolean;

            try {
                done = parser.parse({
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
                    ...(onJumpTarget === undefined ? {} : { onJumpTarget }),
                    ...(onJumpParsed === undefined ? {} : { onJumpParsed }),
                    ...(onSelectorDispatch === undefined ? {} : { onSelectorDispatch }),
                    ...(onReturn === undefined ? {} : { onReturn }),
                    ...(currentFunction === undefined ? {} : { returnTargets: currentFunction.returnTargets }),
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                state.warnings.add(`Could not parse ${instruction} at offset ${currentOffset}: ${message}`);
                codeBuilder.push(new CustomInstruction(`// Error: ${instruction} at offset ${currentOffset}: ${message}`));
                break;
            }

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

    state.frameExtents.set(offset, Math.max(state.frameExtents.get(offset) ?? offset, lastDirectOffset));

    // Only cache paths that were not cut short, since those results depend on
    // the path that reached them.
    if (key !== undefined && state.cache && state.pathBreaks === pathBreaksBefore) {
        state.cache.set(key, codeBuilder);
    }

    return codeBuilder;
}

function renderProgram(instructions: AbstractInstruction[], functions: DecompiledFunction[]): string {
    const parts: string[] = [];
    const main = stringifyBody(instructions);

    if (main.length > 0) {
        parts.push(main);
    }

    for (const fn of functions) {
        const body = stringifyBody(fn.body);
        const details = fn.selector === undefined
            ? `offset 0x${fn.offset.toString(16)}`
            : `selector 0x${fn.selector.toString(16).padStart(8, "0")}, offset 0x${fn.offset.toString(16)}`;

        parts.push([
            `// --- ${fn.label} (${details}) ---`,
            `${fn.label}() {`,
            shiftMultilineText(body.length > 0 ? body : "// (no instructions)"),
            "}",
        ].join("\n"));
    }

    return parts.join("\n\n");
}

function toMemory(memory: EVMMemory | Record<string, EVMValue>): EVMMemory {
    if (memory instanceof EVMMemory) {
        return memory;
    }

    const result = new EVMMemory();

    for (const [key, value] of Object.entries(memory)) {
        result.storeWord(new EVMValue(key, EVMValueTypes.NUMBER), value);
    }

    return result;
}

/**
 * Parses the opcode listing starting at `offset` and returns the instruction tree.
 * Exported for backwards compatibility; prefer `decompile`.
 */
export function parseOpcode(
    opcode: string,
    offset = 0,
    stack: EVMValue[] = [],
    memory: EVMMemory | Record<string, EVMValue> = new EVMMemory(),
    storage: Record<string, EVMValue> = {},
    _unknownInstructions: Set<string> = new Set(),
    visitedOffset: Set<number> = new Set(),
    depth = 0,
    config: ExecutionContext = {},
    cache: Map<string, AbstractInstruction[]> = new Map(),
): AbstractInstruction[] {
    const state = createState(opcode, { context: config }, false);
    state.cache = cache;

    return walk(state, offset, stack, toMemory(memory), storage, visitedOffset, depth);
}

/** Decompiles an opcode listing into pseudo-code, plus diagnostics. */
export function decompileWithReport(source: string, options: DecompileOptions = {}): DecompileReport {
    // First pass: find out which jump targets are shared.
    const discovery = createState(source, options, false);

    walk(discovery, 0, [], new EVMMemory(), {}, new Set(), 0);

    // Second pass: extract shared targets into functions and emit calls.
    const state = createState(source, options, true);

    if (options.extractFunctions !== false) {
        const extraction = computeExtractTargets(discovery);

        state.extractTargets = extraction.targets;
        state.extractSites = extraction.sites;
        state.extractSelectors = extraction.selectors;
    }

    const instructions = walk(state, 0, [], new EVMMemory(), {}, new Set(), 0);
    const used = state.usedFunctions ?? new Set<number>();
    const functions = [...(state.functions?.values() ?? [])].filter(fn => used.has(fn.offset));

    return {
        code: renderProgram(instructions, functions),
        instructions,
        functions,
        warnings: [...new Set([...discovery.warnings, ...state.warnings])],
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
