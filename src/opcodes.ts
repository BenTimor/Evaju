import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvFileSync } from "./csv-parse";
import { getInstructionArgs, getInstructionFromLine, normalizeDisassembly, stripHexPrefix } from "./utils";

export type OpcodeCSVLine = {
    Opcode: string;
    Name: string;
    Description: string;
    "Extra Info": string;
    Gas: string;
};

const OPCODE_PATTERN = /^0x[0-9a-f]{2}$/;
const NAME_PATTERN = /^[A-Z][A-Z0-9]*$/;

/**
 * Opcodes that are missing from the bundled CSV, or that the CSV knows under a
 * different name, but which appear in modern disassembler output.
 */
const EXTRA_OPCODES: Record<string, string> = {
    PUSH0: "5f",
    PC: "58", // the CSV calls it GETPC
    PREVRANDAO: "44", // the CSV calls it DIFFICULTY
    SELFBALANCE: "47", // the CSV marks 0x47..0x4f as unused
    TLOAD: "5c",
    TSTORE: "5d",
    MCOPY: "5e",
    BLOBHASH: "49",
};

/** Locates `opcodes.csv` next to the package, no matter the current directory. */
export function defaultOpcodeCsvPath(): string {
    const candidates: string[] = [];

    if (typeof __dirname === "string") {
        // dist/opcodes.js -> <root>/opcodes.csv and src/opcodes.ts -> <root>/opcodes.csv
        candidates.push(resolve(__dirname, "..", "opcodes.csv"), resolve(__dirname, "opcodes.csv"));
    }

    candidates.push(resolve(process.cwd(), "opcodes.csv"));

    const found = candidates.find(candidate => existsSync(candidate));

    return found ?? candidates[0] ?? "opcodes.csv";
}

export class OpcodeCSV {
    static opcodeCSVData: OpcodeCSVLine[] = [];

    private static nameToBytecode = new Map<string, string>();
    private static bytecodeToName = new Map<string, string>();
    private static bytecodeCache = new Map<string, string>();

    static async init(filePath: string = defaultOpcodeCsvPath()): Promise<void> {
        OpcodeCSV.load(filePath);
    }

    /** Synchronously makes sure the table is loaded, used by opcode parsers. */
    static ensureLoaded(filePath: string = defaultOpcodeCsvPath()): void {
        if (OpcodeCSV.nameToBytecode.size === 0) {
            OpcodeCSV.load(filePath);
        }
    }

    static load(filePath: string = defaultOpcodeCsvPath()): void {
        const rows = parseCsvFileSync<OpcodeCSVLine>(filePath);

        OpcodeCSV.opcodeCSVData = rows;
        OpcodeCSV.nameToBytecode = new Map();
        OpcodeCSV.bytecodeToName = new Map();
        OpcodeCSV.bytecodeCache = new Map();

        for (const row of rows) {
            const name = (row.Name ?? "").trim().toUpperCase();
            const opcode = (row.Opcode ?? "").trim().toLowerCase();

            // Skip documentation placeholders such as "0x0c - 0x0f,Unused".
            if (!NAME_PATTERN.test(name) || name === "UNUSED" || !OPCODE_PATTERN.test(opcode)) {
                continue;
            }

            const bytecode = opcode.slice(2);

            if (!OpcodeCSV.nameToBytecode.has(name)) {
                OpcodeCSV.nameToBytecode.set(name, bytecode);
            }

            if (!OpcodeCSV.bytecodeToName.has(bytecode)) {
                OpcodeCSV.bytecodeToName.set(bytecode, name);
            }
        }

        for (const [name, bytecode] of Object.entries(EXTRA_OPCODES)) {
            if (!OpcodeCSV.nameToBytecode.has(name)) {
                OpcodeCSV.nameToBytecode.set(name, bytecode);
            }

            if (!OpcodeCSV.bytecodeToName.has(bytecode)) {
                OpcodeCSV.bytecodeToName.set(bytecode, name);
            }
        }

        if (OpcodeCSV.nameToBytecode.size === 0) {
            throw new Error(`No opcodes could be read from ${filePath}`);
        }
    }

    /** Bytecode (lowercase hex, no `0x`) for an instruction name. */
    static bytecodeOf(instruction: string): string | undefined {
        OpcodeCSV.ensureLoaded();

        return OpcodeCSV.nameToBytecode.get(instruction.toUpperCase());
    }

    /** Like `toBytecode`, but returns `undefined` instead of throwing. */
    static tryToBytecode(opcode: string): string | undefined {
        try {
            return OpcodeCSV.toBytecode(opcode);
        }
        catch {
            return undefined;
        }
    }

    /** Instruction name for a single byte opcode (`"60"` -> `"PUSH1"`). */
    static nameOf(bytecode: string): string | undefined {
        OpcodeCSV.ensureLoaded();

        return OpcodeCSV.bytecodeToName.get(stripHexPrefix(bytecode).padStart(2, "0"));
    }

    /**
     * Converts an opcode listing into `0x` prefixed bytecode.
     * Unknown instruction names that look like raw hex bytes (the way
     * disassemblers render invalid opcodes, e.g. `a8`) are emitted as data.
     */
    static toBytecode(opcode: string): string {
        const cached = OpcodeCSV.bytecodeCache.get(opcode);

        if (cached !== undefined) {
            return cached;
        }

        OpcodeCSV.ensureLoaded();

        const output: string[] = [];

        for (const line of normalizeDisassembly(opcode)) {
            const instruction = getInstructionFromLine(line);
            const args = getInstructionArgs(line);
            const bytecode = OpcodeCSV.nameToBytecode.get(instruction);

            if (bytecode === undefined) {
                const rawByte = /^(?:0x)?([0-9a-f]{1,2})$/i.exec(instruction);

                if (!rawByte?.[1]) {
                    throw new Error(`Cannot convert unknown instruction "${instruction}" to bytecode`);
                }

                output.push(rawByte[1].padStart(2, "0"));
                continue;
            }

            output.push(bytecode);

            if (instruction.startsWith("PUSH") && instruction !== "PUSH0") {
                const pushSize = Number(instruction.slice("PUSH".length));
                const immediate = stripHexPrefix(args[0] ?? "");

                // Keep exactly `pushSize` bytes; a malformed listing must not shift the code.
                output.push(immediate.slice(-pushSize * 2).padStart(pushSize * 2, "0"));
            }
        }

        const result = `0x${output.join("")}`;

        OpcodeCSV.bytecodeCache.set(opcode, result);

        return result;
    }
}
