import { CustomInstruction } from "../code-builder";
import { exists } from "../type-utils";
import { toSafeNumber } from "../utils";
import { memoryText } from "./helpers";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class REVERTParser implements IOpcodeParser {
    parse({ stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const offsetNumber = offset.knownNumber;
        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n);
        const data = offsetNumber === undefined || sizeNumber === undefined
            ? undefined
            : memoryText(memory, offsetNumber, BigInt(sizeNumber));

        if (data === undefined) {
            codeBuilder.push(new CustomInstruction("// [REVERT] Revert: Unknown"));
            return true;
        }

        codeBuilder.push(new CustomInstruction(`// [REVERT] Revert: ${data}`));

        return true;
    }
}
