import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SELFBALANCEParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[SELFBALANCE]", EVMValueTypes.CUSTOM));
        return false;
    }
}
