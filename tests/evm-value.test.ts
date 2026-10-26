import { describe, expect, it } from "vitest";
import { ComputedNumber, EVMOperatorValue, EVMValue, EVMValueTypes } from "../src/evm-value";
import { ADDRESS_MASK, MAX_UINT256 } from "../src/constants";
import { GenericOperatorParser } from "../src/opcode-parsers/GenericOperator";
import { NOTParser } from "../src/opcode-parsers/NOT";
import { BYTEParser } from "../src/opcode-parsers/BYTE";
import { createContext } from "./helpers/context";

const number = (value: bigint | number | string) => new EVMValue(value, EVMValueTypes.NUMBER);
const symbolic = (description: string) => new EVMValue(description, EVMValueTypes.CUSTOM);

function apply(parser: { parse(context: ReturnType<typeof createContext>): boolean }, ...stack: EVMValue[]): EVMValue[] {
    const context = createContext({ stack: [...stack] });

    parser.parse(context);

    return context.stack;
}

describe("EVMValue", () => {
    it("formats numbers as byte aligned hex", () => {
        expect(number(0x60).toString()).toBe("0x60");
        expect(number(0x127).toString()).toBe("0x0127");
        expect(number("0x0000").valueType).toBe(EVMValueTypes.NUMBER);
        expect(number(0).knownNumber).toBe(0n);
        expect(number(0).isZero).toBe(true);
    });

    it("normalizes negative results into the uint256 range", () => {
        expect(number(-1n).toString()).toBe(`0x${"f".repeat(64)}`);
        expect(number(-1n).knownNumber).toBe(MAX_UINT256);
    });

    it("keeps symbolic values non numeric", () => {
        const custom = symbolic("[VALUE]");

        expect(custom.valueType).toBe(EVMValueTypes.CUSTOM);
        expect(custom.knownNumber).toBeUndefined();
        expect(custom.isZero).toBe(false);
        expect(custom.toString()).toBe("[VALUE]");
    });

    it("clones without losing the value (regression: clone used to return 0x0)", () => {
        const original = number(0x60);
        const clone = original.clone();

        expect(clone).not.toBe(original);
        expect(clone.knownNumber).toBe(0x60n);
        expect(clone.toString()).toBe("0x60");
        expect(clone.valueType).toBe(EVMValueTypes.NUMBER);
    });

    it("clones symbolic and operator values", () => {
        const custom = symbolic("[STORAGE[0x00]]");
        const customClone = custom.clone();

        expect(customClone.toString()).toBe("[STORAGE[0x00]]");
        expect(customClone.knownNumber).toBeUndefined();

        const operator = new EVMOperatorValue("+", symbolic("[A]"), symbolic("[B]"));
        const operatorClone = operator.clone();

        expect(operatorClone).toBeInstanceOf(EVMOperatorValue);
        expect(operatorClone.toString()).toBe(operator.toString());
    });

    it("folds computable expressions and keeps symbolic ones", () => {
        const folded = new EVMValue(new ComputedNumber(value => {
            if (value.knownNumber === undefined) {
                throw new Error("unreachable");
            }

            return value.knownNumber + 1n;
        }, [number(0x10)]), EVMValueTypes.COMPUTED_NUMBER, "should be replaced");

        expect(folded.valueType).toBe(EVMValueTypes.NUMBER);
        expect(folded.knownNumber).toBe(0x11n);
        expect(folded.toString()).toBe("0x11");

        const symbolicValue = symbolic("[X]");
        const pending = new EVMValue(new ComputedNumber<EVMValue>(() => 0n, [symbolicValue]), EVMValueTypes.COMPUTED_NUMBER, "[X + 1]");

        expect(pending.valueType).toBe(EVMValueTypes.COMPUTED_NUMBER);
        expect(pending.knownNumber).toBeUndefined();
        expect(pending.toString()).toBe("[X + 1]");
    });

    it("reports whether a computed number can be resolved", () => {
        expect(new ComputedNumber<EVMValue>(() => 1n, [number(1)]).computable).toBe(true);
        expect(new ComputedNumber<EVMValue>(() => 1n, [undefined]).computable).toBe(false);
        expect(new ComputedNumber<EVMValue>(() => 1n, []).computable).toBe(false);
        expect(() => new ComputedNumber<EVMValue>(() => 1n, [undefined]).computed).toThrow(/not computable/i);
        expect(new ComputedNumber<EVMValue>(() => 42n, [number(1)]).computed).toBe(42n);
    });
});

