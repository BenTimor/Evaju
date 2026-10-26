import { MAX_UINT256 } from "./constants";
import { assertBigInt, everyExists, exists } from "./type-utils";
import { normalizeUint256, toHex, toSignedUint256, unknownBaseStringToNumber } from "./utils";

export enum EVMValueTypes {
    NUMBER,
    EVMVALUE,
    COMPUTED_NUMBER,
    CUSTOM,
}

export type ConvertableValueTypes = number | string | boolean | bigint;

/**
 * A lazily computed number. It only resolves when every input value is a known
 * number; otherwise the value stays symbolic and keeps its description.
 */
export class ComputedNumber<T extends EVMValue = EVMValue> {
    constructor(private callback: (...args: T[]) => ConvertableValueTypes, private values: (T | undefined)[]) { }

    get computable(): boolean {
        return this.values.length > 0
            && this.values.every(value => value !== undefined && value.valueType === EVMValueTypes.NUMBER);
    }

    get computed(): ConvertableValueTypes {
        if (!this.computable) {
            throw new Error("ComputedNumber is not computable");
        }

        everyExists(this.values);

        return this.callback(...this.values);
    }
}

function toBigInt(val: ConvertableValueTypes): bigint {
    switch (typeof (val)) {
        case "bigint":
            return val;
        case "number":
            if (!Number.isInteger(val)) {
                throw new Error(`Value ${val} is not an integer and cannot be converted to an EVM value`);
            }
            return BigInt(val);
        case "string":
            return unknownBaseStringToNumber(val);
        case "boolean":
            return BigInt(Number(val));
        default:
            throw new Error(`Value of type ${typeof val} couldn't be converted to a number.`);
    }
}

/** A symbolic (unknown) number sentinel, used for values we cannot resolve. */
function unknownNumber(): ComputedNumber {
    return new ComputedNumber<EVMValue>(() => 0, [undefined]);
}

export class EVMValue {
    private numericValue: bigint | ComputedNumber;
    private descriptionValue: string;
    private valType: EVMValueTypes;

    constructor(val: EVMValue, valType: EVMValueTypes.EVMVALUE)
    constructor(val: string, valType: EVMValueTypes.CUSTOM)
    constructor(val: ConvertableValueTypes, valType: EVMValueTypes.NUMBER)
    constructor(val: ComputedNumber, valType: EVMValueTypes.COMPUTED_NUMBER, description: string)
    constructor(val: EVMValue | ConvertableValueTypes | ComputedNumber, valType: EVMValueTypes, description?: string) {
        this.valType = valType;

        if (valType === EVMValueTypes.CUSTOM) {
            if (typeof val !== "string") {
                throw new Error(`Custom EVM values must be created from a string, received ${typeof val}`);
            }

            this.numericValue = unknownNumber();
            this.descriptionValue = val;
            return;
        }

        if (val instanceof EVMValue) {
            this.numericValue = val.value;
            this.valType = val.valueType;
            this.descriptionValue = val.toString();
            return;
        }

        if (val instanceof ComputedNumber) {
            if (val.computable) {
                // Constant folding: a computable expression collapses into its result.
                const computed = normalizeUint256(toBigInt(val.computed));
                this.numericValue = computed;
                this.valType = EVMValueTypes.NUMBER;
                this.descriptionValue = toHex(computed);
                return;
            }

            exists(description);
            this.numericValue = val;
            this.valType = EVMValueTypes.COMPUTED_NUMBER;
            this.descriptionValue = description;
            return;
        }

        const numeric = normalizeUint256(toBigInt(val));
        this.numericValue = numeric;
        this.valType = valType === EVMValueTypes.EVMVALUE ? EVMValueTypes.EVMVALUE : EVMValueTypes.NUMBER;
        this.descriptionValue = toHex(numeric);
    }

    /**
     * Values are immutable, so cloning is a shallow field copy. This used to
     * rebuild the value from `valType`, which silently replaced every number
     * with `0x0` (breaking DUPn, `x + 0`, `x * 1`, ...).
     */
    public clone(): EVMValue {
        const clone = Object.create(EVMValue.prototype) as EVMValue;

        clone.numericValue = this.numericValue;
        clone.descriptionValue = this.descriptionValue;
        clone.valType = this.valType;

        return clone;
    }

    get value(): bigint | ComputedNumber {
        return this.numericValue;
    }

    get valueType(): EVMValueTypes {
        return this.valType;
    }

    /** The underlying number when it is known, `undefined` for symbolic values. */
    get knownNumber(): bigint | undefined {
        return typeof this.numericValue === "bigint" ? this.numericValue : undefined;
    }

    get isKnownNumber(): boolean {
        return typeof this.numericValue === "bigint";
    }

    get isZero(): boolean {
        return this.knownNumber === 0n;
    }

