import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MSTORE8Parser implements IOpcodeParser {
    parse({ stack, memory }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        const value = stack.pop();

        exists(key);
        exists(value);

        memory.storeByte(key, value);

        return false;
    }
}
