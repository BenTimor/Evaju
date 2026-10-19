import { assertBigInt, everyExists, exists } from "./type-utils";
import { unknownBaseStringToNumber } from "./utils";

export enum EVMValueTypes {
    NUMBER,
    EVMVALUE,
    COMPUTED_NUMBER,
}

export type ConvertableValueTypes = number | string | boolean | BigInt;

export class ComputedNumber<T extends EVMValue> {
    constructor(private callback: (...args: T[]) => ConvertableValueTypes, private values: (T | undefined)[]) { }

    get computable() {
        return this.values.every(v => v?.valueType === EVMValueTypes.NUMBER);
    }

    get computed() {
        if (!this.computable) {
            throw new Error("ComputedNumber is not computable");
        }

        everyExists(this.values);
        return this.callback(...this.values);
    }
}

export class EVMValue {
    private numericValue: BigInt | ComputedNumber<any>;
    private descriptionValue: string = "[UnknownValue]";

    constructor(val: EVMValue, valType: EVMValueTypes.EVMVALUE)
    constructor(val: number, valType: EVMValueTypes.NUMBER)
    constructor(val: string, valType: EVMValueTypes.NUMBER)
    constructor(val: boolean, valType: EVMValueTypes.NUMBER)
    constructor(val: ComputedNumber<any>, valType: EVMValueTypes.COMPUTED_NUMBER, description: string)
    constructor(val: EVMValue | ConvertableValueTypes | ComputedNumber<any>, private valType: number, _description?: string) {
        if (val instanceof EVMValue) {
            this.numericValue = val.value;
            this.valType = val.valType;
            this.descriptionValue = val.description;
            return;
        }

        if (val instanceof ComputedNumber) {
            if (val.computable) {
                // We just compute it and let the switch take care of converting everything
                val = val.computed;
                this.valType = EVMValueTypes.NUMBER;
            }
            else {
                // If we cannot compute a computed number - It should stay as it is (If we continue to the switch, it'll throw an error)
                this.numericValue = val;

                exists(_description);

                this.descriptionValue = _description;
                return;
            }
        }

        switch (typeof (val)) {
            case "bigint":
                this.numericValue = val;
                break;
            case "number":
                this.numericValue = BigInt(val);
                break;
            case "string":
                this.numericValue = unknownBaseStringToNumber(val);
                break;
            case "boolean":
                this.numericValue = BigInt(Number(val));
                break;
            default:
                throw new Error(`Value of val ${val} couldn't be converted to a number.`);
        }

        if (this.valType === EVMValueTypes.NUMBER) {
            this.descriptionValue = `0x${this.numericValue.toString(16)}`;
        }
    }

    public clone() {
        if (this.value instanceof ComputedNumber) {
            return new EVMValue(this.value, this.valueType, this.description);
        }
        else {
            return new EVMValue(this.valType, this.valType);
        }
    }

    get value(): BigInt | ComputedNumber<any> {
        return this.numericValue;
    }

    get valueType() {
        return this.valType;
    }

    // TODO Get back to this function as I'm not sure it's the best way to handle it
    get key() {
        return JSON.stringify(this, (_, value) => {
            if (value instanceof BigInt) {
                return value.toString();
            }
        });
    }

    get description(): string {
        return this.descriptionValue;
    }
}

export const validOperators = [
    "&&",
    "&",
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
] as const;

export type ValidOperator = typeof validOperators[number];

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
        type: "calculated", callback: (a: EVMValue, b: EVMValue) => {
            return logic(operator, a, b);
        }
    }])) as unknown as Record<T, OperatorLogicValueType>
}

function flatLogicInstruction(instruction: EVMValue, operator: ValidOperator): EVMValue[] {
    if (instruction instanceof EVMOperatorValue && instruction.operator === operator) {
        return [...flatLogicInstruction(instruction.a, operator), ...flatLogicInstruction(instruction.b, operator)]
    }
    return [instruction];
}

const reversedOperator = {
    ">": "<",
    "<": ">",
    ">=": "<=",
    "<=": ">=",
} as const;

