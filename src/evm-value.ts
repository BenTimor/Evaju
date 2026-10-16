import { assertNumber, everyExists, exists } from "./type-utils";
import { unknownBaseStringToNumber } from "./utils";

export enum CompileTimeDefinitions {
    CALLDATASIZE,
}

export enum EVMValueTypes {
    NUMBER,
    COMPILE_TIME_DEFINITION,
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

    constructor(val: number, valType: EVMValueTypes.NUMBER)
    constructor(val: string, valType: EVMValueTypes.NUMBER)
    constructor(val: boolean, valType: EVMValueTypes.NUMBER)
    constructor(val: CompileTimeDefinitions, valType: EVMValueTypes.COMPILE_TIME_DEFINITION)
    constructor(val: ComputedNumber<any>, valType: EVMValueTypes.COMPUTED_NUMBER, description: string)
    constructor(val: ConvertableValueTypes | ComputedNumber<any>, private valType: number, _description?: string) {
        if (valType === EVMValueTypes.COMPILE_TIME_DEFINITION) {
            assertNumber(val);

            _description = CompileTimeDefinitions[val];
            exists(_description);

            this.descriptionValue = _description;
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