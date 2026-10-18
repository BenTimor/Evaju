import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { sliceOffset, unknownBaseStringToNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLDATALOAD implements IOpcodeParser {
    parse(args: string[], { stack, config }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        exists(offset);

        const computed = new ComputedNumber((offset, calldata) => {
            assertBigInt(calldata.value);
            assertBigInt(offset.value);

            const slicedCalldata = sliceOffset(calldata.value, Number(offset.value));

            return unknownBaseStringToNumber(
                slicedCalldata
                + (new Array(64 - slicedCalldata.length).fill(0).join("")) // Add 0s until we get back to 32 bytes
            );
        }, [offset, config.calldata]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[Calldata[${offset.description}]]`));

        return false;
    }
}