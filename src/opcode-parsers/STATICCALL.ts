import { CallLikeParser } from "./CallLike";

export class STATICCALLParser extends CallLikeParser {
    constructor() {
        super("STATICCALL", 6, false);
    }
}
