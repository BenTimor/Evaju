import { readFile } from "node:fs/promises";
import { EVMValue } from "./evm-value";
import { calculateLinesByOffset, getInstructionFromLine, lineBytes } from "./utils";
import { opcodeParsers, type IOpcodeParser } from "./opcode-parsers";

const config = {}

function parseOpcode(opcode: string, offset: number = 0, stack: EVMValue[] = [], memory: Record<string, EVMValue> = {}): string {
    const lines = opcode.split("\n");
    const linesByOffset = calculateLinesByOffset(lines);
    const readableCodeBuilder: string[] = [];

    const startLineDetails = linesByOffset[offset];

    if (!startLineDetails) {
        throw new Error(`Offset ${offset} passed into parseOpcode is invalid`);
    }

    let currentOffset = offset;

    for (const line of lines.slice(startLineDetails.lineNumber)) {
        const instruction = getInstructionFromLine(line);
        const args = line.split(" ").slice(1);

        const parser: IOpcodeParser | undefined = opcodeParsers[instruction];

        if (parser) {
            const done = parser.parse(args, {
                currentOffset,
                line,
                lines,
                linesByOffset,
                memory,
                opcode,
                originalOffset: offset,
                stack,
                readableCodeBuilder,
                parentCallback: (...args) => parseOpcode(...args),
                config,
            });

            if (done) {
                break;
            }

            currentOffset += lineBytes(line);
        }
        else {
            console.warn(`Unknown instruction ${instruction}. Ignoring and continuing.`);
        }
    }

    return readableCodeBuilder.join("\n");
}

async function main() {
    const opcodeExample = (await readFile("easy.opcode")).toString();
    console.log(parseOpcode(opcodeExample));
}

main();