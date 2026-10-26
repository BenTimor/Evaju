import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { exists } from "../type-utils";
import { readHexBytes, toSafeNumber } from "../utils";
import { knownOrSymbolic } from "./helpers";

export class CALLDATALOAD implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        exists(offset);

        const offsetNumber = offset.knownNumber;
        const value = config.calldata !== undefined && offsetNumber !== undefined
            ? readHexBytes(config.calldata, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, 32)
            : undefined;

        stack.push(knownOrSymbolic(value, `[Calldata[${offset}]]`));

        return false;
    }
}
