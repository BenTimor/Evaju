import { beforeAll, describe, expect, it } from "vitest";
import { OpcodeCSV, defaultOpcodeCsvPath } from "../src/opcodes";
import { opcodeNames } from "../src/opcode-parsers";

beforeAll(() => {
    OpcodeCSV.load();
});

describe("opcodes.csv", () => {
    it("is located next to the package", () => {
        expect(defaultOpcodeCsvPath()).toMatch(/opcodes\.csv$/);
    });

    it("maps the core instruction set", () => {
        expect(OpcodeCSV.bytecodeOf("STOP")).toBe("00");
        expect(OpcodeCSV.bytecodeOf("PUSH1")).toBe("60");
        expect(OpcodeCSV.bytecodeOf("PUSH32")).toBe("7f");
        expect(OpcodeCSV.bytecodeOf("JUMPDEST")).toBe("5b");
        expect(OpcodeCSV.bytecodeOf("RETURN")).toBe("f3");
        expect(OpcodeCSV.bytecodeOf("REVERT")).toBe("fd");
        expect(OpcodeCSV.bytecodeOf("SELFDESTRUCT")).toBe("ff");
        expect(OpcodeCSV.bytecodeOf("push1")).toBe("60");
    });

    it("knows opcodes the CSV is missing", () => {
        // PUSH0, PC and the transient storage opcodes are not in the bundled CSV.
        expect(OpcodeCSV.bytecodeOf("PUSH0")).toBe("5f");
        expect(OpcodeCSV.bytecodeOf("PC")).toBe("58");
        expect(OpcodeCSV.bytecodeOf("TLOAD")).toBe("5c");
        expect(OpcodeCSV.bytecodeOf("TSTORE")).toBe("5d");
        expect(OpcodeCSV.bytecodeOf("MCOPY")).toBe("5e");
        expect(OpcodeCSV.bytecodeOf("BLOBHASH")).toBe("49");
        expect(OpcodeCSV.bytecodeOf("PREVRANDAO")).toBe("44");
    });

    it("can map bytecode back to names", () => {
        expect(OpcodeCSV.nameOf("60")).toBe("PUSH1");
        expect(OpcodeCSV.nameOf("0x5b")).toBe("JUMPDEST");
        expect(OpcodeCSV.nameOf("05")).toBe("SDIV");
        expect(OpcodeCSV.nameOf("5")).toBe("SDIV");
        expect(OpcodeCSV.nameOf("0xff")).toBe("SELFDESTRUCT");
    });

    it("has a bytecode for every instruction the decompiler understands", () => {
        const missing = opcodeNames.filter(name => OpcodeCSV.bytecodeOf(name) === undefined);

        expect(missing).toEqual([]);
    });

    it("round trips a listing into bytecode", () => {
        expect(OpcodeCSV.toBytecode("PUSH1 0x80\nPUSH1 0x40\nMSTORE")).toBe("0x6080604052");
        expect(OpcodeCSV.toBytecode("PUSH2 0x0127\nJUMPI")).toBe("0x61012757");
        expect(OpcodeCSV.toBytecode("PUSH0")).toBe("0x5f");
    });

    it("keeps PUSH immediates byte aligned", () => {
        // A short immediate is left padded, a long one is truncated to its low bytes.
        expect(OpcodeCSV.toBytecode("PUSH2 0x12")).toBe("0x610012");
        expect(OpcodeCSV.toBytecode("PUSH1 0x1234")).toBe("0x6034");
    });

    it("treats disassembler data bytes as raw hex", () => {
        expect(OpcodeCSV.toBytecode("'a8'(Unknown Opcode)\nJUMPDEST")).toBe("0xa85b");
    });

    it("rejects instructions that are neither opcodes nor hex bytes", () => {
        expect(() => OpcodeCSV.toBytecode("FOOBAR")).toThrow(/unknown instruction/i);
    });

    it("reports failure instead of throwing through tryToBytecode", () => {
        expect(OpcodeCSV.tryToBytecode("FOOBAR")).toBeUndefined();
        expect(OpcodeCSV.tryToBytecode("STOP")).toBe("0x00");
    });

    it("is idempotent", () => {
        const first = OpcodeCSV.toBytecode("PUSH1 0x60\nPUSH1 0x40\nMSTORE");
        const second = OpcodeCSV.toBytecode("PUSH1 0x60\nPUSH1 0x40\nMSTORE");

        expect(second).toBe(first);
        expect(OpcodeCSV.toBytecode("STOP")).toBe("0x00");
    });
});
