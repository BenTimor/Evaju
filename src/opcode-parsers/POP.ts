import { CustomInstruction } from "../code-builder";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class POPParser implements IOpcodeParser {
    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        if (!stack.pop()) {
            codeBuilder.push(new CustomInstruction("// Revert by POP"));
            return true;
        }

        return false;
    }
}