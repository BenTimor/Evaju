import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLERParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber((caller) => {
            assertBigInt(caller.value);

            return caller.value;
        }, [config.caller])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, "[CALLER]"));

        return false;
    }
}