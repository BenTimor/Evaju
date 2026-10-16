import { readFile, writeFile } from "node:fs/promises";
import { EVMValue } from "./evm-value";
import { calculateLinesByOffset, getInstructionFromLine, lineBytes } from "./utils";
import { opcodeParsers, type IOpcodeParser } from "./opcode-parsers";

const config = {}

function parseOpcode(opcode: string, offset: number = 0, stack: EVMValue[] = [], memory: Record<string, EVMValue> = {}, visitedOffset: Set<number> = new Set(), depth: number = 0): string {
    const lines = opcode.split("\n");
    const linesByOffset = calculateLinesByOffset(lines);
    const readableCodeBuilder: string[] = [];

    if (depth === 50) {
        return "// Depth too big";
    }

    const startLineDetails = linesByOffset[offset];

    if (!startLineDetails) {
        throw new Error(`Offset ${offset} passed into parseOpcode is invalid`);
    }

    let currentOffset = offset;

    for (const line of lines.slice(startLineDetails.lineNumber)) {
        if (visitedOffset.has(currentOffset)) {
            return `// Recursion - Trying to call ${currentOffset} which equals to line number ${linesByOffset[currentOffset]?.lineNumber} with the code ${linesByOffset[currentOffset]?.line}`;
        }

        visitedOffset.add(currentOffset);

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
                parentCallback: (...args) => parseOpcode(...args, new Set(visitedOffset), depth + 1),
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
    console.log("Starting to parse");
    const parsedCode = parseOpcode(opcodeExample);
    console.log("Code parsed. Writing to file.");
    await writeFile("output.evaju", parsedCode);
    console.log("Done");
}

main();