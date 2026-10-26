import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { knownOrSymbolic } from "./helpers";

export class CALLVALUEParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        stack.push(knownOrSymbolic(config.value, "[VALUE]"));

        return false;
    }
}
