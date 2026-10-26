import { EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class RETURNDATASIZEParser implements IOpcodeParser {
    parse({ stack }: OpcodeParserParentContext): boolean {
        // The size depends on the callee we do not execute, so it stays symbolic.
        stack.push(new EVMValue("[RETURNDATASIZE]", EVMValueTypes.CUSTOM));

        return false;
    }
}
