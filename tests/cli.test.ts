import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli";

describe("parseArgs", () => {
    it("has sensible defaults", () => {
        const options = parseArgs([]);

        expect(options.input).toBe("easy.opcode");
        expect(options.output).toBeUndefined();
        expect(options.stdout).toBe(false);
        expect(options.cache).toBe(true);
        expect(options.context).toEqual({});
    });

    it("accepts a positional input path", () => {
        expect(parseArgs(["contract.opcode"]).input).toBe("contract.opcode");
    });

    it("accepts output flags in both forms", () => {
        expect(parseArgs(["in.opcode", "-o", "out.txt"])).toMatchObject({ input: "in.opcode", output: "out.txt" });
        expect(parseArgs(["--output=out.txt"])).toMatchObject({ output: "out.txt" });
    });

    it("parses calldata and address style values", () => {
        const options = parseArgs([
            "--calldata", "0xAB",
            "--caller", "0x1234",
            "--address", "0xdead",
            "--value", "1000",
            "--gas", "0x10",
        ]);

        expect(options.context).toEqual({
            calldata: "0xab",
            caller: 0x1234n,
            address: 0xdeadn,
            value: 1000n,
            gas: 0x10n,
        });
    });

    it("normalizes calldata without a 0x prefix", () => {
        expect(parseArgs(["--calldata", "aabb"]).context.calldata).toBe("0xaabb");
        expect(parseArgs(["--calldata", "0x"]).context.calldata).toBe("0x");
    });

    it("rejects malformed calldata", () => {
        expect(() => parseArgs(["--calldata", "0xabc"])).toThrow(/whole number of bytes/i);
        expect(() => parseArgs(["--calldata", "0xzz"])).toThrow(/hex/i);
    });

    it("rejects malformed numbers", () => {
        expect(() => parseArgs(["--caller", "not-a-number"])).toThrow(/--caller/);
    });

    it("parses switches", () => {
        expect(parseArgs(["--stdout", "--json", "--no-cache"]).stdout).toBe(true);
        expect(parseArgs(["--json"]).json).toBe(true);
        expect(parseArgs(["--no-cache"]).cache).toBe(false);
        expect(parseArgs(["--no-functions"]).extractFunctions).toBe(false);
        expect(parseArgs([]).extractFunctions).toBe(true);
        expect(parseArgs(["--help"]).help).toBe(true);
        expect(parseArgs(["-h"]).help).toBe(true);
        expect(parseArgs(["-v"]).version).toBe(true);
    });

    it("parses the maximum depth", () => {
        expect(parseArgs(["--max-depth", "12"]).maxDepth).toBe(12);
        expect(() => parseArgs(["--max-depth", "-1"])).toThrow(/non negative/i);
        expect(() => parseArgs(["--max-depth", "abc"])).toThrow(/non negative/i);
    });

    it("rejects unknown flags and missing values", () => {
        expect(() => parseArgs(["--nope"])).toThrow(/unknown option/i);
        expect(() => parseArgs(["--output"])).toThrow(/missing value/i);
    });

    it("rejects more than one positional argument", () => {
        expect(() => parseArgs(["a.opcode", "b.opcode"])).toThrow(/unexpected arguments/i);
    });
});
