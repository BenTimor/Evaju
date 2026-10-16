import { CompileTimeDefinitions, EVMValue, EVMValueTypes } from "../evm-value";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class CALLDATASIZEParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        stack.push(new EVMValue(CompileTimeDefinitions.CALLDATASIZE, EVMValueTypes.COMPILE_TIME_DEFINITION));

        return false;
    }
}