import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { toSafeNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class MCopyParser implements IOpcodeParser {
    parse({ stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        const offset = stack.pop();
        const size = stack.pop();

        exists(destination);
        exists(offset);
        exists(size);

        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n, 4096n);

        if (sizeNumber === undefined) {
            codeBuilder.push(new CustomInstruction(`// MCOPY with unknown size ${size}`));
            return false;
        }

        const read = memory.read(offset, sizeNumber);

        if (read?.kind === "known") {
            memory.storeHex(destination, sizeNumber, read.hex);
        }
        else if (read?.kind === "symbolic") {
            memory.store(destination, sizeNumber, read.value);
        }
        else {
            memory.store(destination, sizeNumber, new EVMValue(`[MCOPY(${offset}, ${size})]`, EVMValueTypes.CUSTOM));
        }

        return false;
    }
}
