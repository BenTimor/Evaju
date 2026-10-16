import { EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { getInstructionFromLine, lineBytes, shiftMultilineText } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class JUMPIParser implements IOpcodeParser {
    parse(_args: string[], {
        opcode,
        stack,
        linesByOffset,
        parentCallback,
        memory,
        readableCodeBuilder,
        currentOffset,
        line,
    }: OpcodeParserParentContext): boolean {
        const counter = stack.pop();
        const b = stack.pop();

        exists(b);
        exists(counter);

        const counterCode = () => {
            const _readableCodeBuilder: string[] = [];

            if (counter.valueType === EVMValueTypes.NUMBER) {
                assertBigInt(counter.value);
                // Theoretically there might be an issue here, but I think it's pretty save to ignore it right now.
                const lineWithOffset = linesByOffset[Number(counter.value)];

                if (lineWithOffset && getInstructionFromLine(lineWithOffset.line) === "JUMPDEST") {
                    _readableCodeBuilder.push(parentCallback(opcode, Number(counter.value), [ ...stack ], { ...memory }));
                }
                else {
                    _readableCodeBuilder.push("// Revert by JUMPI");
                }
            }
            else {
                _readableCodeBuilder.push(`// JUMP to ${counter.description}`);
            }

            return _readableCodeBuilder.join("\n");
        };

        if (b.valueType === EVMValueTypes.NUMBER && b.value !== BigInt(1)) {
            readableCodeBuilder.push(counterCode());
        }
        else if (b.valueType !== EVMValueTypes.NUMBER) {
            readableCodeBuilder.push(`if (${b.description}) {`);
            readableCodeBuilder.push(shiftMultilineText(counterCode()));
            readableCodeBuilder.push("}");
            readableCodeBuilder.push("else {");
            readableCodeBuilder.push(shiftMultilineText(parentCallback(opcode, currentOffset + lineBytes(line), [ ...stack ], { ...memory })));
            readableCodeBuilder.push("}");
        }
        else {
            return false;
        }

        return true;
    }
}