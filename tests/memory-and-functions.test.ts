import { beforeAll, describe, expect, it } from "vitest";
import { decompile, decompileWithReport } from "../src/decompiler";
import { OpcodeCSV } from "../src/opcodes";
import { assemble, zeroWord } from "./helpers/assemble";

beforeAll(() => {
    OpcodeCSV.load();
});

/** Wraps a program so the word at 0x00 is returned, making the state observable. */
function returnWord(program: string, offset = "0x00"): string {
    return assemble(`${program}
        PUSH1 0x20
        PUSH1 ${offset}
        RETURN
    `);
}

describe("byte addressable memory", () => {
    it("treats unwritten memory as zero", () => {
        const code = decompile(assemble(`
            PUSH1 0x20
            PUSH1 0x80
            RETURN
        `));

        expect(code).toBe(`// [RETURN] Return: ${zeroWord("")}`);
    });

    it("lets MSTORE8 overwrite one byte of a stored word", () => {
        const code = decompile(returnWord(`
            PUSH1 0xff
            PUSH1 0x00
            MSTORE
            PUSH1 0xaa
            PUSH1 0x1f
            MSTORE8
        `));

        // Only the last byte changed; the rest of the word is zero.
        expect(code).toBe(`// [RETURN] Return: ${zeroWord("aa")}`);
    });

    it("places an MSTORE8 byte at the most significant position", () => {
        const code = decompile(returnWord(`
            PUSH1 0xaa
            PUSH1 0x00
            MSTORE8
        `));

        expect(code).toBe(`// [RETURN] Return: 0xaa${"00".repeat(31)}`);
    });

    it("reads a word that starts inside another word", () => {
        const code = decompile(returnWord(`
            PUSH1 0x80
            PUSH1 0x00
            MSTORE
            PUSH1 0x01
            MLOAD
            PUSH1 0x00
            MSTORE
        `));

        // 0x80 lived at byte 31; from offset 1 that is byte 30 of the word -> 0x8000.
        expect(code).toBe(`// [RETURN] Return: ${zeroWord("8000")}`);
    });

    it("combines overlapping writes", () => {
        const code = decompile(returnWord(`
            PUSH2 0x1111
            PUSH1 0x00
            MSTORE
            PUSH1 0x22
            PUSH1 0x1f
            MSTORE8
        `));

        // The word write put 0x1111 in the last two bytes, MSTORE8 replaced the last one.
        expect(code).toBe(`// [RETURN] Return: ${zeroWord("1122")}`);
    });

    it("returns only the copied calldata bytes", () => {
        const code = decompile(assemble(`
            PUSH1 0x04
            PUSH1 0x00
            PUSH1 0x40
            CALLDATACOPY
            PUSH1 0x04
            PUSH1 0x40
            RETURN
        `), { context: { calldata: "0xdeadbeef" } });

        expect(code).toBe("// [RETURN] Return: 0xdeadbeef");
    });

    it("copies memory with MCOPY", () => {
        const code = decompile(assemble(`
            PUSH1 0x2a
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            PUSH1 0x40
            MCOPY
            PUSH1 0x20
            PUSH1 0x40
            RETURN
        `));

        expect(code).toBe(`// [RETURN] Return: ${zeroWord("2a")}`);
    });

    it("keeps symbolic memory symbolic", () => {
        const code = decompile(returnWord(`
            PUSH1 0x00
            SLOAD
            PUSH1 0x00
            MSTORE
        `));

        expect(code).toBe("// [RETURN] Return: [STORAGE[0x00]]");
    });

    it("slices a symbolic region when the read stays inside it", () => {
        const code = decompile(assemble(`
            PUSH1 0x00
            SLOAD
            PUSH1 0x00
            MSTORE
            PUSH1 0x04
            PUSH1 0x04
            RETURN
        `));

        expect(code).toBe("// [RETURN] Return: [[STORAGE[0x00]][4:8]]");
    });

    it("reports a read that mixes known and symbolic bytes as unknown", () => {
        const code = decompile(returnWord(`
            PUSH1 0x00
            SLOAD
            PUSH1 0x00
            MSTORE
            PUSH1 0xaa
            PUSH1 0x1f
            MSTORE8
            PUSH1 0x01
            MLOAD
            PUSH1 0x00
            MSTORE
        `));

        expect(code).toBe("// [RETURN] Return: [MEMORY[0x01]]");
    });

    it("hashes exactly the requested bytes", () => {
        const code = decompile(assemble(`
            PUSH1 0x00
            PUSH1 0x00
            MSTORE
            PUSH1 0x04
            PUSH1 0x00
            KECCAK256
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        // keccak256 of 4 zero bytes (not the 32 byte digest of a full word).
        expect(code).toContain("0xe8e77626586f73b955364c7b4bbf0bb7f7685ebd40e852b164633a4acbd3244c");
    });
});

describe("function extraction", () => {
    const sharedHelper = `
        PUSH1 0x01
        PUSH2 @ret1
        PUSH2 @helper
        JUMP
        ret1:
        JUMPDEST
        POP
        PUSH1 0x02
        PUSH2 @ret2
        PUSH2 @helper
        JUMP
        ret2:
        JUMPDEST
        POP
        STOP
        helper:
        JUMPDEST
        PUSH1 0x07
        PUSH1 0x00
        SSTORE
        JUMP
    `;

    it("hoists a target that is called from two sites", () => {
        const report = decompileWithReport(assemble(sharedHelper));

        expect(report.functions).toHaveLength(1);

        const [fn] = report.functions;

        expect(fn?.returns).toBe(true);
        expect(fn?.offset).toBeGreaterThan(0);
        expect(report.code).toContain(`${fn?.label}();`);
        expect(report.code).toContain("// STORAGE[0x00] = 0x07");
        expect(report.code).toContain("// return");
        expect(report.code).toContain(`// --- ${fn?.label} (offset 0x${fn?.offset.toString(16)}) ---`);
    });

    it("calls the function once per call site", () => {
        const report = decompileWithReport(assemble(sharedHelper));
        const calls = report.code.split("\n").filter(line => line.endsWith("();"));

        expect(calls).toHaveLength(2);
    });

    it("keeps the caller's continuation after the call", () => {
        const code = decompile(assemble(`
            PUSH2 @ret
            PUSH2 @helper
            JUMP
            ret:
            JUMPDEST
            PUSH1 0x2a
            PUSH1 0x00
            SSTORE
            STOP
            helper:
            JUMPDEST
            JUMP
        `));

        // The helper is only called once, so it stays inlined: the caller's
        // continuation has to survive the call.
        expect(code).toContain("// STORAGE[0x00] = 0x2a");
        expect(code).toContain("// Stop successfully");
    });

    it("does not extract loops", () => {
        const report = decompileWithReport(assemble(`
            loop:
            JUMPDEST
            CALLDATASIZE
            ISZERO
            PUSH2 @exit
            JUMPI
            PUSH2 @loop
            JUMP
            exit:
            JUMPDEST
            STOP
        `));

        expect(report.functions).toEqual([]);
        expect(report.code).toContain("Loop back to offset");
    });

    it("does not extract targets that are jumped to once", () => {
        const report = decompileWithReport(assemble(`
            PUSH2 @target
            JUMP
            target:
            JUMPDEST
            STOP
        `));

        expect(report.functions).toEqual([]);
    });

    it("handles recursion by referencing the function", () => {
        const report = decompileWithReport(assemble(`
            PUSH2 @ret1
            PUSH2 @helper
            JUMP
            ret1:
            JUMPDEST
            PUSH2 @ret2
            PUSH2 @helper
            JUMP
            ret2:
            JUMPDEST
            STOP
            helper:
            JUMPDEST
            PUSH2 @again
            PUSH2 @helper
            JUMP
            again:
            JUMPDEST
            JUMP
        `));

        expect(report.functions).toHaveLength(1);
        expect(report.code).not.toContain("End of code");
    });

    it("can be disabled", () => {
        const withFunctions = decompileWithReport(assemble(sharedHelper), { extractFunctions: true });
        const withoutFunctions = decompileWithReport(assemble(sharedHelper), { extractFunctions: false });

        expect(withFunctions.functions).toHaveLength(1);
        expect(withoutFunctions.functions).toEqual([]);
        expect(withoutFunctions.code).not.toContain("function_");
    });

    it("is deterministic", () => {
        const program = assemble(sharedHelper);

        expect(decompile(program)).toBe(decompile(program));
        expect(decompile(program, { cache: false })).toBe(decompile(program));
    });
});
