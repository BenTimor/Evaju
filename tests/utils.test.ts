import { describe, expect, it } from "vitest";
import {
    calculateLinesByOffset,
    getInstructionArgs,
    getInstructionFromLine,
    hexByteLength,
    lineBytes,
    normalizeDisassembly,
    normalizeUint256,
    readHexBytes,
    sliceBytes,
    stripHexPrefix,
    toHex,
    toSafeNumber,
    toSignedUint256,
    unknownBaseStringToNumber,
} from "../src/utils";
import { MAX_UINT256 } from "../src/constants";

describe("unknownBaseStringToNumber", () => {
    it("parses every documented base prefix", () => {
        expect(unknownBaseStringToNumber("0x60")).toBe(0x60n);
        expect(unknownBaseStringToNumber("0b1010")).toBe(10n);
        expect(unknownBaseStringToNumber("0o17")).toBe(15n);
        expect(unknownBaseStringToNumber("42")).toBe(42n);
        expect(unknownBaseStringToNumber("0X1F")).toBe(31n);
    });

    it("parses negative values and trims whitespace", () => {
        expect(unknownBaseStringToNumber("  -0x01 ")).toBe(-1n);
        expect(unknownBaseStringToNumber("-7")).toBe(-7n);
    });

    it("rejects empty or malformed input", () => {
        expect(() => unknownBaseStringToNumber("")).toThrow(/empty/i);
        expect(() => unknownBaseStringToNumber("0x")).toThrow(/no digits/i);
        expect(() => unknownBaseStringToNumber("0xzz")).toThrow(/digit/i);
        expect(() => unknownBaseStringToNumber("0b102")).toThrow(/digit/i);
    });
});

describe("uint256 helpers", () => {
    it("wraps values into 32 bytes", () => {
        expect(normalizeUint256(-1n)).toBe(MAX_UINT256);
        expect(normalizeUint256(MAX_UINT256 + 1n)).toBe(0n);
        expect(normalizeUint256(5n)).toBe(5n);
    });

    it("interprets the sign bit as two's complement", () => {
        expect(toSignedUint256(MAX_UINT256)).toBe(-1n);
        expect(toSignedUint256(1n << 255n)).toBe(-(1n << 255n));
        expect(toSignedUint256(1n)).toBe(1n);
    });

    it("formats hex byte aligned and never emits negative hex", () => {
        expect(toHex(0x60n)).toBe("0x60");
        expect(toHex(0x1n)).toBe("0x01");
        expect(toHex(0x0127n)).toBe("0x0127");
        expect(toHex(0n)).toBe("0x00");
        expect(toHex(-1n)).toBe(`0x${"f".repeat(64)}`);
        expect(toHex(0x60n, 32)).toBe(`0x${"0".repeat(62)}60`);
        expect(toHex(0n, 0)).toBe("0x00");
    });

    it("slices bytes out of a word, counting from the least significant byte", () => {
        // 0xdeadbeef sits in the four most significant bytes.
        const word = 0xdeadbeefn << 224n;

        expect(sliceBytes(word, 28, 4)).toBe(0xdeadbeefn);
        expect(sliceBytes(word, 31, 1)).toBe(0xden);
        expect(sliceBytes(word, 30, 1)).toBe(0xadn);
        expect(sliceBytes(word, 0, 4)).toBe(0n);
        expect(sliceBytes(0x1234n, 0, 1)).toBe(0x34n);
        expect(sliceBytes(0x1234n, 1, 1)).toBe(0x12n);
        expect(sliceBytes(0x1234n, 0, 0)).toBe(0n);
        expect(sliceBytes(0x1234n, 32, 1)).toBe(0n);
    });
});

describe("hex helpers", () => {
    it("counts bytes and strips prefixes", () => {
        expect(hexByteLength("0x11223344")).toBe(4);
        expect(hexByteLength("0x")).toBe(0);
        expect(stripHexPrefix("0XAbCd")).toBe("abcd");
    });

    it("reads byte ranges, zero padding past the end", () => {
        expect(readHexBytes("0x00112233", 0, 2)).toBe(0x0011n);
        expect(readHexBytes("0x00112233", 2, 2)).toBe(0x2233n);
        expect(readHexBytes("0x00112233", 4, 2)).toBe(0n);
        expect(readHexBytes("0x00112233", 3, 4)).toBe(0x33000000n);
        expect(readHexBytes("0x00112233", 0, 0)).toBe(0n);
        expect(readHexBytes("0x00", 0, 32)).toBe(0n);
    });

    it("converts to safe numbers only when the value fits", () => {
        expect(toSafeNumber(10n)).toBe(10);
        expect(toSafeNumber(-1n)).toBeUndefined();
        expect(toSafeNumber(2n ** 200n)).toBeUndefined();
        expect(toSafeNumber(40n, 32n)).toBeUndefined();
    });
});

describe("instruction helpers", () => {
    it("reads the instruction and its arguments", () => {
        expect(getInstructionFromLine("PUSH1 0x60")).toBe("PUSH1");
        expect(getInstructionFromLine("\tMSTORE  ")).toBe("MSTORE");
        expect(getInstructionArgs("PUSH1 0x60")).toEqual(["0x60"]);
        expect(getInstructionArgs("  PUSH32   0xff  ")).toEqual(["0xff"]);
        expect(getInstructionArgs("MSTORE")).toEqual([]);
        expect(() => getInstructionFromLine("   ")).toThrow(/empty line/i);
    });

    it("counts bytes per instruction", () => {
        expect(lineBytes("PUSH0")).toBe(1);
        expect(lineBytes("PUSH1 0x60")).toBe(2);
        expect(lineBytes("PUSH32 0x")).toBe(33);
        expect(lineBytes("MSTORE")).toBe(1);
        expect(lineBytes("ff")).toBe(1);
    });

    it("maps offsets to lines", () => {
        const lines = ["PUSH1 0x60", "PUSH1 0x40", "MSTORE", "JUMPDEST"];
        const byOffset = calculateLinesByOffset(lines);

        expect(byOffset[0]).toEqual({ line: "PUSH1 0x60", lineNumber: 0 });
        expect(byOffset[2]).toEqual({ line: "PUSH1 0x40", lineNumber: 1 });
        expect(byOffset[4]).toEqual({ line: "MSTORE", lineNumber: 2 });
        expect(byOffset[5]).toEqual({ line: "JUMPDEST", lineNumber: 3 });
        expect(byOffset[6]).toBeUndefined();
    });
});

describe("normalizeDisassembly", () => {
    it("strips disassembler annotations and blank lines", () => {
        const source = [
            "PUSH1 0x60",
            "",
            "'a8'(Unknown Opcode)",
            "  JUMPDEST  ",
            "PUSH2   0x0127\r",
        ].join("\n");

        expect(normalizeDisassembly(source)).toEqual(["PUSH1 0x60", "a8", "JUMPDEST", "PUSH2 0x0127"]);
    });
});
