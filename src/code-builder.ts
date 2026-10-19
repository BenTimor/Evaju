import { EVMValue } from "./evm-value";
import { exists } from "./type-utils";
import { shiftMultilineText } from "./utils";

export abstract class AbstractInstruction {
    toString(): string {
        return this.stringifyInstruction();
    }

    public abstract stringifyInstruction(): string;
}

export class CustomInstruction extends AbstractInstruction {
    constructor(private customCode: string) {
        super();
    }

    public stringifyInstruction(): string {
        return this.customCode;
    }
}

export class IfStatementInstruction extends AbstractInstruction {
    constructor(private _conditions: EVMValue[], private _bodies: AbstractInstruction[][]) {
        super();
    }

    public stringifyInstruction(): string {
        const builder: string[] = [];

        for (const bodyIndex in this._bodies) {
            const body = this._bodies[bodyIndex];
            const condition = this._conditions[bodyIndex];
            exists(body);

            if (condition) {
                builder.push(`${+bodyIndex === 0 ? "if" : "else if"} ${condition.description} {`);
                builder.push(shiftMultilineText(body.join("\n")));
                builder.push(shiftMultilineText("// Stop program (by if)"));
                builder.push("}");
            }
            else {
                builder.push(body.join("\n"));
            }
        }

        return builder.join("\n");
    }

    get conditions() {
        return this._conditions;
    }

    get bodies() {
        return this._bodies;
    }

    public conditionByIndex(index: number) {
        const condition = this._conditions.at(index);
        exists(condition);

        return condition;
    }

    public bodyByIndex(index: number): AbstractInstruction[] {
        const body = this._bodies.at(index);
        exists(body);

        return body;
    }

    public stringifiedBodyByIndex(index: number): string {
        return this.bodyByIndex(index).join("\n");
    }
}