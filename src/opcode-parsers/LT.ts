import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class LTParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();

        exists(a);
        exists(b);

        const computed = new ComputedNumber((a, b) => a.value < b.value, [a, b])
        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${b.description}) < (${a.description})`));
        return false;
    }
}