import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { sliceBytes } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class BYTEParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const index = stack.pop();
        const word = stack.pop();

        exists(index);
        exists(word);

        const computed = new ComputedNumber((index, word) => {
            if (index.knownNumber === undefined || word.knownNumber === undefined) {
                throw new Error("Value is not a number");
            }

            const byteIndex = index.knownNumber;

            if (byteIndex < 0n || byteIndex > 31n) {
                return 0n;
            }

            // BYTE counts from the most significant byte.
            return sliceBytes(word.knownNumber, 31 - Number(byteIndex), 1);
        }, [index, word]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[BYTE(${index}, ${word})]`));

        return false;
    }
}
