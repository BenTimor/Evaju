import { ComputedNumber, EVMValue, EVMValueTypes } from "../evm-value";
import { assertBigInt, exists } from "../type-utils";
import { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class EXTCODESIZEParser implements IOpcodeParser {
    parse({ stack, config }: OpcodeParserParentContext): boolean {
        const addr = stack.pop();
        exists(addr);

        const computed = new ComputedNumber((_, size) => {
            assertBigInt(size.value);

            return size.value;
        }, [addr, config.codeSizes?.[Number(addr.value)]]);

        stack.push(new EVMValue(computed, EVMValueTypes.COMPUTED_NUMBER, `[EXTCODESIZE(${addr})]`));

        return false;
    }
}