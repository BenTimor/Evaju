import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { sliceOffset, unknownBaseStringToNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLDATACOPYParser implements IOpcodeParser {
    parse(args: string[], { stack, memory, config }: OpcodeParserParentContext): boolean {
        const dataOffset = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(dataOffset);
        exists(offset);
        exists(size);

        const computed = new ComputedNumber((offset, size, calldata) => {
            assertBigInt(calldata.value);
            assertBigInt(offset.value);
            assertBigInt(size.value);

            const slicedCalldata = sliceOffset(calldata.value, Number(offset.value));

            return unknownBaseStringToNumber(
                slicedCalldata
                + (new Array(Number(size.value) - slicedCalldata.length).fill(0).join("")) // Add 0s until we get back to 32 bytes
            );
        }, [offset, size, config.calldata]);

        memory[dataOffset.key] = new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[Calldata[${offset.description}:${size.description}]]`);

        return false;
    }
}