import { AbstractInstruction } from "../code-builder";
import type { EVMValue } from "../evm-value";
import type { EVMMemory } from "../memory";
import type { LinesByOffset } from "../utils";

/**
 * Extra information about the transaction/account the code is decompiled for.
 * Everything is optional: unknown inputs simply stay symbolic in the output.
 */
export type ExecutionContext = {
    /** Calldata as a `0x` prefixed hex string. */
    calldata?: string,
    caller?: bigint,
    value?: bigint,
    address?: bigint,
    /** Remaining gas when execution starts. */
    gas?: bigint,
    /** Address (as `0x` hex) -> deployed runtime code (as `0x` hex). */
    codes?: Record<string, string>,
};

/** Information the decompiler needs about a jump it is about to inline. */
export type JumpSite = {
    /** Byte offset of the jump destination. */
    target: number,
    /** Byte offset of the JUMP instruction itself. */
    site: number,
    stack: EVMValue[],
    memory: EVMMemory,
    storage: Record<string, EVMValue>,
    /** Size of the JUMP instruction in bytes. */
    jumpBytes: number,
};

export type OpcodeParserParentContext = {
    opcode: string,
    args: string[],
    originalOffset: number,
    stack: EVMValue[],
    memory: EVMMemory,
    storage: Record<string, EVMValue>,
    lines: string[],
    linesByOffset: LinesByOffset,
    currentOffset: number,
    codeBuilder: AbstractInstruction[],
    line: string,
    parentCallback: (opcode: string, offset: number, stack: EVMValue[], memory: EVMMemory, storage: Record<string, EVMValue>) => AbstractInstruction[];
    config: ExecutionContext,
    /**
     * Replaces an unconditional jump with something else (a call to an extracted
     * function). Return `undefined` to let the jump be inlined as usual.
     */
    onJumpTarget?: (jump: JumpSite) => AbstractInstruction[] | undefined,
    /** Called after a jump target was inlined, used by the discovery pass. */
    onJumpParsed?: (target: number, site: number) => void,
    /** Called when a function body jumps back to its caller. */
    onReturn?: (stack: EVMValue[]) => void,
    /** Offsets that are return labels of the function currently being parsed. */
    returnTargets?: Set<number>,
    /** Called when a conditional jump compares msg.sig against a selector. */
    onSelectorDispatch?: (target: number, selector: bigint, site: number) => void,
}

export interface IOpcodeParser {
    /**
     * Parses the opcode and changes context in-place.
     * @param instruction Opcode instruction
     * @param args Opcode args (without the original instruction)
     * @param context Parent's parse function context
     * @returns true for finishing execution and breaking out of the loop. So return true will stop the parent parser from parsing any more opcodes.
     */
    parse(context: OpcodeParserParentContext): boolean;
}
