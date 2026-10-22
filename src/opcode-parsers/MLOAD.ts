import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MLOADParser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();

        exists(offset);

        const computed = new ComputedNumber((mem) => {
            assertBigInt(mem.value);
            return mem.value;
        }, [memory[`${offset}`]]);

        const value = new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[MEMORY[${offset}]]`);
        stack.push(value);

        return false;
    }
}