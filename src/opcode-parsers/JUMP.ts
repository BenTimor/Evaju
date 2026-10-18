import { AbstractInstruction, CustomInstruction, IfStatementInstruction } from "../code-builder";
import { EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { getInstructionFromLine, lineBytes } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class JUMPParser implements IOpcodeParser {
    constructor(private jumpi: boolean) {}

    parse(_args: string[], {
        opcode,
        stack,
        linesByOffset,
        parentCallback,
        memory,
        codeBuilder,
        currentOffset,
        line,
    }: OpcodeParserParentContext): boolean {
        const counter = stack.pop();
        const b = this.jumpi ? stack.pop() : new EVMValue(1, EVMValueTypes.NUMBER);

        exists(b);
        exists(counter);

        const counterCode = () => {
            if (counter.valueType === EVMValueTypes.NUMBER) {
                assertBigInt(counter.value);
                // Theoretically there might be an issue here, but I think it's pretty save to ignore it right now.
                const lineWithOffset = linesByOffset[Number(counter.value)];

                if (lineWithOffset && getInstructionFromLine(lineWithOffset.line) === "JUMPDEST") {
                    return parentCallback(opcode, Number(counter.value), [ ...stack ], { ...memory });
                }
                else {
                    return [new CustomInstruction("// Revert by JUMP")];
                }
            }
            else {
                return [new CustomInstruction(`// JUMP to ${counter.description}`)];
            }
        };

        if (b.valueType === EVMValueTypes.NUMBER && b.value !== BigInt(1)) {
            codeBuilder.push(...counterCode());
        }
        else if (b.valueType !== EVMValueTypes.NUMBER) {
            codeBuilder.push(new IfStatementInstruction("if", counterCode(), b.description));
            codeBuilder.push(new IfStatementInstruction("else", parentCallback(opcode, currentOffset + lineBytes(line), [ ...stack ], { ...memory })));
        }
        else {
            return false;
        }

        return true;
    }
}