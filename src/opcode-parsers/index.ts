import { ADDParser } from "./ADD"
import type { IOpcodeParser } from "./base"
import { CALLDATALOAD } from "./CALLDATALOAD"
import { CALLDATASIZEParser } from "./CALLDATASIZE"
import { CALLERParser } from "./CALLER"
import { CALLVALUEParser } from "./CALLVALUE"
import { DUPParser } from "./DUP"
import { EQParser } from "./EQ"
import { GTParser } from "./GT"
import { ISZEROParser } from "./ISZERO"
import { JUMPParser } from "./JUMP"
import { JUMPDESTParser } from "./JUMPDEST"
import { LOGParser } from "./LOG"
import { LTParser } from "./LT"
import { MLOADParser } from "./MLOAD"
import { MSTOREParser } from "./MSTORE"
import { MULParser } from "./MUL"
import { ORParser } from "./OR"
import { POPParser } from "./POP"
import { PUSHParser } from "./PUSH"
import { RETURNParser } from "./RETURN"
import { REVERTParser } from "./REVERT"
import { SHParser } from "./SH"
import { STOPParser } from "./STOP"
import { SUBParser } from "./SUB"
import { SWAPParser } from "./SWAP"
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
            `DUP${i + 1}`, new DUPParser(i + 1)
        ])
    ),
    // We got SWAP's from 1 to 16.
    ...Object.fromEntries(
        new Array(16).fill(0).map((_, i) => [
            `SWAP${i + 1}`, new SWAPParser(i + 1)
        ])
    ),
    // We got LOG's from 0 to 4.
    ...Object.fromEntries(
        new Array(5).fill(0).map((_, i) => [
            `LOG${i}`, new LOGParser(i)
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
    SHR: new SHParser(true),
    SHL: new SHParser(false),
    GT: new GTParser(),
    EQ: new EQParser(),
    MLOAD: new MLOADParser(),
    CALLER: new CALLERParser(),
    CALLVALUE: new CALLVALUEParser(),
    ADD: new ADDParser(),
    SUB: new SUBParser(),
    STOP: new STOPParser(),
    REVERT: new REVERTParser(),
    ISZERO: new ISZEROParser(),
    POP: new POPParser(),
    AND: new ADDParser(),
    MUL: new MULParser(),
    OR: new ORParser(),
    RETURN: new RETURNParser(),
}