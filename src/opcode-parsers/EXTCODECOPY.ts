import { hexToBigInt, sliceHex, toHex } from "viem";
import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class EXTCODECOPYParser implements IOpcodeParser {
    parse({ memory, stack, config }: OpcodeParserParentContext): boolean {
        const address = stack.pop();
        const dataOffset = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(address);
        exists(dataOffset);

        const computed = new ComputedNumber((address, offset, size, code) => {
            assertBigInt(code.value);
            assertBigInt(offset.value);
            assertBigInt(size.value);

            return hexToBigInt(sliceHex(toHex(code.value), Number(offset.value), Number(offset.value) + Number(size.value)));
        }, [address, offset, size, config.codes?.[Number(address.value)]]);

        memory[`${dataOffset}`] = new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[EXTCODECOPY(${address})]`);

        return false;
    }
}