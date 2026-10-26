import { AbstractInstruction } from "../../src/code-builder";
import { EVMMemory } from "../../src/memory";
import type { OpcodeParserParentContext } from "../../src/opcode-parsers/base";

/** Builds a parser context for unit testing a single opcode parser. */
export function createContext(overrides: Partial<OpcodeParserParentContext> = {}): OpcodeParserParentContext {
    return {
        opcode: "",
        args: [],
        originalOffset: 0,
        stack: [],
        memory: new EVMMemory(),
        storage: {},
        line: "STOP",
        lines: [],
        linesByOffset: {},
        currentOffset: 0,
        codeBuilder: [] as AbstractInstruction[],
        parentCallback: () => [],
        config: {},
        ...overrides,
    };
}
