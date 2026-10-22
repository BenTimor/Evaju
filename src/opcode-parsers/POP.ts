import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class POPParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        exists(stack.pop());

        return false;
    }
}