import { EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SELFBALANCEParser implements IOpcodeParser {
    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[SELFBALANCE]", EVMValueTypes.CUSTOM));
        return false;
    }
}