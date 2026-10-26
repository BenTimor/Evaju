import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class PCParser implements IOpcodeParser {
    parse({ stack, currentOffset }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue(BigInt(currentOffset), EVMValueTypes.NUMBER));

        return false;
    }
}
