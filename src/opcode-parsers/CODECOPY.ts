import type { IOpcodeParser, OpcodeParserParentContext } from "./base";
import { OpcodeCSV } from "../opcodes";
import { exists } from "../type-utils";
import { readHexBytes, toSafeNumber } from "../utils";
import { knownOrSymbolic } from "./helpers";

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
        const value = bytecode !== undefined && offsetNumber !== undefined && sizeNumber !== undefined
            ? readHexBytes(bytecode, toSafeNumber(offsetNumber) ?? Number.MAX_SAFE_INTEGER, sizeNumber)
            : undefined;

        memory[`${destination}`] = knownOrSymbolic(value, `[CODECOPY(${offset}, ${size})]`);

        return false;
    }
}
