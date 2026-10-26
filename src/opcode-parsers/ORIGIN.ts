import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ORIGINParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[ORIGIN]", EVMValueTypes.CUSTOM));
        return false;
    }
}
