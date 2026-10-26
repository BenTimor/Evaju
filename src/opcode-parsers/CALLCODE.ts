import { CallLikeParser } from "./CallLike";

export class CALLCODEParser extends CallLikeParser {
    constructor() {
        super("CALLCODE", 7, true);
    }
}
