import { ADDRESSParser } from "./ADDRESS"
import { ADDMODParser } from "./ADDMOD"
import type { IOpcodeParser } from "./base"
import { BLOCKHASHParser } from "./BLOCKHASH"
import { BYTEParser } from "./BYTE"
import { CALLParser } from "./CALL"
import { CALLCODEParser } from "./CALLCODE"
import { CALLDATACOPYParser } from "./CALLDATACOPY"
import { CALLDATALOAD } from "./CALLDATALOAD"
import { CALLDATASIZEParser } from "./CALLDATASIZE"
import { CALLERParser } from "./CALLER"
import { CALLVALUEParser } from "./CALLVALUE"
import { CODECOPYParser } from "./CODECOPY"
import { CODESIZEParser } from "./CODESIZE"
import { CREATEParser } from "./CREATE"
import { CREATE2Parser } from "./CREATE2"
import { DELEGATECALLParser } from "./DELEGATECALL"
import { DUPParser } from "./DUP"
import { EXTCODECOPYParser } from "./EXTCODECOPY"
import { EXTCODEHASHParser } from "./EXTCODEHASH"
import { EXTCODESIZEParser } from "./EXTCODESIZE"
import { GASParser } from "./GAS"
import { GenericOperatorParser } from "./GenericOperator"
import { INVALIDParser } from "./INVALID"
import { ISZEROParser } from "./ISZERO"
import { JUMPParser } from "./JUMP"
import { JUMPDESTParser } from "./JUMPDEST"
import { KECCAK256Parser } from "./KECCAK256"
import { LOGParser } from "./LOG"
import { MLOADParser } from "./MLOAD"
import { MSIZEParser } from "./MSIZE"
import { MSTOREParser } from "./MSTORE"
import { MSTORE8Parser } from "./MSTORE8"
import { MULMODParser } from "./MULMOD"
import { NOTParser } from "./NOT"
import { NUMBERParser } from "./NUMBER"
import { ORIGINParser } from "./ORIGIN"
import { PCParser } from "./PC"
import { POPParser } from "./POP"
import { PUSHParser } from "./PUSH"
import { RETURNParser } from "./RETURN"
import { RETURNDATACOPYParser } from "./RETURNDATACOPY"
import { RETURNDATASIZEParser } from "./RETURNDATASIZE"
import { REVERTParser } from "./REVERT"
import { SELFDESTRUCTParser } from "./SELFDESTRUCT"
import { SELFBALANCEParser } from "./SELFBALANCE"
import { SIGNEXTENDParser } from "./SIGNEXTEND"
import { SLOADParser } from "./SLOAD"
import { SSTOREParser } from "./SSTORE"
import { STATICCALLParser } from "./STATICCALL"
import { STOPParser } from "./STOP"
import { SWAPParser } from "./SWAP"
import { StackOpsParser, SymbolicPushParser, UnarySymbolicParser } from "./symbolic"

export type { IOpcodeParser, OpcodeParserParentContext, ExecutionContext } from "./base";
export { opcodeNames };

