import { hexToBigInt, keccak256, numberToHex } from "viem";
import { ComputedNumber, EVMOperatorValue, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class KECCAK256Parser implements IOpcodeParser {
    parse(args: string[], { stack, memory }: OpcodeParserParentContext): boolean {
        const offset = stack.pop();
        const size = stack.pop();

        exists(offset);
        exists(size);
        
        const mValue = memory[offset.key] ?? new EVMValue(0, EVMValueTypes.NUMBER);
    
        const computed = new ComputedNumber(mValue => {
            assertBigInt(mValue.value);

            return hexToBigInt(keccak256(numberToHex(mValue.value, { size: 32 })));
        }, [mValue]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[KECCAK256(${mValue.description})]`));

        return false;
    }
}