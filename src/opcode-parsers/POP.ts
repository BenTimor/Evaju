import { CustomInstruction } from "../code-builder";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class POPParser implements IOpcodeParser {
    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        if (!stack.pop()) {
            codeBuilder.push(new CustomInstruction("// Revert by POP (stack underflow)"));
            return true;
        }

        return false;
    }
}
