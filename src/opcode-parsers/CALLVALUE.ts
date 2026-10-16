import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLVALUEParser implements IOpcodeParser {
    parse(_args: string[], { stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber((value) => {
            assertBigInt(value.value);

            return value.value;
        }, [config.value])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, "[VALUE]"));

        return false;
    }
}