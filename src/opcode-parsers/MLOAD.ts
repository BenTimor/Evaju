import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MLOADParser implements IOpcodeParser {
    parse(args: string[], { stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();

        exists(offset);

        stack.push(memory[offset.key] ?? new EVMValue(0, EVMValueTypes.NUMBER));

        return false;
    }
}