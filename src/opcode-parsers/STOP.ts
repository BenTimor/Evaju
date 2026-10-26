import { CustomInstruction } from "../code-builder";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class STOPParser implements IOpcodeParser {
    parse({ codeBuilder }: OpcodeParserParentContext): boolean {
        codeBuilder.push(new CustomInstruction("// Stop successfully"));
        return true;
    }
}
