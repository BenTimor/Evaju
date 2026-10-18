import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class BYTEParser implements IOpcodeParser {
    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        const i = stack.pop();
        const x = stack.pop();

        const computed = new ComputedNumber((i, x) => {
            assertBigInt(i.value);
            assertBigInt(x.value);

            return "0x" + x.value.toString(16).slice(Number(x.value) * 2, Number(x.value) * 2 + 2);
        }, [i, x]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[BYTE at ${i?.description} of ${x?.description}]`));

        return false;
    }
}