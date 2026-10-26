import { beforeAll, describe, expect, it } from "vitest";
import { decompile, decompileWithReport, parseOpcode } from "../src/decompiler";
import { OpcodeCSV } from "../src/opcodes";
import { IfStatementInstruction } from "../src/code-builder";
import { assemble, zeroWord } from "./helpers/assemble";

beforeAll(() => {
    OpcodeCSV.load();
});

describe("basic execution", () => {
    it("stops", () => {
        expect(decompile("STOP")).toBe("// Stop successfully");
    });

    it("returns a stored constant", () => {
        const code = decompile(assemble(`
            PUSH1 0x60
            PUSH1 0x40
            MSTORE
            PUSH1 0x20
            PUSH1 0x40
            RETURN
        `));

        expect(code).toBe(`// [RETURN] Return: ${zeroWord("60")}`);
    });

    it("keeps PUSH immediates byte aligned", () => {
        const code = decompile(assemble(`
            PUSH2 0x0127
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        expect(code).toContain(zeroWord("0127"));
    });

    it("keeps values copied by DUP (regression: clone returned 0x0)", () => {
        const code = decompile(assemble(`
            PUSH1 0x2a
            DUP1
            ADD
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        // 0x2a + 0x2a = 0x54, not 0x2a (which is what a zeroing clone produced).
        expect(code).toContain(zeroWord("54"));
    });

    it("masks NOT to a full word instead of emitting negative hex", () => {
        const code = decompile(assemble(`
            PUSH1 0x00
            NOT
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        expect(code).toContain("f".repeat(64));
        expect(code).not.toContain("0x-");
    });

    it("reports a truncated listing without crashing", () => {
        expect(decompile("PUSH2")).toContain("PUSH2 without an immediate");
    });
});

describe("calldata context", () => {
    it("resolves CALLDATASIZE", () => {
        const code = decompile(assemble(`
            CALLDATASIZE
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `), { context: { calldata: "0x11223344" } });

        expect(code).toContain(zeroWord("04"));
    });

    it("resolves CALLDATALOAD with zero padding", () => {
        const code = decompile(assemble(`
            PUSH1 0x04
            CALLDATALOAD
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `), { context: { calldata: "0x12345678aabbccdd" } });

        expect(code).toContain(`0xaabbccdd${"00".repeat(28)}`);
    });

    it("keeps calldata loads symbolic without a context", () => {
        const code = decompile(assemble(`
            PUSH1 0x04
            CALLDATALOAD
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        expect(code).toContain("[Calldata[0x04]]");
    });

    it("resolves the environment from the context", () => {
        const code = decompile(assemble(`
            CALLER
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `), { context: { caller: 0x1234n } });

        expect(code).toContain(zeroWord("1234"));
    });
});

describe("control flow", () => {
    it("follows an unconditional jump instead of falling through", () => {
        const code = decompile(assemble(`
            PUSH2 @target
            JUMP
            POP
            POP
            target:
            JUMPDEST
            STOP
        `));

        expect(code).toBe("// Stop successfully");
        expect(code).not.toContain("Revert by POP");
    });

    it("follows a conditional jump whose condition is known to be true", () => {
        const code = decompile(assemble(`
            PUSH1 0x01
            PUSH2 @target
            JUMPI
            POP
            POP
            target:
            JUMPDEST
            STOP
        `));

        expect(code).toBe("// Stop successfully");
        expect(code).not.toContain("Revert by POP");
    });

    it("falls through when a condition is known to be false", () => {
        const code = decompile(assemble(`
            PUSH1 0x00
            PUSH2 @target
            JUMPI
            STOP
            POP
            target:
            JUMPDEST
            STOP
        `));

        expect(code).toBe("// Stop successfully");
        expect(code).not.toContain("if (");
    });

    it("emits both branches for symbolic conditions", () => {
        const code = decompile(assemble(`
            CALLDATASIZE
            ISZERO
            PUSH2 @taken
            JUMPI
            STOP
            taken:
            JUMPDEST
            STOP
        `));

        expect(code).toContain("if (0x00 == [CALLDATASIZE]) {");
        expect(code).toContain("else {");
    });

    it("rejects jumps to offsets that are not JUMPDEST", () => {
        const code = decompile(assemble(`
            CALLDATASIZE
            PUSH2 @not_a_jumpdest
            JUMPI
            STOP
            JUMPDEST
            not_a_jumpdest:
            PUSH1 0x00
        `));

        expect(code).toContain("invalid destination");
    });

    it("detects loops", () => {
        const code = decompile(assemble(`
            target:
            JUMPDEST
            PUSH2 @target
            JUMP
        `));

        expect(code).toContain("Loop back to offset");
    });

    it("stops at the maximum depth", () => {
        const depthOne = assemble(`
            PUSH2 @first
            JUMP
            first:
            JUMPDEST
            PUSH2 @second
            JUMP
            second:
            JUMPDEST
            STOP
        `);

        expect(decompile(depthOne, { maxDepth: 1 })).toContain("Depth limit reached");
    });
});

describe("unknown instructions", () => {
    it("still advances the offset so later jumps resolve", () => {
        const report = decompileWithReport(assemble(`
            CALLDATASIZE
            ISZERO
            PUSH2 @target
            JUMPI
            'ff'(Unknown Opcode)
            STOP
            CALLDATASIZE
            POP
            PUSH1 0x00
            target:
            JUMPDEST
            STOP
        `));

        expect(report.code).toContain("if (");
        expect(report.code).not.toContain("invalid destination");
        expect(report.warnings.join("\n")).toContain("ff");
    });

    it("reports a stack underflow instead of crashing", () => {
        const report = decompileWithReport("JUMP");

        expect(report.code).toContain("// Error: JUMP at offset 0");
        expect(report.warnings.join("\n")).toContain("stack underflow");
    });

    it("warns once per unknown instruction", () => {
        const report = decompileWithReport("'ff'(Unknown Opcode)\n'ff'(Unknown Opcode)\nSTOP");

        expect(report.warnings).toHaveLength(1);
    });
});

describe("memory, storage and logs", () => {
    it("reads memory written by a previous MSTORE", () => {
        const code = decompile(assemble(`
            PUSH1 0x2a
            PUSH1 0x40
            MSTORE
            PUSH1 0x20
            PUSH1 0x40
            RETURN
        `));

        expect(code).toContain(zeroWord("2a"));
    });

    it("treats memory that was never written as zero", () => {
        const code = decompile(assemble(`
            PUSH1 0x20
            PUSH1 0x80
            RETURN
        `));

        expect(code).toBe(`// [RETURN] Return: ${zeroWord("")}`);
    });

    it("reads storage written by a previous SSTORE", () => {
        const code = decompile(assemble(`
            PUSH1 0x07
            PUSH1 0x01
            SSTORE
            PUSH1 0x01
            SLOAD
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        expect(code).toContain(zeroWord("07"));
    });

    it("surfaces storage writes", () => {
        const code = decompile(assemble(`
            PUSH1 0x01
            PUSH1 0x00
            SLOAD
            ADD
            PUSH1 0x00
            SSTORE
            STOP
        `));

        expect(code).toContain("// STORAGE[0x00] = ([STORAGE[0x00]] + 0x01)");
        expect(code).toContain("// Stop successfully");
    });

    it("logs the first bytes of a memory word", () => {
        const code = decompile(assemble(`
            PUSH1 0x2a
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            LOG0
        `));

        expect(code).toContain(`// [LOG0] Mem: ${zeroWord("2a")}`);
    });

    it("hashes a memory word with KECCAK256", () => {
        const code = decompile(assemble(`
            PUSH1 0x00
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            KECCAK256
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `));

        // keccak256 of 32 zero bytes.
        expect(code).toContain("0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563");
    });
});

describe("determinism and caching", () => {
    it("produces identical output across runs (no random CREATE2 addresses)", () => {
        const program = assemble(`
            PUSH1 0x00
            PUSH1 0x00
            PUSH1 0x00
            PUSH1 0x00
            CREATE2
            PUSH1 0x00
            MSTORE
            PUSH1 0x20
            PUSH1 0x00
            RETURN
        `);

        const first = decompile(program);
        const second = decompile(program);

        expect(second).toBe(first);
        expect(first).toContain("[CREATE2(");
    });

    it("does not depend on the jump cache for correctness", () => {
        const program = assemble(`
            CALLDATASIZE
            PUSH2 @left
            JUMPI
            PUSH1 0x01
            STOP
            left:
            JUMPDEST
            PUSH1 0x02
            STOP
        `);

        expect(decompile(program, { cache: false })).toBe(decompile(program));
    });
});

describe("parseOpcode (legacy API)", () => {
    it("returns the instruction tree", () => {
        const instructions = parseOpcode("PUSH1 0x01\nPUSH1 0x02\nADD\nSTOP");

        expect(instructions.map(instruction => instruction.toString())).toEqual(["// Stop successfully"]);
    });

    it("returns nested if instructions for symbolic branches", () => {
        const instructions = parseOpcode(assemble(`
            CALLDATASIZE
            PUSH2 @taken
            JUMPI
            STOP
            taken:
            JUMPDEST
            STOP
        `));

        expect(instructions[0]).toBeInstanceOf(IfStatementInstruction);
    });
});

describe("dispatch fixture", () => {
    it("resolves the function selector when calldata is provided", () => {
        const report = decompileWithReport(dispatchProgram(), { context: { calldata: "0x12345678" } });

        expect(report.code).toBe("// STORAGE[0x00] = 0x01\n// Stop successfully");
        expect(report.warnings).toEqual([]);
    });

    it("reaches the second function for its selector", () => {
        const report = decompileWithReport(dispatchProgram(), { context: { calldata: "0xdeadbeef" } });

        expect(report.code).toBe("// [RETURN] Return: [STORAGE[0x00]]");
    });

    it("reverts for an unknown selector", () => {
        const report = decompileWithReport(dispatchProgram(), { context: { calldata: "0x00000000" } });

        expect(report.code).toContain("[REVERT] Revert: 0x");
    });

    it("keeps the branch structure symbolic without calldata", () => {
        const report = decompileWithReport(dispatchProgram());

        expect(report.code).toContain("if (");
        expect(report.code).not.toContain("invalid destination");
        expect(report.bytecode.startsWith("0x60806040")).toBe(true);
    });
});

function dispatchProgram(): string {
    return assemble(`
        PUSH1 0x80
        PUSH1 0x40
        MSTORE
        CALLDATASIZE
        ISZERO
        PUSH2 @empty_calldata
        JUMPI
        PUSH1 0xe0
        PUSH1 0x02
        EXP
        PUSH1 0x00
        CALLDATALOAD
        DIV
        DUP1
        PUSH4 0x12345678
        EQ
        PUSH2 @fn_store
        JUMPI
        DUP1
        PUSH4 0xdeadbeef
        EQ
        PUSH2 @fn_load
        JUMPI
        PUSH1 0x00
        DUP1
        REVERT
        fn_store:
        JUMPDEST
        PUSH1 0x01
        PUSH1 0x00
        SSTORE
        STOP
        fn_load:
        JUMPDEST
        PUSH1 0x00
        SLOAD
        PUSH1 0x00
        MSTORE
        PUSH1 0x20
        PUSH1 0x00
        RETURN
        empty_calldata:
        JUMPDEST
        STOP
    `);
}
