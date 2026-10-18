import { randomInt } from "crypto";
import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CREATE2Parser implements IOpcodeParser {
    parse(args: string[], { stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const value = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();
        const salt = stack.pop();

        codeBuilder.push(new CustomInstruction(`// CREATE2 with offset ${offset?.description} size ${size?.description} and value ${value?.description}`));
        stack.push(new EVMValue(randomInt(10000), EVMValueTypes.NUMBER)); // TODO Rethink because it'll be hard to debug.

        return false;
    }
}