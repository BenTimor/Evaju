import { CustomInstruction } from "../code-builder";
import { exists } from "../type-utils";
import { toSafeNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class RETURNParser implements IOpcodeParser {
    parse({ stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n, 4096n);
        const read = sizeNumber === undefined ? undefined : memory.read(offset, sizeNumber);
        const data = read?.kind === "known"
            ? `0x${read.hex}`
            : read?.kind === "symbolic" ? read.value.toString() : undefined;

        codeBuilder.push(new CustomInstruction(data === undefined
            ? "// [RETURN] Return: Unknown"
            : `// [RETURN] Return: ${data}`));

        return true;
    }
}
