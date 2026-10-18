import { CustomInstruction } from "../code-builder";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class STOPParser implements IOpcodeParser {
    parse(args: string[], { codeBuilder }: OpcodeParserParentContext): boolean {
        codeBuilder.push(new CustomInstruction("// Stop succesfully"));
        return true;
    }
}