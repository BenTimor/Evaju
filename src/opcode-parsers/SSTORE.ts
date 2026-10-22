import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SSTOREParser implements IOpcodeParser {
    parse({ stack, storage }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        const value = stack.pop();

        exists(key);
        exists(value);

        storage[`${key}`] = value;

        return false;
    }
}