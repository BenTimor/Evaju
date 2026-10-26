import { hexToBigInt, keccak256 } from "viem";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { toSafeNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class KECCAK256Parser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n, 4096n);
        const read = sizeNumber === undefined ? undefined : memory.read(offset, sizeNumber);

        if (read?.kind === "known") {
            stack.push(new EVMValue(hexToBigInt(keccak256(`0x${read.hex}`)), EVMValueTypes.NUMBER));
            return false;
        }

        if (read?.kind === "symbolic") {
            stack.push(new EVMValue(`[KECCAK256(${read.value})]`, EVMValueTypes.CUSTOM));
            return false;
        }

        stack.push(new EVMValue(`[KECCAK256(${offset}, ${size})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
