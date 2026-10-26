import { CustomInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { everyExists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

/**
 * Shared implementation for `CALL`, `CALLCODE`, `DELEGATECALL` and `STATICCALL`.
 * The callee is never executed, so the returned success flag stays symbolic.
 */
export class CallLikeParser implements IOpcodeParser {
    constructor(
        private name: string,
        private pops: number,
        private hasValue: boolean,
    ) { }

    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const args = new Array(this.pops).fill(0).map(() => stack.pop());

        everyExists(args);

        const [gas, address, ...rest] = args;
        const value = this.hasValue ? rest[0] : undefined;
        const details = value
            ? `to ${address} with value of ${value} and gas of ${gas}`
            : `to ${address} with gas of ${gas}`;

        codeBuilder.push(new CustomInstruction(`// ${this.name} ${details}`));

        stack.push(new EVMValue(`[SUCCESS_FOR_${this.name.toUpperCase()}(${address})]`, EVMValueTypes.CUSTOM));

        return false;
    }
}
