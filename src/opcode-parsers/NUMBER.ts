import { EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class NUMBERParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue("[BLOCKNUMBER]", EVMValueTypes.CUSTOM));

        return false;
    }
}