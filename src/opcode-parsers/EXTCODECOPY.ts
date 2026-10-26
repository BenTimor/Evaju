import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { readHexBytes, toHex, toSafeNumber } from "../utils";
import { knownOrSymbolic } from "./helpers";

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
        const value = code !== undefined && offsetNumber !== undefined && sizeNumber !== undefined
            ? readHexBytes(code, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber)
            : undefined;

        memory[`${destination}`] = knownOrSymbolic(value, `[EXTCODECOPY(${address}, ${offset}, ${size})]`);

        return false;
    }
}
