import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MSTOREParser implements IOpcodeParser {
    parse(_args: string[], { stack, memory }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        const value = stack.pop();

        exists(key);
        exists(value);

        memory[key.key] = value;

        return false;
    }
}