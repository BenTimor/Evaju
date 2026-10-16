import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class PUSHParser implements IOpcodeParser {
    constructor(private bytesToPush: number) { }

    parse(args: string[], { stack }: OpcodeParserParentContext): boolean {
        // TODO need to handle all kinds of PUSHs from 1 to 32?
        if (this.bytesToPush === 0) {
            stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
            return false;
        }

        exists(args[0]);
        stack.push(new EVMValue(args[0], EVMValueTypes.NUMBER));
        return false;
    }
}