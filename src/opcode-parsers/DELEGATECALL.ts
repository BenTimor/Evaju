import { CallLikeParser } from "./CallLike";

export class DELEGATECALLParser extends CallLikeParser {
    constructor() {
        super("DELEGATECALL", 6, false);
    }
}
