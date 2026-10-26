import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { everyExists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CREATEParser implements IOpcodeParser {
    constructor(private withSalt = false) { }

    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const value = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();
        const salt = this.withSalt ? stack.pop() : undefined;

        everyExists([value, offset, size]);

        if (this.withSalt) {
            everyExists([salt]);
        }

        const name = this.withSalt ? "CREATE2" : "CREATE";
        const saltDetails = salt ? ` and salt ${salt}` : "";

        codeBuilder.push(new CustomInstruction(`// ${name} with offset ${offset} size ${size} and value ${value}${saltDetails}`));

        // The address depends on runtime state, so it stays symbolic (and deterministic).
        stack.push(new EVMValue(`[${name}(${value}, ${offset}, ${size}${salt ? `, ${salt}` : ""})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
