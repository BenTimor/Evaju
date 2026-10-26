import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

/** Pushes a named but otherwise unknown value (environment data, hashes, ...). */
export class SymbolicPushParser implements IOpcodeParser {
    constructor(private description: string) { }

    parse({ stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue(this.description, EVMValueTypes.CUSTOM));

        return false;
    }
}

/** Pops a single argument and pushes `[NAME(argument)]`. */
export class UnarySymbolicParser implements IOpcodeParser {
    constructor(private name: string) { }

    parse({ stack }: OpcodeParserParentContext): boolean {
        const argument = stack.pop();

        if (!argument) {
            stack.push(new EVMValue(`[${this.name}]`, EVMValueTypes.CUSTOM));
            return false;
        }

        stack.push(new EVMValue(`[${this.name}(${argument})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}

/**
 * Models an opcode we do not evaluate in detail: it pops a fixed number of
 * operands and optionally pushes a symbolic result, keeping the stack in sync.
 */
export class StackOpsParser implements IOpcodeParser {
    constructor(private name: string, private pops: number, private pushes = 0) { }

    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const operands = [];

        for (let index = 0; index < this.pops; index++) {
            const operand = stack.pop();

            if (!operand) {
                codeBuilder.push(new CustomInstruction(`// Revert by ${this.name} (stack underflow)`));
                return true;
            }

            operands.push(operand);
        }

        for (let index = 0; index < this.pushes; index++) {
            const argument = operands.length > 0 ? `(${operands.join(", ")})` : "";
            stack.push(new EVMValue(`[${this.name}${argument}]`, EVMValueTypes.CUSTOM));
        }

        return false;
    }
}
