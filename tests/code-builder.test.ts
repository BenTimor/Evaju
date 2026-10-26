import { describe, expect, it, vi } from "vitest";
import { CustomInstruction, IfStatementInstruction, stringifyBody } from "../src/code-builder";
import { EVMValue, EVMValueTypes } from "../src/evm-value";
import { decompile } from "../src/decompiler";
import { assemble } from "./helpers/assemble";

const cond = (description: string) => new EVMValue(description, EVMValueTypes.CUSTOM);
const comment = (text: string) => new CustomInstruction(text);

describe("stringifyBody", () => {
    it("skips empty entries", () => {
        expect(stringifyBody([comment("// a"), comment("   "), comment("// b")])).toBe("// a\n// b");
    });

    it("returns an empty string for an empty body", () => {
        expect(stringifyBody([])).toBe("");
    });
});

describe("IfStatementInstruction", () => {
    it("renders if / else", () => {
        const instruction = new IfStatementInstruction(
            [cond("[A]")],
            [[comment("// then")], [comment("// else")]],
        );

        expect(instruction.stringifyInstruction()).toBe([
            "if [A] {",
            "  // then",
            "}",
            "else {",
            "  // else",
            "}",
        ].join("\n"));
    });

    it("renders if / else if chains", () => {
        const instruction = new IfStatementInstruction(
            [cond("[A]"), cond("[B]")],
            [[comment("// a")], [comment("// b")], [comment("// rest")]],
        );

        expect(instruction.stringifyInstruction()).toBe([
            "if [A] {",
            "  // a",
            "}",
            "else if [B] {",
            "  // b",
            "}",
            "else {",
            "  // rest",
            "}",
        ].join("\n"));
    });

    it("flattens a lone nested if in the else branch", () => {
        const nested = new IfStatementInstruction(
            [cond("[B]")],
            [[comment("// b")], [comment("// c")]],
        );
        const instruction = new IfStatementInstruction([cond("[A]")], [[comment("// a")], [nested]]);

        expect(instruction.stringifyInstruction()).toBe([
            "if [A] {",
            "  // a",
            "}",
            "else if [B] {",
            "  // b",
            "}",
            "else {",
            "  // c",
            "}",
        ].join("\n"));
    });

    it("drops branches that repeat a condition", () => {
        const instruction = new IfStatementInstruction(
            [cond("[A]"), cond("[A]")],
            [[comment("// first")], [comment("// unreachable")], [comment("// else")]],
        );

        const rendered = instruction.stringifyInstruction();

        expect(rendered).toContain("// first");
        expect(rendered).not.toContain("// unreachable");
    });

    it("marks an empty branch instead of emitting a dangling block", () => {
        const instruction = new IfStatementInstruction([cond("[A]")], [[], []]);

        expect(instruction.stringifyInstruction()).toBe([
            "if [A] {",
            "  // (branch ends here)",
            "}",
        ].join("\n"));
    });

    it("does not emit the old 'Stop program (by if)' noise", () => {
        expect(decompile(assemble(`
            CALLDATASIZE
            ISZERO
            PUSH2 @target
            JUMPI
            STOP
            target:
            JUMPDEST
            STOP
        `))).not.toContain("Stop program");
    });

    it("caches the rendered text (guards against exponential rendering)", () => {
        const inner = new IfStatementInstruction([cond("[B]")], [[comment("// b")], []]);
        const spy = vi.spyOn(inner, "stringifyInstruction");
        const outer = new IfStatementInstruction([cond("[A]")], [[comment("// a")], [inner]]);

        const first = outer.stringifyInstruction();
        const second = outer.stringifyInstruction();

        expect(first).toBe(second);
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
