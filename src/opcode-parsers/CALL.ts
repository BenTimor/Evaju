import { CallLikeParser } from "./CallLike";

export class CALLParser extends CallLikeParser {
    constructor() {
        super("CALL", 7, true);
    }
}
