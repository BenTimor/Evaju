import { CustomInstruction } from "../code-builder";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SWAPParser implements IOpcodeParser {
    constructor(private offset: number) { }

    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const a = stack[stack.length - 1];
        const b = stack[stack.length - 1 - this.offset];

        if (!a || !b) {
            codeBuilder.push(new CustomInstruction(`// Revert by SWAP${this.offset} (stack underflow)`));
            return true;
        }

        stack[stack.length - 1] = b;
        stack[stack.length - 1 - this.offset] = a;

        return false;
    }
}
