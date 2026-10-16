import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class POPParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        exists(stack.pop());

        return false;
    }
}