describe("operator semantics", () => {
    it("constant folds binary operators", () => {
        expect(new EVMOperatorValue("+", number(1), number(2)).knownNumber).toBe(3n);
        expect(new EVMOperatorValue("-", number(0), number(1)).knownNumber).toBe(MAX_UINT256);
        expect(new EVMOperatorValue("*", number(3), number(4)).knownNumber).toBe(12n);
        expect(new EVMOperatorValue("/", number(7), number(2)).knownNumber).toBe(3n);
        expect(new EVMOperatorValue("/", number(7), number(0)).knownNumber).toBe(0n);
        expect(new EVMOperatorValue("%", number(7), number(0)).knownNumber).toBe(0n);
        expect(new EVMOperatorValue("&", number(0xf0), number(0x3c)).knownNumber).toBe(0x30n);
        expect(new EVMOperatorValue("^", number(0xf0), number(0x3c)).knownNumber).toBe(0xccn);
        expect(new EVMOperatorValue("|", number(0xf0), number(0x0c)).knownNumber).toBe(0xfcn);
        expect(new EVMOperatorValue("**", number(2), number(8)).knownNumber).toBe(256n);
    });

    it("guards against huge exponents", () => {
        expect(new EVMOperatorValue("**", number(2), number(5000)).knownNumber).toBe(0n);
        expect(new EVMOperatorValue("**", number(2), number(256)).knownNumber).toBe(0n);
    });

    it("implements signed operators", () => {
        const minusOne = number(MAX_UINT256);

        expect(new EVMOperatorValue("slt", minusOne, number(1)).knownNumber).toBe(1n);
        expect(new EVMOperatorValue("sgt", number(1), minusOne).knownNumber).toBe(1n);
        expect(new EVMOperatorValue("sdiv", number(MAX_UINT256), number(2)).knownNumber).toBe(0n);
        expect(new EVMOperatorValue("smod", number(MAX_UINT256), number(2)).knownNumber).toBe(MAX_UINT256);
        expect(new EVMOperatorValue("sar", number(MAX_UINT256), number(1)).knownNumber).toBe(MAX_UINT256);
        expect(new EVMOperatorValue("sar", number(1), number(500)).knownNumber).toBe(0n);
        expect(new EVMOperatorValue("sar", number(MAX_UINT256), number(500)).knownNumber).toBe(MAX_UINT256);
    });

    it("implements shifts as value shifted by amount", () => {
        expect(new EVMOperatorValue("<<", number(1), number(4)).knownNumber).toBe(0x10n);
        expect(new EVMOperatorValue(">>", number(0x10), number(4)).knownNumber).toBe(0x1n);
        expect(new EVMOperatorValue(">>", number(MAX_UINT256), number(4)).knownNumber).toBe(MAX_UINT256 >> 4n);
        expect(new EVMOperatorValue("<<", number(1), number(300)).knownNumber).toBe(0n);
    });

    it("describes symbolic operators", () => {
        expect(new EVMOperatorValue("+", symbolic("[A]"), symbolic("[B]")).toString()).toBe("([A] + [B])");
        expect(new EVMOperatorValue("slt", symbolic("[A]"), symbolic("[B]")).toString()).toBe("([A] < [B])");
        expect(new EVMOperatorValue("sar", symbolic("[A]"), symbolic("[B]")).toString()).toBe("([A] >> [B])");
    });

    it("simplifies an equality with zero of an equality into an inequality", () => {
        const comparison = new EVMOperatorValue("==", symbolic("[A]"), symbolic("[B]"));
        const negated = new EVMOperatorValue("==", number(0), comparison);

        expect(negated.toString()).toBe("([A] != [B])");
    });
});

describe("GenericOperatorParser", () => {
    it("keeps operand values when simplifying x + 0 and 0 + x", () => {
        const plus = new GenericOperatorParser("+");
        const [left, right] = [
            apply(plus, number(0x60), number(0))[0]!,
            apply(plus, number(0), number(0x60))[0]!,
        ];

        expect(left?.knownNumber).toBe(0x60n);
        expect(right?.knownNumber).toBe(0x60n);
    });

    it("keeps operand values when simplifying x * 1 and x * 0", () => {
        const mul = new GenericOperatorParser("*");

        expect(apply(mul, number(0x60), number(1))[0]?.knownNumber).toBe(0x60n);
        expect(apply(mul, number(1), number(0x60))[0]?.knownNumber).toBe(0x60n);
        expect(apply(mul, number(0x60), number(0))[0]?.knownNumber).toBe(0n);
    });

    it("swaps shift operands into readable order", () => {
        // EVM pops the shift amount first, so the stack is [value, shift].
        const shl = new GenericOperatorParser("<<");
        const result = apply(shl, symbolic("[X]"), number(4))[0]!;

        expect(result.toString()).toBe("([X] << 0x04)");
    });

    it("detects the 160 bit address mask", () => {
        const and = new GenericOperatorParser("&");
        const result = apply(and, symbolic("[CALLER]"), number(ADDRESS_MASK))[0]!;

        expect(result.toString()).toBe("[ADDRESS([CALLER])]");
    });

    it("ignores masks that are not the address mask", () => {
        const and = new GenericOperatorParser("&");
        const result = apply(and, symbolic("[X]"), number(0xff))[0]!;

        expect(result.toString()).toBe("(0xff & [X])");
    });

    it("does not double wrap address casts", () => {
        const and = new GenericOperatorParser("&");
        const once = apply(and, symbolic("[CALLER]"), number(ADDRESS_MASK))[0]!;
        const twice = apply(and, once, number(ADDRESS_MASK))[0]!;

        expect(twice.toString()).toBe("[ADDRESS([CALLER])]");
    });

    it("turns = 0 of a comparison into the negated comparison", () => {
        const eq = new GenericOperatorParser("==");
        const comparison = new EVMOperatorValue("<", symbolic("[A]"), symbolic("[B]"));
        const result = apply(eq, comparison, number(0))[0]!;

        expect(result.toString()).toBe("([A] >= [B])");
    });
});

describe("unary parsers", () => {
    it("masks NOT to 256 bits", () => {
        const result = apply(new NOTParser(), number(0))[0]!;

        expect(result.knownNumber).toBe(MAX_UINT256);
        expect(result.toString()).toBe(`0x${"f".repeat(64)}`);
    });

    it("extracts BYTE from the most significant end", () => {
        const word = number(0xdeadbeefn << 224n);

        expect(apply(new BYTEParser(), word, number(0))[0]?.knownNumber).toBe(0xden);
        expect(apply(new BYTEParser(), word, number(3))[0]?.knownNumber).toBe(0xefn);
        expect(apply(new BYTEParser(), word, number(32))[0]?.knownNumber).toBe(0n);
    });
});
