import { AbstractInstruction } from "../code-builder";
import type { EVMValue } from "../evm-value";
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

export type OpcodeParserParentContext = {
    opcode: string,
    args: string[],
    originalOffset: number,
    stack: EVMValue[],
    memory: Record<string, EVMValue>,
    storage: Record<string, EVMValue>,
    lines: string[],
    linesByOffset: LinesByOffset,
    currentOffset: number,
    codeBuilder: AbstractInstruction[],
    line: string,
    parentCallback: (opcode: string, offset: number, stack: EVMValue[], memory: Record<string, EVMValue>, storage: Record<string, EVMValue>) => AbstractInstruction[];
    config: ExecutionContext,
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
