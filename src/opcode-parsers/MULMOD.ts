import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MULMODParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();
        const modulus = stack.pop();

        exists(a);
        exists(b);
        exists(modulus);

        const computed = new ComputedNumber((a, b, modulus) => {
            if (a.knownNumber === undefined || b.knownNumber === undefined || modulus.knownNumber === undefined) {
                throw new Error("Value is not a number");
            }

            return modulus.knownNumber === 0n ? 0n : (a.knownNumber * b.knownNumber) % modulus.knownNumber;
        }, [a, b, modulus]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[MULMOD(${a}, ${b}, ${modulus})]`));

        return false;
    }
}
