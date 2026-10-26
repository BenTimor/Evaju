import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { knownOrSymbolic } from "./helpers";
import { hexByteLength } from "../utils";

export class CALLDATASIZEParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const size = config.calldata === undefined ? undefined : BigInt(hexByteLength(config.calldata));

        stack.push(knownOrSymbolic(size, "[CALLDATASIZE]"));

        return false;
    }
}
