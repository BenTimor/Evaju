import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class NOTParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();

        const computed = new ComputedNumber(a => {
            assertBigInt(a.value);

            return ~a.value;
        }, [a])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `~${a}`));

        return false;
    }
}