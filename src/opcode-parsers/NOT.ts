import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { normalizeUint256 } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";

export class NOTParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        exists(a);

        const computed = new ComputedNumber(value => {
            if (value.knownNumber === undefined) {
                throw new Error("Value is not a number");
            }

            return normalizeUint256(~value.knownNumber);
        }, [a]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `~${a}`));

        return false;
    }
}
