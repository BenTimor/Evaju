import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class NOTParser implements IOpcodeParser {
    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();

        const computed = new ComputedNumber(a => {
            assertBigInt(a);

            return ~a;
        }, [a])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `~${a?.description}`));

        return false;
    }
}