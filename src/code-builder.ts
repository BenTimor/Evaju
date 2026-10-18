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
    constructor(type: "if" | "else if", body: string, condition: string)
    constructor(type: "else", body: string)
    constructor(private type: "if" | "else if" | "else", private body: string, private condition?: string) {
        super();
    }

    public stringifyInstruction(): string {
        const builder: string[] = [];

        if (this.condition) {
            builder.push(`${this.type} (${this.condition}) {`);
        }
        else {
            builder.push(`${this.type} {`);
        }
        builder.push(shiftMultilineText(this.body));
        builder.push("}");

        return builder.join("\n");
    }
}