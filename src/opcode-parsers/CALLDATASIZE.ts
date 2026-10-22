import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLDATASIZEParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const computed = new ComputedNumber((calldata) => calldata.value.toString(16).length / 2, [config.calldata])

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[CALLDATASIZE]`));

        return false;
    }
}