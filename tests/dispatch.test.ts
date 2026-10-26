import { beforeAll, describe, expect, it } from "vitest";
import { decompile, decompileWithReport } from "../src/decompiler";
import { OpcodeCSV } from "../src/opcodes";
import { assemble } from "./helpers/assemble";

beforeAll(() => {
    OpcodeCSV.load();
});

/** `calldataload(0) / 2**224`, the selector extraction used by older compilers. */
const selectorViaDiv = `
    PUSH1 0xe0
    PUSH1 0x02
    EXP
    PUSH1 0x00
    CALLDATALOAD
    DIV
`;

/**
 * `calldataload(0) >> 0xe0`, the selector extraction used by newer compilers.
 * SHR takes the shift amount from the top of the stack, so it is pushed last.
 */
const selectorViaShr = `
    PUSH1 0x00
    CALLDATALOAD
    PUSH1 0xe0
    SHR
`;

function dispatch(selectorExpression: string): string {
    return assemble(`
        ${selectorExpression}
        PUSH4 0x12345678
        EQ
        PUSH2 @handler
        JUMPI
        PUSH1 0x00
        DUP1
        REVERT
        handler:
        JUMPDEST
        PUSH1 0x2a
        PUSH1 0x00
        SSTORE
        STOP
    `);
}

describe("selector recognition", () => {
    it("renders the DIV based selector extraction as msg.sig", () => {
        const code = decompile(dispatch(selectorViaDiv));

        expect(code).toContain("0x12345678 == msg.sig");
        expect(code).not.toContain("0x0100000000000000000000000000000000000000000000000000000000");
    });

    it("renders the SHR based selector extraction as msg.sig", () => {
        const code = decompile(dispatch(selectorViaShr));

        expect(code).toContain("0x12345678 == msg.sig");
        expect(code).not.toContain(">>  (0xe0");
    });

    it("does not treat a load from a non zero offset as the selector", () => {
        const code = decompile(assemble(`
            PUSH1 0x04
            CALLDATALOAD
            PUSH1 0xe0
            SHR
            PUSH4 0x12345678
            EQ
            PUSH2 @handler
            JUMPI
            STOP
            handler:
            JUMPDEST
            STOP
        `));

        expect(code).not.toContain("msg.sig");
        expect(code).toContain("[Calldata[0x04]]");
    });

    it("shows msg.sig in the counter example", () => {
        const code = decompile(require("node:fs").readFileSync("examples/counter.opcode", "utf8"));

        expect(code).toContain("0x6d4ce63c == msg.sig");
        expect(code).toContain("0x2baeceb7 == msg.sig");
    });
});

describe("dispatch entry functions", () => {
    it("extracts a dispatcher target named after its selector", () => {
        const report = decompileWithReport(dispatch(selectorViaDiv));

        expect(report.functions).toHaveLength(1);

        const [fn] = report.functions;

        expect(fn?.selector).toBe(0x12345678n);
        expect(fn?.label).toBe("function_12345678");
        expect(fn?.returns).toBe(false);
        expect(report.code).toContain("function_12345678();");
        expect(report.code).toContain(`// --- function_12345678 (selector 0x12345678, offset 0x${fn?.offset.toString(16)}) ---`);
        expect(report.code).toContain("// STORAGE[0x00] = 0x2a");
    });

    it("keeps the fallback branch inline", () => {
        const code = decompile(dispatch(selectorViaDiv));

        expect(code).toContain("// [REVERT] Revert: 0x");
    });

    it("still renders msg.sig when function extraction is disabled", () => {
        const code = decompile(dispatch(selectorViaDiv), { extractFunctions: false });

        expect(code).toContain("0x12345678 == msg.sig");
        expect(code).not.toContain("function_");
        expect(code).toContain("// STORAGE[0x00] = 0x2a");
    });

    it("resolves the dispatch statically when calldata is known", () => {
        const report = decompileWithReport(dispatch(selectorViaDiv), { context: { calldata: "0x12345678" } });

        expect(report.functions).toEqual([]);
        expect(report.code).toBe("// STORAGE[0x00] = 0x2a\n// Stop successfully");
        expect(report.code).not.toContain("msg.sig");
    });

    it("names entry functions by selector in the report", () => {
        const report = decompileWithReport(require("node:fs").readFileSync("examples/counter.opcode", "utf8"));
        const selectors = report.functions.map(fn => fn.selector?.toString(16));

        expect(selectors).toEqual(["6d4ce63c", "2baeceb7"]);
    });

    it("does not duplicate the body at the call site", () => {
        const report = decompileWithReport(dispatch(selectorViaDiv));
        const body = "// STORAGE[0x00] = 0x2a";

        expect(report.code.split(body)).toHaveLength(2);
    });
});
