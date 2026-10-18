import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SLOADParser implements IOpcodeParser {
    parse(_args: string[], { stack, storage }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        exists(key);

        const sValue = storage[key.key];

        const computed = new ComputedNumber(sValue => {
            assertBigInt(sValue.value);

            return sValue.value;
        }, [sValue]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[STORAGE[${key.description}]]`));

        return false;
    }
}