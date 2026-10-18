import { EVMValue, EVMValueTypes } from "../evm-value";
import { OpcodeParserParentContext } from "./base";
import { GenericOperatorParser } from "./GenericOperator";

export class ISZEROParser extends GenericOperatorParser {
    constructor() {
        super("==");
    }

    parse(_args: string[], context: OpcodeParserParentContext): boolean {
        context.stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
        return super.parse(_args, context);
    }
}