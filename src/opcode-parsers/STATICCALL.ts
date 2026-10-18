import { CustomInstruction } from "../code-builder";
import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { everyExists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class STATICCALLParser implements IOpcodeParser {
    parse(_args: string[], { stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const gas = stack.pop();
        const address = stack.pop();
        const argsOffset = stack.pop();
        const argsSize = stack.pop();
        const retOffset = stack.pop();
        const retSize = stack.pop();

        everyExists([gas, address, argsOffset, argsSize, retOffset, retSize]);

        codeBuilder.push(new CustomInstruction(`// Static call to ${address?.description}`));

        const computed = new ComputedNumber((_) => 0, [undefined]);
        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[SUCCESS_FOR_STATIC_CALL(${address?.description})]`));

        return false;
    }
}