import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { knownOrSymbolic } from "./helpers";

export class ADDRESSParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        stack.push(knownOrSymbolic(config.address, "[ADDRESS(this)]"));

        return false;
    }
}
