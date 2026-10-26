import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SLOADParser implements IOpcodeParser {
    parse({ stack, storage }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        exists(key);

        const stored = storage[`${key}`];

        stack.push(stored
            ? stored.clone()
            : new EVMValue(`[STORAGE[${key}]]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
