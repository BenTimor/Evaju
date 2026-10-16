import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SWAPParser implements IOpcodeParser {
    constructor(private offset: number) {}

    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack[stack.length - 1];
        const b = stack[stack.length - 1 - this.offset];

        exists(a);
        exists(b);

        stack[stack.length - 1] = b;
        stack[stack.length - 1 - this.offset] = a;

        return false;
    }
}