    toString(): string {
        return this.descriptionValue;
    }
}

export const validOperators = [
    "&&",
    "%",
    "&",
    "^",
    "|",
    "||",
    "+",
    "-",
    ">>",
    "<<",
    "*",
    "/",
    "==",
    ">",
    "<",
    ">=",
    "<=",
    "**",
    "!=",
    "slt",
    "sgt",
    "sdiv",
    "smod",
    "sar",
    "false",
] as const;

export type ValidOperator = typeof validOperators[number];

/** How each operator is rendered in the decompiled output. */
const operatorDisplay: Record<string, string> = {
    slt: "<",
    sgt: ">",
    sdiv: "/",
    smod: "%",
    sar: ">>",
};

type LogicCallback = (a: EVMValue, b: EVMValue) => ConvertableValueTypes;

type EVMValueCallback = (a: EVMValue, b: EVMValue) => EVMValue;

type OperatorLogicValueType = {
    callback: LogicCallback,
    type: "calculated",
} | {
    callback: EVMValueCallback,
    type: "value",
};

function multiOperatorsLogic<T extends string>(operators: T[], logic: (operator: T, a: EVMValue, b: EVMValue) => ConvertableValueTypes): Record<T, OperatorLogicValueType> {
    return Object.fromEntries(operators.map(operator => [operator, {
        type: "calculated",
        callback: (a: EVMValue, b: EVMValue) => logic(operator, a, b),
    }])) as unknown as Record<T, OperatorLogicValueType>;
}

function flatLogicInstruction(instruction: EVMValue, operator: ValidOperator): EVMValue[] {
    if (instruction instanceof EVMOperatorValue && instruction.operator === operator) {
        return [...flatLogicInstruction(instruction.a, operator), ...flatLogicInstruction(instruction.b, operator)];
    }

    return [instruction];
}

const reversedOperator = {
    ">": "<",
    "<": ">",
    ">=": "<=",
    "<=": ">=",
    "==": "==",
    "!=": "!=",
} as const;

function isComparisonOfNumber(instruction: EVMValue): instruction is EVMOperatorValue {
    return instruction instanceof EVMOperatorValue
        && instruction.operator in reversedOperator
        && (instruction.a.isKnownNumber !== instruction.b.isKnownNumber);
}

function knownNumberOrUndefined(value: EVMValue): bigint | undefined {
    return value.knownNumber;
}

