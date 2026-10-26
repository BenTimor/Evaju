import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { OpcodeCSV } from "../opcodes";
import { exists } from "../type-utils";
import { sliceHexBytes, toSafeNumber } from "../utils";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { WORD_BYTES } from "../constants";

export class CODECOPYParser implements IOpcodeParser {
    parse({ memory, stack, opcode }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destination);
        exists(offset);
        exists(size);

        const offsetNumber = offset.knownNumber;
        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n);
        const bytecode = OpcodeCSV.tryToBytecode(opcode);

        if (bytecode !== undefined && offsetNumber !== undefined && sizeNumber !== undefined) {
            memory.storeHex(
                destination,
                sizeNumber,
                sliceHexBytes(bytecode, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber),
            );

            return false;
        }

        memory.store(
            destination,
            sizeNumber ?? WORD_BYTES,
            new EVMValue(`[CODECOPY(${offset}, ${size})]`, EVMValueTypes.CUSTOM),
        );

        return false;
    }
}
