import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { toSafeNumber } from "../utils";
import { WORD_BYTES } from "../constants";

export class RETURNDATACOPYParser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destination);
        exists(offset);
        exists(size);

        // The callee is not executed, so the copied bytes stay symbolic.
        memory.store(
            destination,
            toSafeNumber(size.knownNumber ?? -1n) ?? WORD_BYTES,
            new EVMValue(`[RETURNDATACOPY(${offset}, ${size})]`, EVMValueTypes.CUSTOM),
        );

        return false;
    }
}
