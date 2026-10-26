import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { readHexBytes, toSafeNumber } from "../utils";
import { knownOrSymbolic } from "./helpers";

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
        const value = config.calldata !== undefined && offsetNumber !== undefined && sizeNumber !== undefined
            ? readHexBytes(config.calldata, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber)
            : undefined;

        memory[`${destination}`] = knownOrSymbolic(value, `[Calldata[${offset}:${size}]]`);

        return false;
    }
}