function buildAndInstruction(instructions: EVMValue[], operator: ValidOperator): EVMValue {
    if (instructions.some(instruction => instruction.isZero)) {
        return new EVMOperatorValue("false");
    }

    let value: EVMValue | undefined;

    const required: Set<string> = new Set();
    const equalZero: Set<string> = new Set();

    // Simple `x == 0` requirements pulled out of the conjunction.
    for (const instruction of instructions) {
        if (
            instruction instanceof EVMOperatorValue
            && instruction.operator === "=="
            && (instruction.a.isZero || instruction.b.isZero)
        ) {
            const nonZero = instruction.a.isZero ? instruction.b : instruction.a;
            const nonZeroDesc = nonZero.toString();

            if (required.has(nonZeroDesc)) {
                // `x && !x` can never hold.
                return new EVMOperatorValue("false");
            }

            equalZero.add(nonZeroDesc);
        }
        else {
            if (equalZero.has(instruction.toString())) {
                return new EVMOperatorValue("false");
            }

            required.add(instruction.toString());
        }
    }

    const seen: Set<string> = new Set();

    // Operators / Seen
    for (const instruction of instructions) {
        const desc = instruction.toString();

        if (seen.has(desc)) {
            continue;
        }

        seen.add(desc);

        if (isComparisonOfNumber(instruction)) {
            const nonNumericInstruction = instruction.a.isKnownNumber ? instruction.b : instruction.a;
            const nonNumericDesc = nonNumericInstruction.toString();

            const normalizedInstructions = instructions
                .filter((inst): inst is EVMOperatorValue =>
                    inst instanceof EVMOperatorValue
                    && inst.operator in reversedOperator
                    && (
                        (inst.a.isKnownNumber && inst.b.toString() === nonNumericDesc)
                        || (inst.b.isKnownNumber && inst.a.toString() === nonNumericDesc)
                    )
                )
                .map(inst => {
                    const reversed = reversedOperator[inst.operator as keyof typeof reversedOperator];

                    return inst.a.isKnownNumber
                        ? { normalized: inst, original: inst }
                        : {
                            normalized: new EVMOperatorValue(reversed, inst.b, inst.a, false),
                            original: inst,
                        };
                });

            if (normalizedInstructions.length) {
                let isImpossible = false;

                const reducedInstruction = normalizedInstructions.reduce((
                    { original: oPrev, normalized: nPrev },
                    { original: oCurr, normalized: nCurr },
                ) => {
                    const { operator: prevOperator, a: prevA } = nPrev;
                    const { operator: currOperator, a: currA } = nCurr;

                    if (isImpossible) {
                        seen.add(oCurr.toString());
                        return { original: oCurr, normalized: nCurr };
                    }

                    const prevValue = knownNumberOrUndefined(prevA);
                    const currValue = knownNumberOrUndefined(currA);

                    if (prevValue === undefined || currValue === undefined) {
                        return { original: oPrev, normalized: nPrev };
                    }

                    // true for curr, false for prev
                    const logicMap = {
                        ">": {
                            ">": () => currValue < prevValue,
                            ">=": () => currValue < prevValue,
                            "<": () => {
                                isImpossible = currValue >= prevValue;
                            },
                            "<=": () => {
                                isImpossible = currValue >= prevValue;
                            },
                            "==": () => {
                                if (prevValue > currValue) {
                                    return true;
                                }

                                isImpossible = true;
                            },
                        },
                        ">=": {
                            ">": () => currValue <= prevValue,
                            ">=": () => currValue < prevValue,
                            "<": () => {
                                isImpossible = currValue >= prevValue;
                            },
                            "<=": () => {
                                isImpossible = currValue > prevValue;
                            },
                            "==": () => {
                                if (prevValue >= currValue) {
                                    return true;
                                }

                                isImpossible = true;
                            },
                        },
                        "<": {
                            "<": () => currValue > prevValue,
                            "<=": () => currValue > prevValue,
                            ">": () => {
                                isImpossible = prevValue >= currValue;
                            },
                            ">=": () => {
                                isImpossible = prevValue >= currValue;
                            },
                            "==": () => {
                                if (prevValue < currValue) {
                                    return true;
                                }

                                isImpossible = true;
                            },
                        },
                        "<=": {
                            "<": () => currValue >= prevValue,
                            "<=": () => currValue > prevValue,
                            ">": () => {
                                isImpossible = prevValue >= currValue;
                            },
                            ">=": () => {
                                isImpossible = prevValue > currValue;
                            },
                            "==": () => {
                                if (prevValue <= currValue) {
                                    return true;
                                }

                                isImpossible = true;
                            },
                        },
                        "==": {
                            ">": () => {
                                if (currValue > prevValue) {
                                    return false;
                                }

                                isImpossible = true;
                            },
                            "<": () => {
                                if (currValue < prevValue) {
                                    return false;
                                }

                                isImpossible = true;
                            },
                            ">=": () => {
                                if (currValue >= prevValue) {
                                    return false;
                                }

                                isImpossible = true;
                            },
                            "<=": () => {
                                if (currValue <= prevValue) {
                                    return false;
                                }

                                isImpossible = true;
                            },
                            "==": () => {
                                if (currValue === prevValue) {
                                    return false;
                                }

                                isImpossible = true;
                            },
                            "!=": () => {
                                if (currValue != prevValue) {
                                    return false;
                                }

                                isImpossible = false;
                            },
                        },
                        "!=": {
                            "==": () => {
                                if (currValue != prevValue) {
                                    return true;
                                }

                                isImpossible = false;
                            },
                        },
                    } as Record<string, Record<string, (() => boolean | void) | undefined>>;

                    const func = logicMap[prevOperator]?.[currOperator];

                    if (!func) {
                        return { original: oPrev, normalized: nPrev };
                    }

                    seen.add(oCurr.toString());

                    if (func()) {
                        return { original: oCurr, normalized: nCurr };
                    }

                    return { original: oPrev, normalized: nPrev };
                });

                if (isImpossible) {
                    console.warn("Impossibility found");
                }

                const _value = isImpossible ? new EVMValue(0, EVMValueTypes.NUMBER) : reducedInstruction.original;

                if (!value) {
                    value = _value;
                    continue;
                }

                value = new EVMOperatorValue(operator, value, _value, false);
                continue;
            }
        }

        if (!value) {
            value = instruction;
            continue;
        }

        value = new EVMOperatorValue(operator, value, instruction, false);
    }

    exists(value);

    return value;
}

function createOptimizedLogicInstruction(instructions: EVMValue[], operator: ValidOperator): EVMValue {
    const allFlattened = instructions.map(instruction => flatLogicInstruction(instruction, operator)).flat();

    return buildAndInstruction(allFlattened, operator);
}

function formatOperatorDescription(operator: ValidOperator, a: EVMValue, b: EVMValue): string {
    if (["&&", "&"].includes(operator)) {
        const flattenedA = flatLogicInstruction(a, operator);
        const flattenedB = flatLogicInstruction(b, operator);

        return `(${[...flattenedA, ...flattenedB].map(value => value.toString()).join(` ${operator} `)})`;
    }

    const display = operatorDisplay[operator] ?? operator;

    return `(${a} ${display} ${b})`;
}

