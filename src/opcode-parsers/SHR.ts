import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SHRParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const shift = stack.pop();
        const value = stack.pop();

        exists(shift);
        exists(value);

        const computed = new ComputedNumber((shift, value) => {
            assertBigInt(shift.value);
            assertBigInt(value.value);

            const mask256 = (1n << 256n) - 1n;
            let cleanValue = value.value & mask256;

            if (BigInt(shift.value) >= 256n) {
                return 0n;
            }

            return cleanValue >> BigInt(shift.value);
        }, [shift, value])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${value.description}) >> (${shift.description})`));

        return false;
    }
}