import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";

export class EXTCODEHASHParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const address = stack.pop();
        exists(address);

        stack.push(new EVMValue(`[EXTCODEHASH(${address})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
