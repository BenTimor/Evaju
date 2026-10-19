import { CustomInstruction, IfStatementInstruction } from "../code-builder";
import { EVMOperatorValue, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { getInstructionFromLine, lineBytes } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class JUMPParser implements IOpcodeParser {
    constructor(private jumpi: boolean) { }

    parse(_args: string[], {
        opcode,
        stack,
        linesByOffset,
        parentCallback,
        memory,
        codeBuilder,
        currentOffset,
        line,
        storage,
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
                    return parentCallback(opcode, Number(counter.value), [...stack], { ...memory }, { ...storage });
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
            const ifBody = counterCode();
            const elseBody = parentCallback(opcode, currentOffset + lineBytes(line), [...stack], { ...memory }, { ...storage });

            if (ifBody.join("") === elseBody.join("")) {
                codeBuilder.push(...ifBody);
                return true;
            }

            const outerIfInstruction = new IfStatementInstruction([b], [ifBody, elseBody]);

            if (ifBody[0] instanceof IfStatementInstruction) {
                const internalIfInstruction = ifBody[0];
                const conditions: EVMValue[] = internalIfInstruction.conditions.map(condition => new EVMOperatorValue("&&", b, condition));
                const bodies = internalIfInstruction.bodies;

                const onlyValidConditionIndex = (arr: any[]) => {
                    return arr.filter((_, i) => {
                        return conditions[i]?.value !== 0n;
                    })
                }

                if (internalIfInstruction.stringifiedBodyByIndex(-1) === outerIfInstruction.stringifiedBodyByIndex(-1)) {
                    codeBuilder.push(new IfStatementInstruction(
                        onlyValidConditionIndex(conditions),
                        onlyValidConditionIndex(bodies),
                    ));

                    return true;
                }

                conditions.push(b);
                bodies.push(elseBody);

                codeBuilder.push(new IfStatementInstruction(
                    onlyValidConditionIndex(conditions),
                    onlyValidConditionIndex(bodies)
                ));
                return true;
            }
            codeBuilder.push(new IfStatementInstruction([b], [ifBody, elseBody]));
        }
        else {
            return false;
        }

        return true;
    }
}