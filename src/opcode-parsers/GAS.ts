import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class GASParser implements IOpcodeParser {
    parse(_args: string[], { stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber(gas => {
            assertBigInt(gas.value);

            return gas.value;
        }, [config.gas])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, "[GAS]"));

        return false;
    }
}