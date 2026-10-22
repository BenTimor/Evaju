import { EVMOperatorValue, EVMValue, EVMValueTypes, ValidOperator } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class GenericOperatorParser implements IOpcodeParser {
    constructor(private operator: ValidOperator) { }

    parse({ stack }: OpcodeParserParentContext): boolean {
        const a = stack.pop();
        const b = stack.pop();

        exists(a);
        exists(b);

        switch (this.operator) {
            case "&&":
                if (a.toString() === b.toString()) {
                    stack.push(a);
                    return false;
                }
                break;
            case "&":
                if (a.toString() === b.toString()) {
                    stack.push(a);
                    return false;
                }

                if (a.value === 1461501637330902918203684832716283019655932542975n && b.valueType !== EVMValueTypes.NUMBER) {
                    if (b.toString().startsWith("[ADDRESS(")) {
                        stack.push(b);
                        return false;
                    }
                    stack.push(new EVMValue(`[ADDRESS(${b})]`, EVMValueTypes.CUSTOM));
                    return false;
                }

                if (b.value === 1461501637330902918203684832716283019655932542975n && a.valueType !== EVMValueTypes.NUMBER) {
                    if (a.toString().startsWith("[ADDRESS(")) {
                        stack.push(a);
                        return false;
                    }
                    stack.push(new EVMValue(`[ADDRESS(${a})]`, EVMValueTypes.CUSTOM));
                    return false;
                }
                break;
            case "+":
                if (a.value === 0n) {
                    stack.push(b.clone());
                    return false;
                }
                if (b.value === 0n) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "-":
                if (b.value === 0n) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "*":
                if (a.value === 0n || b.value === 0n) {
                    stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
                    return false;
                }
                if (a.value === 1n) {
                    stack.push(b.clone());
                    return false;
                }
                if (b.value === 1n) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "==":
                if (a.value === 0n || b.value === 0n) {
                    const nonZero = a.value === 0n ? b : a;

                    if (nonZero instanceof EVMOperatorValue) {
                        if (nonZero.operator === "<") {
                            stack.push(new EVMOperatorValue(">=", nonZero.a, nonZero.b));
                            return false;
                        }
                        if (nonZero.operator === ">") {
                            stack.push(new EVMOperatorValue("<=", nonZero.a, nonZero.b));
                            return false;
                        }
                        if (nonZero.operator === "==") {
                            stack.push(new EVMOperatorValue("!=", nonZero.a, nonZero.b));
                            return false;
                        }
                    }
                }
                break;
            default:
                break;
        }

        stack.push(new EVMOperatorValue(this.operator, a, b));

        return false;
    }
}