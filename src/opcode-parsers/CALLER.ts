import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { knownOrSymbolic } from "./helpers";

export class CALLERParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        stack.push(knownOrSymbolic(config.caller, "[CALLER]"));

        return false;
    }
}
