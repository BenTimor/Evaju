import { EVMOperatorValue, ValidOperator } from "../evm-value";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class GenericOperatorParser implements IOpcodeParser {
    constructor(private operator: ValidOperator) {}

    parse(_args: string[], { stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();

        stack.push(new EVMOperatorValue(this.operator, a, b));

        return false;
    }
}