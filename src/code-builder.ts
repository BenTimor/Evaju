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

/** Joins a branch body, dropping the empty entries produced by no-op instructions. */
export function stringifyBody(body: AbstractInstruction[]): string {
    return body
        .map(instruction => instruction.stringifyInstruction())
        .filter(text => text.trim().length > 0)
        .join("\n");
}

export class IfStatementInstruction extends AbstractInstruction {
    /** Rendering is pure, so the text is worth caching: branch bodies are shared. */
    private rendered: string | undefined;

    constructor(private _conditions: EVMValue[], private _bodies: AbstractInstruction[][]) {
        super();
    }

    public stringifyInstruction(): string {
        // Without this cache the renderer is exponential: a body that is reused by
        // several branches would be expanded again for each of them.
        if (this.rendered !== undefined) {
            return this.rendered;
        }

        const builder: string[] = [];
        const seenConditions = new Set<string>();
        let emittedBranches = 0;

        for (let bodyIndex = 0; bodyIndex < this._bodies.length; bodyIndex++) {
            const body = this._bodies[bodyIndex];
            exists(body);

            const condition = this._conditions[bodyIndex];

            if (!condition) {
                // The trailing body is the `else` branch. `else { if (...) ... }`
                // reads much better as an `else if` chain, so inline it.
                const nestedIf = body.length === 1 && body[0] instanceof IfStatementInstruction
                    ? body[0].stringifyInstruction()
                    : undefined;
                const bodyText = nestedIf ?? stringifyBody(body);

                if (bodyText.length > 0) {
                    if (nestedIf !== undefined && nestedIf.startsWith("if ")) {
                        builder.push(`else ${nestedIf}`);
                    }
                    else {
                        builder.push("else {", shiftMultilineText(bodyText), "}");
                    }
                }

                continue;
            }

            const conditionText = condition.toString();

            // A branch that repeats an earlier condition can never be reached.
            if (seenConditions.has(conditionText)) {
                continue;
            }

            seenConditions.add(conditionText);

            const bodyText = stringifyBody(body);

            builder.push(`${emittedBranches === 0 ? "if" : "else if"} ${conditionText} {`);

            if (bodyText.length > 0) {
                builder.push(shiftMultilineText(bodyText));
            }
            else {
                builder.push(shiftMultilineText("// (branch ends here)"));
            }

            builder.push("}");
            emittedBranches++;
        }

        this.rendered = builder.join("\n");

        return this.rendered;
    }

    get conditions(): EVMValue[] {
        return this._conditions;
    }

    get bodies(): AbstractInstruction[][] {
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
        return stringifyBody(this.bodyByIndex(index));
    }
}
