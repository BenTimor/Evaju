import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { OpcodeCSV } from "../opcodes";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CODECOPYParser implements IOpcodeParser {
    parse({ memory, stack, opcode }: OpcodeParserParentContext): boolean {
        const destOffset = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destOffset);
        exists(offset);
        exists(size);

        const computed = new ComputedNumber((offset, size) => {
            assertBigInt(offset.value);
            assertBigInt(size.value);

            const bytecode = OpcodeCSV.toBytecode(opcode);
            const slicedBytecode = bytecode.slice(2).slice(Number(offset.value) * 2, Number(offset.value) * 2 + Number(size.value) * 2);

            return "0x" + slicedBytecode + new Array(Number(size.value) * 2 - slicedBytecode.length).fill("0").join("");
        }, [offset, size])

        memory[`${destOffset}`] = new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[CODECOPY from offset ${offset} with size of ${size}]`)

        return false;
    }
}