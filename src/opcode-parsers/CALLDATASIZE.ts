import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLDATASIZEParser implements IOpcodeParser {
    parse(_args: string[], { stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber((calldata) => calldata.value.toString(16).length / 2, [config.calldata])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[CALLDATA.length / 2]`));

        return false;
    }
}