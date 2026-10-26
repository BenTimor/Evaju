import { MAX_UINT256 } from "../constants";
import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { normalizeUint256 } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SIGNEXTENDParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        const byteIndex = stack.pop();
        const value = stack.pop();

        exists(byteIndex);
        exists(value);

        const computed = new ComputedNumber((byteIndex, value) => {
            if (byteIndex.knownNumber === undefined || value.knownNumber === undefined) {
                throw new Error("Value is not a number");
            }

            const index = byteIndex.knownNumber;

            if (index > 30n) {
                return value.knownNumber;
            }

            const signBit = index * 8n + 7n;
            const mask = (1n << (signBit + 1n)) - 1n;
            const word = normalizeUint256(value.knownNumber);

            return (word >> signBit) & 1n ? word | (MAX_UINT256 ^ mask) : word & mask;
        }, [byteIndex, value]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[SIGNEXTEND(${byteIndex}, ${value})]`));

        return false;
    }
}
