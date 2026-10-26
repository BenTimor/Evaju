import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { unknownBaseStringToNumber } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class PUSHParser implements IOpcodeParser {
    constructor(private bytesToPush: number) { }

    parse({ args, stack, codeBuilder }: OpcodeParserParentContext): boolean {
        if (this.bytesToPush === 0) {
            stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
            return false;
        }

        const immediate = args[0];

        if (immediate === undefined) {
            // Truncated listing: the missing immediate bytes read as zero.
            codeBuilder.push(new CustomInstruction(`// Warning: PUSH${this.bytesToPush} without an immediate was read as zero`));
            stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
            return false;
        }

        // Only the low `bytesToPush` bytes belong to this PUSH.
        const mask = (1n << BigInt(this.bytesToPush * 8)) - 1n;

        stack.push(new EVMValue(unknownBaseStringToNumber(immediate) & mask, EVMValueTypes.NUMBER));

        return false;
    }
}
