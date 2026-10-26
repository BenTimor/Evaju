import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { sliceBytes } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MSTORE8Parser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        const value = stack.pop();

        exists(key);
        exists(value);

        const known = value.knownNumber;

        memory[`${key}`] = known === undefined
            ? new EVMValue(`[BYTE(0x0, ${value})]`, EVMValueTypes.CUSTOM)
            : new EVMValue(sliceBytes(known, 0, 1), EVMValueTypes.NUMBER);

        return false;
    }
}
