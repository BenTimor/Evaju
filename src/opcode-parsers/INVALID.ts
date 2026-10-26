import { CustomInstruction } from "../code-builder";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class INVALIDParser implements IOpcodeParser {
    parse({ codeBuilder }: OpcodeParserParentContext): boolean {
        codeBuilder.push(new CustomInstruction("// INVALID opcode (halts execution, consumes all gas)"));

        return true;
    }
}
