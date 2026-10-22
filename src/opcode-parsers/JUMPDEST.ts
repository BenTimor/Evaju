import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class JUMPDESTParser implements IOpcodeParser {
    parse(_context: OpcodeParserParentContext): boolean {
        // JUMPDEST is just a compiler notation. It doesn't do anything by itself.
        return false;
    }
}