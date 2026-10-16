import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SHParser implements IOpcodeParser {
    constructor(private right: boolean) {}

    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const shift = stack.pop();
        const value = stack.pop();

        exists(shift);
        exists(value);

        const computed = new ComputedNumber((shift, value) => {
            assertBigInt(shift.value);
            assertBigInt(value.value);

            if (BigInt(shift.value) >= 256n) {
                return 0n;
            }
            
            const mask256 = (1n << 256n) - 1n;
            let cleanValue = value.value & mask256;

            return this.right ? cleanValue >> BigInt(shift.value) : cleanValue << BigInt(shift.value);
        }, [shift, value])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${value.description}) ${this.right ? ">>" : "<<"} (${shift.description})`));

        return false;
    }
}