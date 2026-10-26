import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class BLOCKHASHParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const blockNumber = stack.pop();
        exists(blockNumber);

        stack.push(new EVMValue(`[BLOCKHASH(${blockNumber})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
