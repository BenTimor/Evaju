import { CustomInstruction } from "../code-builder";
import { exists, everyExists } from "../type-utils";
import { toSafeNumber } from "../utils";
import { memoryText } from "./helpers";
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

        const offsetNumber = offset.knownNumber;
        const sizeNumber = toSafeNumber(size.knownNumber ?? -1n, 32n);
        const data = offsetNumber === undefined || sizeNumber === undefined
            ? undefined
            : memoryText(memory, offsetNumber, BigInt(sizeNumber));
        const topicsText = topics.length === 0 ? "none" : topics.join(", ");

        if (data === undefined) {
            codeBuilder.push(new CustomInstruction(`// [LOG${this.topicsAmount}] Mem: Unknown | Topics: ${topicsText}`));
            return false;
        }

        codeBuilder.push(new CustomInstruction(`// [LOG${this.topicsAmount}] Mem: ${data} | Topics: ${topicsText}`));

        return false;
    }
}
