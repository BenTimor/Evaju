import type { EVMValue } from "../evm-value";
import type { LinesByOffset } from "../utils";

export type OpcodeParserParentContext = {
    opcode: string,
    originalOffset: number,
    stack: EVMValue[],
    memory: Record<string, EVMValue>,
    lines: string[],
    linesByOffset: LinesByOffset,
    currentOffset: number,
    readableCodeBuilder: string[],
    line: string,
    parentCallback: (opcode: string, offset: number, stack: EVMValue[], memory: Record<string, EVMValue>) => string;
    config: {
        calldata?: EVMValue,
        caller?: EVMValue,
        value?: EVMValue,
    },
}

export interface IOpcodeParser {
    /**
     * Parses the opcode and changes context in-place.
     * @param instruction Opcode instruction
     * @param args Opcode args (without the original instruction)
     * @param context Parent's parse function context
     * @returns true for finishing execution and breaking out of the loop. So return true will stop the parent parser from parsing any more opcodes.
     */
    parse(args: string[], context: OpcodeParserParentContext): boolean;
}