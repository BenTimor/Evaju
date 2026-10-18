import { EVMValue, EVMValueTypes } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SLOADParser implements IOpcodeParser {
    parse(_args: string[], { stack, storage }: OpcodeParserParentContext): boolean {
        const key = stack.pop();
        exists(key);

        const sValue = storage[key.key];

        if (sValue) {
            stack.push(sValue);
        }
        else {
            stack.push(new EVMValue(0, EVMValueTypes.NUMBER)); // TODO We might want to re-think this part
        }

        return false;
    }
}