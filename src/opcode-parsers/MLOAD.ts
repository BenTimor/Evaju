import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MLOADParser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();

        exists(offset);

        stack.push(memory.readWord(offset)
            ?? new EVMValue(`[MEMORY[${offset}]]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
