import { CustomInstruction } from "../code-builder";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class DUPParser implements IOpcodeParser {
    constructor(private position: number) { }

    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const value = stack[stack.length - this.position];

        if (!value) {
            codeBuilder.push(new CustomInstruction(`// Revert by DUP${this.position} (stack underflow)`));
            return true;
        }

        stack.push(value.clone());

        return false;
    }
}