function buildLogicInstruction(instructions: EVMValue[], operator: ValidOperator): EVMValue {
    const seen: Set<string> = new Set();
    let value: EVMValue | undefined;

    for (const instruction of instructions) {
        const desc = instruction.description;

        if (seen.has(desc)) {
            continue;
        }

        seen.add(desc);

        if (instruction instanceof EVMOperatorValue && (instruction.a.valueType === EVMValueTypes.NUMBER || instruction.b.valueType === EVMValueTypes.NUMBER)) {
            const nonNumericDesc = instruction.a.valueType === EVMValueTypes.NUMBER ? instruction.b.description : instruction.a.description;

            const normalizedInstructions = ([instruction, ...instructions].filter(inst =>
                inst instanceof EVMOperatorValue
                && inst.operator in reversedOperator
                && (
                    (inst.a.valueType === EVMValueTypes.NUMBER && inst.b.description === nonNumericDesc)
                    || (inst.b.valueType === EVMValueTypes.NUMBER && inst.a.description === nonNumericDesc)
                )
            ) as EVMOperatorValue[]).map(inst => {
                const instOperator = inst.operator;

                const reversed = reversedOperator[instOperator as keyof typeof reversedOperator];

                return inst.a.valueType === EVMValueTypes.NUMBER ?
                    {
                        normalized: inst,
                        original: inst,
                    } :
                    {
                        normalized: new EVMOperatorValue(reversed, inst.b, inst.a, false),
                        original: inst,
                    };
            });

            if (normalizedInstructions.length) {
                const reducedInstruction = normalizedInstructions.reduce((
                    { original: oPrev, normalized: nPrev },
                    { original: oCurr, normalized: nCurr }
                ) => {
                    const { operator: prevOperator, a: prevA } = nPrev;
                    const { operator: currOperator, a: currA } = nCurr;

                    // true for curr, false for prev
                    const logicMap = {
                        ">": {
                            // prevA > b && currA > b
                            ">": () => currA.value < prevA.value,
                            // prevA > b && currA >= b
                            ">=": () => currA.value < prevA.value,
                        },
                        ">=": {
                            // prevA >= b && currA > b
                            ">": () => currA.value <= prevA.value,
                            // prevA >= b && currA >= b
                            ">=": () => currA.value < prevA.value,
                        },
                        "<": {
                            // prevA < b && currA < b
                            "<": () => currA.value > prevA.value,
                            // prevA < b && currA <= b
                            "<=": () => currA.value > prevA.value,
                        },
                        "<=": {
                            // prevA <= b && currA < b
                            "<": () => currA.value >= prevA.value,
                            // prevA <= b && currA <= b
                            "<=": () => currA.value > prevA.value,
                        }
                    } as const;

                    const func = (logicMap as any /* TODO fix fucking typescript */)[prevOperator][currOperator];

                    if (!func) {
                        return {
                            original: oPrev,
                            normalized: nPrev,
                        };
                    }

                    seen.add(oCurr.description);

                    if (func()) {
                        return {
                            original: oCurr,
                            normalized: nCurr,
                        };
                    }

                    return {
                        original: oPrev,
                        normalized: nPrev,
                    };
                });

                if (!value) {
                    value = reducedInstruction.original;
                    continue;
                }

                value = new EVMOperatorValue(operator, value, reducedInstruction.original, false);
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
    return buildLogicInstruction(allFlattened, operator);
}

function formatOperatorDescription(operator: ValidOperator, a: EVMValue, b: EVMValue) {
    return `(${a.description} ${operator} ${b.description})`;
    // return `(\n${shiftMultilineText(a.description)}\n${shiftMultilineText(operator)}\n${shiftMultilineText(b.description)}\n)`;
}

const validOperatorsLogic: Record<ValidOperator, OperatorLogicValueType> = {
    ...multiOperatorsLogic(["&&", "**", "/", "&", "|", "||", "+", "-", "*", "==", ">", "<", ">=", "<="], (operator, a, b) => {
        assertBigInt(a.value);
        assertBigInt(b.value);

        switch (operator) {
            case "&&":
                return a.value && b.value;
            case "||":
                return a.value || b.value;
            case "+":
                return a.value + b.value;
            case "-":
                return a.value - b.value;
            case "*":
                return a.value * b.value;
            case "==":
                return a.value === b.value;
            case ">":
                return a.value > b.value;
            case "<":
                return a.value < b.value;
            case "<=":
                return a.value <= b.value;
            case ">=":
                return a.value >= b.value;
            case "&":
                return a.value & b.value;
            case "|":
                return a.value | b.value;
            case "/":
                return b.value === 0n ? 0n : a.value / b.value;
            case "**":
                return a.value ** b.value;
            default:
                throw new Error(`Invalid operator ${operator}`);
        }
    }),
    ...multiOperatorsLogic(["<<", ">>"], (operator, a, b) => {
        assertBigInt(a.value);
        assertBigInt(b.value);

        if (BigInt(a.value) >= 256n) {
            return 0n;
        }

        const mask256 = (1n << 256n) - 1n;
        const cleanValue = b.value & mask256;

        return operator === ">>" ? cleanValue >> BigInt(a.value) : cleanValue << BigInt(a.value);
    }),
}

export class EVMOperatorValue extends EVMValue {
    private _operator: ValidOperator;
    private _a: EVMValue;
    private _b: EVMValue;

    constructor(operator: ValidOperator, a?: EVMValue, b?: EVMValue, optimize = true) {
        exists(a);
        exists(b);

        if (optimize && ["&&", "&", "|"].includes(operator)) {
            const optimizedInstruction = createOptimizedLogicInstruction([a, b], operator);

            // I have no idea right now how to handle the case where optimizedInstruction returns a non operator value
            if (optimizedInstruction instanceof EVMOperatorValue) {
                super(optimizedInstruction, EVMValueTypes.EVMVALUE);
                this._a = optimizedInstruction.a;
                this._b = optimizedInstruction.b;
                this._operator = optimizedInstruction.operator;
                return;
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

    get operator() {
        return this._operator;
    }

    get a() {
        return this._a;
    }

    get b() {
        return this._b;
    }
}