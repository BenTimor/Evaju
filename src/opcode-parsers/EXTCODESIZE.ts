import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { hexByteLength, toHex } from "../utils";
import { knownOrSymbolic } from "./helpers";

export class EXTCODESIZEParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const address = stack.pop();
        exists(address);

        const addressNumber = address.knownNumber;
        const code = addressNumber === undefined ? undefined : config.codes?.[toHex(addressNumber)];
        const size = code === undefined ? undefined : BigInt(hexByteLength(code));

        stack.push(knownOrSymbolic(size, `[EXTCODESIZE(${address})]`));

        return false;
    }
}
