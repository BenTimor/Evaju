import { EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { sliceOffset } from "../utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class REVERTParser implements IOpcodeParser {
    parse(args: string[], { stack, memory, readableCodeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const valueInMemory = memory[Number(offset.value)];

        if (valueInMemory?.valueType !== EVMValueTypes.NUMBER) {
            readableCodeBuilder.push(`// [REVERT] Return: Unknown`);
            return true;
        }

        assertBigInt(valueInMemory.value);

        readableCodeBuilder.push(`// [REVERT] Return: ${sliceOffset(valueInMemory.value, Number(size.value))}`);

        return true;
    }
}