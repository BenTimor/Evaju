import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class STOPParser implements IOpcodeParser {
    parse(args: string[], { readableCodeBuilder }: OpcodeParserParentContext): boolean {
        readableCodeBuilder.push("// Stop succesfully");
        return true;
    }
}