import { describe, expect, it } from "vitest";
import { EVMMemory } from "../src/memory";
import { EVMValue, EVMValueTypes } from "../src/evm-value";

const number = (value: bigint | number) => new EVMValue(value, EVMValueTypes.NUMBER);
const symbolic = (description: string) => new EVMValue(description, EVMValueTypes.CUSTOM);

function readHex(memory: EVMMemory, offset: number, size: number): string | undefined {
    const read = memory.read(number(offset), size);

    return read?.kind === "known" ? read.hex : undefined;
}

describe("EVMMemory", () => {
    it("stores and reads a word", () => {
        const memory = new EVMMemory();

        memory.storeWord(number(0x40), number(0x80));

        expect(readHex(memory, 0x40, 32)).toBe(`${"0".repeat(62)}80`);
        expect(memory.readWord(number(0x40))?.knownNumber).toBe(0x80n);
    });

    it("reads unwritten memory as zero", () => {
        const memory = new EVMMemory();

        expect(readHex(memory, 0x100, 4)).toBe("00000000");
        expect(memory.isEmpty).toBe(true);
    });

    it("lets byte writes alias into words", () => {
        const memory = new EVMMemory();

        memory.storeWord(number(0), number(0x1111));
        memory.storeByte(number(31), number(0x22));

        expect(readHex(memory, 0, 32)).toBe(`${"0".repeat(60)}1122`);
    });

    it("reads across word boundaries", () => {
        const memory = new EVMMemory();

        memory.storeByte(number(31), number(0xaa));
        memory.storeByte(number(32), number(0xbb));

        // A read that crosses the first word boundary.
        expect(readHex(memory, 31, 2)).toBe("aabb");
        expect(readHex(memory, 30, 4)).toBe("00aabb00");
        expect(memory.readWord(number(1))?.knownNumber).toBe(0xaabbn);
    });

    it("keeps clones independent", () => {
        const original = new EVMMemory();
        original.storeWord(number(0), number(0x11));

        const clone = original.clone();
        clone.storeWord(number(0), number(0x22));

        expect(readHex(original, 0, 32)).toBe(`${"0".repeat(62)}11`);
        expect(readHex(clone, 0, 32)).toBe(`${"0".repeat(62)}22`);
    });

    it("keeps symbolic writes symbolic", () => {
        const memory = new EVMMemory();
        const value = symbolic("[STORAGE[0x00]]");

        memory.storeWord(number(0), value);

        const exact = memory.read(number(0), 32);

        expect(exact?.kind).toBe("symbolic");
        expect(exact?.kind === "symbolic" ? exact.value.toString() : "").toBe("[STORAGE[0x00]]");

        const sliced = memory.read(number(4), 4);

        expect(sliced?.kind === "symbolic" ? sliced.value.toString() : "").toBe("[[STORAGE[0x00]][4:8]]");
    });

    it("reports mixed known and symbolic reads as unknown", () => {
        const memory = new EVMMemory();

        memory.storeWord(number(0), symbolic("[X]"));
        memory.storeByte(number(31), number(0xaa));

        expect(memory.read(number(1), 32)).toBeUndefined();
        // The byte itself is still known.
        expect(readHex(memory, 31, 1)).toBe("aa");
    });

    it("clips symbolic regions when known bytes overwrite them", () => {
        const memory = new EVMMemory();

        memory.storeWord(number(0), symbolic("[X]"));
        memory.storeByte(number(0), number(0xaa));

        const rest = memory.read(number(1), 31);

        expect(rest?.kind === "symbolic" ? rest.value.toString() : "").toBe("[[X][1:32]]");
        expect(readHex(memory, 0, 1)).toBe("aa");
    });

    it("clips known bytes when a symbolic region overwrites them", () => {
        const memory = new EVMMemory();

        memory.storeHex(number(0), 4, "deadbeef");
        memory.storeWord(number(2), symbolic("[Y]"));

        // The first two bytes survive, the ones covered by the region do not.
        expect(readHex(memory, 0, 2)).toBe("dead");
        expect(memory.read(number(2), 2)?.kind).toBe("symbolic");
    });

    it("handles multi byte copies larger than a word", () => {
        const memory = new EVMMemory();

        memory.storeHex(number(0x20), 4, "deadbeef");

        expect(readHex(memory, 0x20, 4)).toBe("deadbeef");
        expect(readHex(memory, 0x22, 2)).toBe("beef");
        expect(readHex(memory, 0x24, 2)).toBe("0000");
    });

    it("pads short hex data with zeros", () => {
        const memory = new EVMMemory();

        memory.storeHex(number(0), 4, "ff");

        expect(readHex(memory, 0, 4)).toBe("ff000000");
    });

    it("keeps writes through unknown offsets addressable", () => {
        const memory = new EVMMemory();
        const offset = symbolic("[Calldata[0x04]]");

        memory.storeWord(offset, symbolic("[Z]"));

        const read = memory.read(offset, 32);

        expect(read?.kind === "symbolic" ? read.value.toString() : "").toBe("[Z]");
        expect(memory.read(number(0), 32)?.kind).toBe("known");
    });

    it("changes its signature when contents change", () => {
        const memory = new EVMMemory();
        const empty = memory.signature;

        memory.storeWord(number(0), number(1));

        const written = memory.signature;

        expect(written).not.toBe(empty);

        memory.storeWord(number(0), number(2));

        expect(memory.signature).not.toBe(written);
    });

    it("shares the cached signature with clones until they change", () => {
        const memory = new EVMMemory();
        memory.storeWord(number(0), number(1));

        const clone = memory.clone();

        expect(clone.signature).toBe(memory.signature);

        clone.storeByte(number(5), number(9));

        expect(clone.signature).not.toBe(memory.signature);
    });
});
