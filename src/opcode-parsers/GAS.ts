import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { knownOrSymbolic } from "./helpers";

export class GASParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        stack.push(knownOrSymbolic(config.gas, "[GAS]"));

        return false;
    }
}
