import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class EQParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();

        exists(a);
        exists(b);

        const computed = new ComputedNumber((a, b) => a === b, [a, b]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${a.description}) == (${b.description})`));

        return false;
    }
}