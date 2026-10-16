import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ADDParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();

        exists(a);
        exists(b);

        const computed = new ComputedNumber((a, b) => {
            assertBigInt(a.value);
            assertBigInt(b.value);

            return a.value + b.value;
        }, [a, b])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${a.description}) + (${b.description})`));

        return false;
    }
}