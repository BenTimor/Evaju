import { hexToBigInt, keccak256 } from "viem";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { sliceBytes, toHex } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class KECCAK256Parser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const word = memory[`${offset}`];
        const sizeNumber = size.knownNumber;

        if (word?.knownNumber === undefined || sizeNumber === undefined || sizeNumber < 0n || sizeNumber > 32n) {
            stack.push(new EVMValue(`[KECCAK256(${word ?? offset}, ${size})]`, EVMValueTypes.CUSTOM));
            return false;
        }

        // Hash the first `size` bytes of the word stored at `offset`.
        const byteSize = Number(sizeNumber);
        const hashed = sliceBytes(word.knownNumber, 0, byteSize);
        const data = toHex(hashed, byteSize) as `0x${string}`;

        stack.push(new EVMValue(hexToBigInt(keccak256(data)), EVMValueTypes.NUMBER));

        return false;
    }
}
