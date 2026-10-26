import { CustomInstruction } from "../code-builder";
import { exists } from "../type-utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

export class SELFDESTRUCTParser implements IOpcodeParser {
    parse({ stack, codeBuilder }: OpcodeParserParentContext): boolean {
        const beneficiary = stack.pop();
        exists(beneficiary);

        codeBuilder.push(new CustomInstruction(`// SELFDESTRUCT to ${beneficiary}`));

        return true;
    }
}
