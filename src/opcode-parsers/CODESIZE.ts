import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { OpcodeCSV } from "../opcodes";
import { EVMValue, EVMValueTypes } from "../evm-value";

export class CODESIZEParser implements IOpcodeParser {
    parse({ stack, opcode }: OpcodeParserParentContext): boolean {
        const bytecode = OpcodeCSV.tryToBytecode(opcode);

        stack.push(bytecode === undefined
            ? new EVMValue("[CODESIZE]", EVMValueTypes.CUSTOM)
            : new EVMValue(BigInt((bytecode.length - 2) / 2), EVMValueTypes.NUMBER));

        return false;
    }
}
