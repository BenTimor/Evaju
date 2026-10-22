import { CustomInstruction } from "../code-builder";
import { EVMValueTypes } from "../evm-value";
import { assertBigInt, everyExists, exists } from "../type-utils";
import { sliceOffset } from "../utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class LOGParser implements IOpcodeParser {
    constructor(private topicsAmount: number) {}
    
    parse({ stack, memory, codeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();
        const topics = new Array(this.topicsAmount).fill(0).map(() => stack.pop());

        exists(offset);
        exists(size);
        everyExists(topics);

        const valueInMemory = memory[Number(offset.value)];
        
        if (valueInMemory?.valueType !== EVMValueTypes.NUMBER) {
            codeBuilder.push(new CustomInstruction(`// [LOG] Mem: Unknown | Topics: ${topics.join(", ")}`));
            return false;
        }
        
        assertBigInt(valueInMemory.value);

        codeBuilder.push(new CustomInstruction(`// [LOG] Mem: ${sliceOffset(valueInMemory.value, Number(size.value))} | Topics: ${topics.join(", ")}`));

        return false;
    }
}