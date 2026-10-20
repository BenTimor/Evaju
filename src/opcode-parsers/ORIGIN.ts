import { EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ORIGINParser implements IOpcodeParser {
    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[ORIGIN]", EVMValueTypes.CUSTOM));
        return false;
    }
}