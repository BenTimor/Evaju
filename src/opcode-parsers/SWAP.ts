import { CustomInstruction } from "../code-builder";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SWAPParser implements IOpcodeParser {
    constructor(private offset: number) {}

    parse(args: string[], { stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const a = stack[stack.length - 1];
        const b = stack[stack.length - 1 - this.offset];

        if (!a || !b) {
            codeBuilder.push(new CustomInstruction("// Revert by SWAP"));
            return false;
        }

        exists(a);
        exists(b);

        stack[stack.length - 1] = b;
        stack[stack.length - 1 - this.offset] = a;

        return false;
    }
}