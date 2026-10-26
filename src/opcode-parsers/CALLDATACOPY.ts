import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { sliceHexBytes, toSafeNumber } from "../utils";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { WORD_BYTES } from "../constants";

export class CALLDATACOPYParser implements IOpcodeParser {
    parse({ stack, memory, config }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destination);
        exists(offset);
        exists(size);

        const offsetNumber = offset.knownNumber;
        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n);

        if (config.calldata !== undefined && offsetNumber !== undefined && sizeNumber !== undefined) {
            memory.storeHex(
                destination,
                sizeNumber,
                sliceHexBytes(config.calldata, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber),
            );

            return false;
        }

        memory.store(
            destination,
            sizeNumber ?? WORD_BYTES,
            new EVMValue(`[Calldata[${offset}:${size}]]`, EVMValueTypes.CUSTOM),
        );

        return false;
    }
}
