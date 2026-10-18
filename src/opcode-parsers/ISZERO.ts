import { EVMOperatorValue, EVMValue, EVMValueTypes } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class ISZEROParser implements IOpcodeParser {
    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();

        stack.push(new EVMOperatorValue("==", a, new EVMValue(0, EVMValueTypes.NUMBER)));

        return false;
    }
}