import { CustomInstruction } from "../code-builder";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SSTOREParser implements IOpcodeParser {
    parse({ stack, storage, codeBuilder }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        const value = stack.pop();

        exists(key);
        exists(value);

        storage[`${key}`] = value;

        // State changes are the most interesting part of the output, so surface them.
        codeBuilder.push(new CustomInstruction(`// STORAGE[${key}] = ${value}`));

        return false;
    }
}
