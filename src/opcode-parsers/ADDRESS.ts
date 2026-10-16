import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ADDRESSParser implements IOpcodeParser {
    parse(_args: string[], { stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber(address => {
            assertBigInt(address.value);

            return address.value;
        }, [config.address]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, "[ADDRESS(this)]"));

        return false;
    }
}