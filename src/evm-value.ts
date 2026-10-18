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
    private descriptionValue: string = "Unknown";

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

        if (val instanceof BigInt) {
            this.descriptionValue = `${val.toString()}`;
            this.numericValue = val;
            return;
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

        if (valType === EVMValueTypes.NUMBER) {
            this.descriptionValue = `${this.numericValue}`;
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
    "||",
    "+",
    "-",
    ">>",
    "<<",
    "*",
    "==",
    ">",
    "<",
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

function flatAndConditions(instruction: EVMValue): EVMValue[] {
    if (instruction instanceof EVMOperatorValue && instruction.operator === "&&") {
        return [...flatAndConditions(instruction.a), ...flatAndConditions(instruction.b)]
    }
    return [instruction];
}

function buildAndInstruction(instructions: EVMValue[]): EVMValue {
    const seen: Set<string> = new Set();
    let value: EVMValue | undefined;

    for (const instruction of instructions) {
        const desc = instruction.description;

        if (seen.has(desc)) {
            continue;
        }

        seen.add(desc);

        if (!value) {
            value = instruction;
            continue;
        }

        value = new EVMOperatorValue("&&", value, instruction);
    }

    exists(value);

    return value;
}

function optimizeAndInstruction(instruction: EVMValue): EVMValue {
    if (instruction instanceof EVMOperatorValue && instruction.operator === "&&") {
        return buildAndInstruction(flatAndConditions(instruction));
    }

    return instruction;
}

const validOperatorsLogic: Record<ValidOperator, OperatorLogicValueType> = {
    "&&": {
        type: "value",
        callback: (a: EVMValue, b: EVMValue) => {
            if (a.description === b.description) {
                return a;
            }

            const computed = new ComputedNumber((a, b) => {
                assertBigInt(a.value);
                assertBigInt(b.value);

                return a.value && b.value;
            }, [a, b]);

            return new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `(${a.description}) && (${b.description})`);
        },
    },
    ...multiOperatorsLogic(["||", "+", "-", "*", "==", ">", "<"], (operator, a, b) => {
        assertBigInt(a.value);
        assertBigInt(b.value);

        switch (operator) {
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

    constructor(operator: ValidOperator, a?: EVMValue, b?: EVMValue) {
        exists(a);
        exists(b);

        if (operator === "&&") {
            a = optimizeAndInstruction(a);
            b = optimizeAndInstruction(b);
        }

        const logic = validOperatorsLogic[operator];

        if (logic.type === "calculated") {
            const computed = new ComputedNumber((a, b) => logic.callback(a, b), [a, b]);

            super(computed, EVMValueTypes.COMPUTED_NUMBER, `(${a.description}) ${operator} (${b.description})`);
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