const opcodeParsers: Record<string, IOpcodeParser> = {
    // PUSH0 through PUSH32
    ...Object.fromEntries(
        new Array(33).fill(0).map((_, i) => [
            `PUSH${i}`, new PUSHParser(i)
        ])
    ),
    // DUP1 through DUP16
    ...Object.fromEntries(
        new Array(16).fill(0).map((_, i) => [
            `DUP${i + 1}`, new DUPParser(i + 1)
        ])
    ),
    // SWAP1 through SWAP16
    ...Object.fromEntries(
        new Array(16).fill(0).map((_, i) => [
            `SWAP${i + 1}`, new SWAPParser(i + 1)
        ])
    ),
    // LOG0 through LOG4
    ...Object.fromEntries(
        new Array(5).fill(0).map((_, i) => [
            `LOG${i}`, new LOGParser(i)
        ])
    ),
    // Logic and arithmetic
    LT: new GenericOperatorParser("<"),
    GT: new GenericOperatorParser(">"),
    SLT: new GenericOperatorParser("slt"),
    SGT: new GenericOperatorParser("sgt"),
    EQ: new GenericOperatorParser("=="),
    AND: new GenericOperatorParser("&"),
    OR: new GenericOperatorParser("|"),
    XOR: new GenericOperatorParser("^"),
    SHL: new GenericOperatorParser("<<"),
    SHR: new GenericOperatorParser(">>"),
    SAR: new GenericOperatorParser("sar"),
    ADD: new GenericOperatorParser("+"),
    SUB: new GenericOperatorParser("-"),
    MUL: new GenericOperatorParser("*"),
    DIV: new GenericOperatorParser("/"),
    SDIV: new GenericOperatorParser("sdiv"),
    MOD: new GenericOperatorParser("%"),
    SMOD: new GenericOperatorParser("smod"),
    EXP: new GenericOperatorParser("**"),
    NOT: new NOTParser(),
    ISZERO: new ISZEROParser(),
    BYTE: new BYTEParser(),
    SIGNEXTEND: new SIGNEXTENDParser(),
    ADDMOD: new ADDMODParser(),
    MULMOD: new MULMODParser(),
    KECCAK256: new KECCAK256Parser(),
    SHA3: new KECCAK256Parser(),
    // Environment / account
    ADDRESS: new ADDRESSParser(),
    BALANCE: new UnarySymbolicParser("BALANCE"),
    ORIGIN: new ORIGINParser(),
    CALLER: new CALLERParser(),
    CALLVALUE: new CALLVALUEParser(),
    CALLDATALOAD: new CALLDATALOAD(),
    CALLDATASIZE: new CALLDATASIZEParser(),
    CALLDATACOPY: new CALLDATACOPYParser(),
    CODESIZE: new CODESIZEParser(),
    CODECOPY: new CODECOPYParser(),
    GASPRICE: new SymbolicPushParser("[GASPRICE]"),
    EXTCODESIZE: new EXTCODESIZEParser(),
    EXTCODECOPY: new EXTCODECOPYParser(),
    EXTCODEHASH: new EXTCODEHASHParser(),
    RETURNDATASIZE: new RETURNDATASIZEParser(),
    RETURNDATACOPY: new RETURNDATACOPYParser(),
    // Block
    BLOCKHASH: new BLOCKHASHParser(),
    COINBASE: new SymbolicPushParser("[COINBASE]"),
    TIMESTAMP: new SymbolicPushParser("[TIMESTAMP]"),
    NUMBER: new NUMBERParser(),
    DIFFICULTY: new SymbolicPushParser("[DIFFICULTY]"),
    PREVRANDAO: new SymbolicPushParser("[PREVRANDAO]"),
    GASLIMIT: new SymbolicPushParser("[GASLIMIT]"),
    CHAINID: new SymbolicPushParser("[CHAINID]"),
    SELFBALANCE: new SELFBALANCEParser(),
    BLOBHASH: new UnarySymbolicParser("BLOBHASH"),
    BASEFEE: new SymbolicPushParser("[BASEFEE]"),
    BLOBBASEFEE: new SymbolicPushParser("[BLOBBASEFEE]"),
    // Memory / storage
    POP: new POPParser(),
    MLOAD: new MLOADParser(),
    MSTORE: new MSTOREParser(),
    MSTORE8: new MSTORE8Parser(),
    SLOAD: new SLOADParser(),
    SSTORE: new SSTOREParser(),
    MSIZE: new MSIZEParser(),
    TLOAD: new UnarySymbolicParser("TLOAD"),
    TSTORE: new StackOpsParser("TSTORE", 2),
    MCOPY: new StackOpsParser("MCOPY", 3),
    PC: new PCParser(),
    GAS: new GASParser(),
    // Control flow
    JUMP: new JUMPParser(false),
    JUMPI: new JUMPParser(true),
    JUMPDEST: new JUMPDESTParser(),
    STOP: new STOPParser(),
    RETURN: new RETURNParser(),
    REVERT: new REVERTParser(),
    INVALID: new INVALIDParser(),
    // Calls / creation
    CALL: new CALLParser(),
    CALLCODE: new CALLCODEParser(),
    DELEGATECALL: new DELEGATECALLParser(),
    STATICCALL: new STATICCALLParser(),
    CREATE: new CREATEParser(),
    CREATE2: new CREATE2Parser(),
    SELFDESTRUCT: new SELFDESTRUCTParser(),
};

/** Every instruction name this decompiler knows how to handle. */
const opcodeNames = Object.keys(opcodeParsers).sort();

export function getOpcodeParser(instruction: string): IOpcodeParser | undefined {
    return opcodeParsers[instruction];
}

export function isKnownInstruction(instruction: string): boolean {
    return instruction in opcodeParsers;
}
