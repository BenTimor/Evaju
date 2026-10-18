import { CustomInstruction } from "../code-builder";
import { EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { sliceOffset } from "../utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class RETURNParser implements IOpcodeParser {
    parse(args: string[], { stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);

        const valueInMemory = memory[Number(offset.value)];

        if (valueInMemory?.valueType !== EVMValueTypes.NUMBER) {
            codeBuilder.push(new CustomInstruction(`// [REVERT] Return: Unknown`));
            return true;
        }

        assertBigInt(valueInMemory.value);

        codeBuilder.push(new CustomInstruction(`// [RETURN] Return: ${sliceOffset(valueInMemory.value, Number(size.value))}`));

        return true;
    }
}