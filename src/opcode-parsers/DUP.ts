import { CustomInstruction } from "../code-builder";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class DUPParser implements IOpcodeParser {
    constructor(private position: number) {}

    parse(args: string[], { stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const value = stack[stack.length - this.position];

        if (!value) {
            codeBuilder.push(new CustomInstruction(`// Revert by DUP trying to overflow stack at position ${this.position}`));
            return true;
        }
        
        stack.push(value.clone());
        return false;
    }
}