import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class DUPParser implements IOpcodeParser {
    constructor(private position: number) {}

    parse(args: string[], { stack, readableCodeBuilder }: OpcodeParserParentContext): boolean {
        const value = stack[stack.length - this.position];

        if (!value) {
            readableCodeBuilder.push(`// Revert by DUP trying to overflow stack at position ${this.position}`)
            return true;
        }
        
        stack.push(value.clone());
        return false;
    }
}