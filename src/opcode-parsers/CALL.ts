import { CustomInstruction } from "../code-builder";
import { everyExists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLParser implements IOpcodeParser {
    parse(_args: string[], { stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const gas = stack.pop();
        const address = stack.pop();
        const value = stack.pop();
        const argsOffset = stack.pop();
        const argsSize = stack.pop();
        const retOffset = stack.pop();
        const retSize = stack.pop();

        everyExists([gas, address, value, argsOffset, argsSize, retOffset, retSize]);

        codeBuilder.push(new CustomInstruction(`// Call to ${address?.description} with value of ${value?.description} and gas of ${gas?.description}`));

        return false;
    }
}