const validOperatorsLogic: Record<ValidOperator, OperatorLogicValueType> = {
    ...multiOperatorsLogic(["%", "!=", "&&", "**", "/", "&", "|", "||", "+", "-", "*", "==", ">", "<", ">=", "<=", "false", "^", "slt", "sgt", "sdiv", "smod"], (operator, a, b) => {
        assertBigInt(a.value);
        assertBigInt(b.value);

        const left = a.value;
        const right = b.value;

        switch (operator) {
            case "%":
                return right === 0n ? 0n : left % right;
            case "!=":
                return left != right;
            case "&&":
                return left && right;
            case "||":
                return left || right;
            case "+":
                return normalizeUint256(left + right);
            case "-":
                return normalizeUint256(left - right);
            case "*":
                return normalizeUint256(left * right);
            case "==":
                return left === right;
            case ">":
                return left > right;
            case "<":
                return left < right;
            case "<=":
                return left <= right;
            case ">=":
                return left >= right;
            case "&":
                return left & right;
            case "^":
                return left ^ right;
            case "|":
                return left | right;
            case "/":
                return right === 0n ? 0n : left / right;
            case "**":
                // Guard against astronomically large exponents.
                return right > 4096n ? 0n : normalizeUint256(left ** right);
            case "false":
                return 0;
            case "slt":
                return toSignedUint256(left) < toSignedUint256(right);
            case "sgt":
                return toSignedUint256(left) > toSignedUint256(right);
            case "sdiv": {
                const signedRight = toSignedUint256(right);

                if (signedRight === 0n) {
                    return 0n;
                }

                const result = toSignedUint256(left) / signedRight;

                return normalizeUint256(result);
            }
            case "smod": {
                const signedRight = toSignedUint256(right);

                if (signedRight === 0n) {
                    return 0n;
                }

                const result = toSignedUint256(left) % signedRight;

                return normalizeUint256(result);
            }
            default:
                throw new Error(`Invalid operator ${operator}`);
        }
    }),
    ...multiOperatorsLogic(["<<", ">>", "sar"], (operator, a, b) => {
        assertBigInt(a.value);
        assertBigInt(b.value);

        // `a` is the value and `b` the shift amount, matching how the EVM pops them.
        const shift = b.value;

        if (operator === "sar") {
            if (shift >= 256n) {
                return toSignedUint256(a.value) < 0n ? MAX_UINT256 : 0n;
            }

            return normalizeUint256(toSignedUint256(a.value) >> shift);
        }

        if (shift >= 256n) {
            return 0n;
        }

        return operator === ">>" ? a.value >> shift : normalizeUint256(a.value << shift);
    }),
};

export class EVMOperatorValue extends EVMValue {
    private _operator: ValidOperator;
    private _a: EVMValue;
    private _b: EVMValue;

    constructor(operator: ValidOperator, a?: EVMValue, b?: EVMValue, optimize = true) {
        if (operator === "false") {
            super(0, EVMValueTypes.NUMBER);
            this._operator = "false";
            this._a = new EVMValue(0, EVMValueTypes.NUMBER);
            this._b = new EVMValue(0, EVMValueTypes.NUMBER);
            return;
        }

        exists(a);
        exists(b);

        if (optimize && ["&&", "&"].includes(operator)) {
            const optimizedInstruction = createOptimizedLogicInstruction([a, b], operator);

            if (optimizedInstruction instanceof EVMOperatorValue) {
                super(optimizedInstruction, EVMValueTypes.EVMVALUE);
                this._a = optimizedInstruction.a;
                this._b = optimizedInstruction.b;
                this._operator = optimizedInstruction.operator;
                return;
            }
        }

        if (optimize && operator === "==" && (a.isZero || b.isZero)) {
            const nonZero = a.isZero ? b : a;

            if (nonZero instanceof EVMOperatorValue && nonZero.operator === "==") {
                operator = "!=";
                a = nonZero.a;
                b = nonZero.b;
            }
        }

        const logic = validOperatorsLogic[operator];

        if (logic.type === "calculated") {
            const computed = new ComputedNumber((a, b) => logic.callback(a, b), [a, b]);

            super(computed, EVMValueTypes.COMPUTED_NUMBER, formatOperatorDescription(operator, a, b));
        }
        else {
            const val = logic.callback(a, b);

            super(val, EVMValueTypes.EVMVALUE);
        }

        this._operator = operator;
        this._a = a;
        this._b = b;
    }

    get operator(): ValidOperator {
        return this._operator;
    }

    get a(): EVMValue {
        return this._a;
    }

    get b(): EVMValue {
        return this._b;
    }

    public clone(): EVMOperatorValue {
        return new EVMOperatorValue(this.operator, this.a, this.b);
    }
}

