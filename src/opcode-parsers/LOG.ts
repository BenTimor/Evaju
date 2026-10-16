import { EVMValueTypes } from "../evm-value";
import { assertBigInt, everyExists, exists } from "../type-utils";
import { sliceOffset, unknownBaseStringToNumber } from "../utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class LOGParser implements IOpcodeParser {
    constructor(private topicsAmount: number) {}
    
    parse(args: string[], { stack, memory, readableCodeBuilder }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();
        const topics = new Array(this.topicsAmount).fill(0).map(() => stack.pop()?.description);

        exists(offset);
        exists(size);
        everyExists(topics);

        const valueInMemory = memory[Number(offset.value)];
        
        if (valueInMemory?.valueType !== EVMValueTypes.NUMBER) {
            readableCodeBuilder.push(`// [LOG] Mem: Unknown | Topics: ${topics.join(", ")}`);
            return false;
        }
        
        assertBigInt(valueInMemory.value);

        readableCodeBuilder.push(`// [LOG] Mem: ${sliceOffset(valueInMemory.value, Number(size.value))} | Topics: ${topics.join(", ")}`);

        return false;
    }
}