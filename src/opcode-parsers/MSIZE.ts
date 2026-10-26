import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MSIZEParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[MSIZE]", EVMValueTypes.CUSTOM));

        return false;
    }
}
