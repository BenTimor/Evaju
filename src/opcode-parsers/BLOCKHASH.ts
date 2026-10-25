import { EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class BLOCKHASHParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const blockNumber = stack.pop();
        stack.push(new EVMValue(`[BLOCKHASH(${blockNumber?.value})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}