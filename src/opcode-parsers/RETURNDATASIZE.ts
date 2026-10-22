import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class RETURNDATASIZEParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber((_) => 0, [undefined]);

        // TODO We need to think about it.
        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[RETURNDATASIZE]`));

        return false;
    }
}