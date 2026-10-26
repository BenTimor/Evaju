import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { sliceHexBytes, toHex, toSafeNumber } from "../utils";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { WORD_BYTES } from "../constants";

export class EXTCODECOPYParser implements IOpcodeParser {
    parse({ memory, stack, config }: OpcodeParserParentContext): boolean {
        const address = stack.pop();
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(address);
        exists(destination);
        exists(offset);
        exists(size);

        const addressNumber = address.knownNumber;
        const code = addressNumber === undefined ? undefined : config.codes?.[toHex(addressNumber)];
        const offsetNumber = offset.knownNumber;
        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n);

        if (code !== undefined && offsetNumber !== undefined && sizeNumber !== undefined) {
            memory.storeHex(
                destination,
                sizeNumber,
                sliceHexBytes(code, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber),
            );

            return false;
        }

        memory.store(
            destination,
            sizeNumber ?? WORD_BYTES,
            new EVMValue(`[EXTCODECOPY(${address}, ${offset}, ${size})]`, EVMValueTypes.CUSTOM),
        );

        return false;
    }
}
