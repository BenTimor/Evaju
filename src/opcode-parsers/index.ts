import { ADDRESSParser } from "./ADDRESS"
import type { IOpcodeParser } from "./base"
import { CALLParser } from "./CALL"
import { CALLDATALOAD } from "./CALLDATALOAD"
import { CALLDATASIZEParser } from "./CALLDATASIZE"
import { CALLERParser } from "./CALLER"
import { CALLVALUEParser } from "./CALLVALUE"
import { CODECOPYParser } from "./CODECOPY"
import { DUPParser } from "./DUP"
import { EXTCODESIZEParser } from "./EXTCODESIZE"
import { GASParser } from "./GAS"
import { GenericOperatorParser } from "./GenericOperator"
import { ISZEROParser } from "./ISZERO"
import { JUMPParser } from "./JUMP"
import { JUMPDESTParser } from "./JUMPDEST"
import { KECCAK256Parser } from "./KECCAK256"
import { LOGParser } from "./LOG"
import { MLOADParser } from "./MLOAD"
import { MSTOREParser } from "./MSTORE"
import { NOTParser } from "./NOT"
import { POPParser } from "./POP"
import { PUSHParser } from "./PUSH"
import { RETURNParser } from "./RETURN"
import { RETURNDATASIZEParser } from "./RETURNDATASIZE"
import { REVERTParser } from "./REVERT"
import { SLOADParser } from "./SLOAD"
import { SSTOREParser } from "./SSTORE"
import { STOPParser } from "./STOP"
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
    // Generic operators
    LT: new GenericOperatorParser("<"),
    SHR: new GenericOperatorParser(">>"),
    SHL: new GenericOperatorParser("<<"),
    GT: new GenericOperatorParser(">"),
    EQ: new GenericOperatorParser("=="),
    ADD: new GenericOperatorParser("+"),
    SUB: new GenericOperatorParser("-"),
    AND: new GenericOperatorParser("&"),
    MUL: new GenericOperatorParser("*"),
    OR: new GenericOperatorParser("|"),
    // Rest
    CALLDATASIZE: new CALLDATASIZEParser(),
    JUMP: new JUMPParser(false),
    JUMPI: new JUMPParser(true),
    JUMPDEST: new JUMPDESTParser(),
    MSTORE: new MSTOREParser(),
    CALLDATALOAD: new CALLDATALOAD(),
    MLOAD: new MLOADParser(),
    CALLER: new CALLERParser(),
    CALLVALUE: new CALLVALUEParser(),
    STOP: new STOPParser(),
    REVERT: new REVERTParser(),
    ISZERO: new ISZEROParser(),
    POP: new POPParser(),
    RETURN: new RETURNParser(),
    ADDRESS: new ADDRESSParser(),
    CODECOPY: new CODECOPYParser(),
    EXTCODESIZE: new EXTCODESIZEParser(),
    GAS: new GASParser(),
    CALL: new CALLParser(),
    RETURNDATASIZE: new RETURNDATASIZEParser(),
    RETURNDATACOPY: new RETURNDATASIZEParser(),
    SLOAD: new SLOADParser(),
    SHA3: new KECCAK256Parser(),
    KECCAK256: new KECCAK256Parser(),
    NOT: new NOTParser(),
    SSTORE: new SSTOREParser(),
}