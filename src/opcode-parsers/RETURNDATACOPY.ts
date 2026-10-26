import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";

export class RETURNDATACOPYParser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destination);
        exists(offset);
        exists(size);

        // The callee is not executed, so the copied bytes stay symbolic.
        memory[`${destination}`] = new EVMValue(`[RETURNDATACOPY(${offset}, ${size})]`, EVMValueTypes.CUSTOM);

        return false;
    }
}
