import { ADDParser } from "./ADD"
import type { IOpcodeParser } from "./base"
import { CALLDATALOAD } from "./CALLDATALOAD"
import { CALLDATASIZEParser } from "./CALLDATASIZE"
import { CALLERParser } from "./CALLER"
import { CALLVALUEParser } from "./CALLVALUE"
import { DUPParser } from "./DUP"
import { EQParser } from "./EQ"
import { GTParser } from "./GT"
import { JUMPParser } from "./JUMP"
import { JUMPDESTParser } from "./JUMPDEST"
import { LTParser } from "./LT"
import { MLOADParser } from "./MLOAD"
import { MSTOREParser } from "./MSTORE"
import { PUSHParser } from "./PUSH"
import { SHRParser } from "./SHR"
export type { IOpcodeParser } from "./base";

export const opcodeParsers: Record<string, IOpcodeParser> = {
    // We got PUSH's from 0 to 32.
    ...Object.fromEntries(
        new Array(33).fill(0).map((_, i) => [
            `PUSH${i}`, new PUSHParser(i)
        ])
    ),
    // We got DUP's from 1 to 16.
    ...Object.fromEntries(
        new Array(16).fill(0).map((_, i) => [
            `DUP${i+1}`, new DUPParser(i + 1)
        ])
    ),
    // Rest
    CALLDATASIZE: new CALLDATASIZEParser(),
    JUMP: new JUMPParser(false),
    JUMPI: new JUMPParser(true),
    JUMPDEST: new JUMPDESTParser(),
    LT: new LTParser(),
    MSTORE: new MSTOREParser(),
    CALLDATALOAD: new CALLDATALOAD(),
    SHR: new SHRParser(),
    GT: new GTParser(),
    EQ: new EQParser(),
    MLOAD: new MLOADParser(),
    CALLER: new CALLERParser(),
    CALLVALUE: new CALLVALUEParser(),
    ADD: new ADDParser(),
}