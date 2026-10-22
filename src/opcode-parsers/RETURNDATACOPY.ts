import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class RETURNDATACOPYParser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const dataOffset = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(dataOffset);

        // TODO We need to think about it.
        const computed = new ComputedNumber((_) => 0, [undefined]);

        memory[`${dataOffset}`] = new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[RETURNDATACOPY[${offset}:${size}]]`);

        return false;
    }
}