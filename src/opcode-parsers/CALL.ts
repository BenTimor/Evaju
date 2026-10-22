import { CustomInstruction } from "../code-builder";
import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { everyExists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLParser implements IOpcodeParser {
    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const gas = stack.pop();
        const address = stack.pop();
        const value = stack.pop();
        const argsOffset = stack.pop();
        const argsSize = stack.pop();
        const retOffset = stack.pop();
        const retSize = stack.pop();

        everyExists([gas, address, value, argsOffset, argsSize, retOffset, retSize]);

        codeBuilder.push(new CustomInstruction(`// Call to ${address} with value of ${value} and gas of ${gas}`));

        const computed = new ComputedNumber((_) => 0, [undefined]);
        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[SUCCESS_FOR_CALL(${address})]`));

        return false;
    }
}