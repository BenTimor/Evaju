import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ISZEROParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();

        exists(a);

        const computed = new ComputedNumber(a => {
            assertBigInt(a.value);

            return a.value === 0n;
        }, [a]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${a.description}) == 0`));

        return false;
    }
}