import { ADDRESS_MASK } from "../constants";
import { EVMOperatorValue, EVMValue, EVMValueTypes, ValidOperator } from "../evm-value";
import { exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

/** Operators where the EVM pops the shift amount first and the value second. */
const SHIFT_OPERATORS: ValidOperator[] = ["<<", ">>", "sar"];

export class GenericOperatorParser implements IOpcodeParser {
    constructor(private operator: ValidOperator) { }

    parse({ stack }: OpcodeParserParentContext): boolean {
        const first = stack.pop();
        const second = stack.pop();

        exists(first);
        exists(second);

        // EVM pops `shift` before the shifted value, but `(value << shift)` is the
        // readable (and correct) order, so normalize it here.
        const [a, b] = SHIFT_OPERATORS.includes(this.operator) ? [second, first] : [first, second];

        switch (this.operator) {
            case "&&":
            case "&": {
                if (a.toString() === b.toString()) {
                    stack.push(a);
                    return false;
                }

                if (this.operator === "&") {
                    // `x & 0xffff...ff` (the 160 bit address mask) is an address cast.
                    if (a.knownNumber === ADDRESS_MASK && b.valueType !== EVMValueTypes.NUMBER) {
                        stack.push(asAddress(b));
                        return false;
                    }

                    if (b.knownNumber === ADDRESS_MASK && a.valueType !== EVMValueTypes.NUMBER) {
                        stack.push(asAddress(a));
                        return false;
                    }
                }

                break;
            }
            case "+":
                if (a.isZero) {
                    stack.push(b.clone());
                    return false;
                }
                if (b.isZero) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "-":
                if (b.isZero) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "*":
                if (a.isZero || b.isZero) {
                    stack.push(new EVMValue(0, EVMValueTypes.NUMBER));
                    return false;
                }
                if (a.knownNumber === 1n) {
                    stack.push(b.clone());
                    return false;
                }
                if (b.knownNumber === 1n) {
                    stack.push(a.clone());
                    return false;
                }
                break;
            case "==":
                if (a.isZero || b.isZero) {
                    const nonZero = a.isZero ? b : a;

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

function asAddress(value: EVMValue): EVMValue {
    const description = value.toString();

    return description.startsWith("[ADDRESS(")
        ? value
        : new EVMValue(`[ADDRESS(${description})]`, EVMValueTypes.CUSTOM);
}
