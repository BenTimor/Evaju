import { CustomInstruction } from "../code-builder";
import { exists, everyExists } from "../type-utils";
import { toSafeNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class LOGParser implements IOpcodeParser {
    constructor(private topicsAmount: number) { }

    parse({ stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();
        const topics = new Array(this.topicsAmount).fill(0).map(() => stack.pop());

        exists(offset);
        exists(size);
        everyExists(topics);

        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n, 4096n);
        const read = sizeNumber === undefined ? undefined : memory.read(offset, sizeNumber);
        const topicsText = topics.length === 0 ? "none" : topics.join(", ");
        const data = read?.kind === "known"
            ? `0x${read.hex}`
            : read?.kind === "symbolic" ? read.value.toString() : undefined;

        codeBuilder.push(new CustomInstruction(data === undefined
            ? `// [LOG${this.topicsAmount}] Mem: Unknown | Topics: ${topicsText}`
            : `// [LOG${this.topicsAmount}] Mem: ${data} | Topics: ${topicsText}`));

        return false;
    }
}
