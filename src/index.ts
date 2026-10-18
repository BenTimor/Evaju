import { readFile, writeFile } from "node:fs/promises";
import { EVMValue } from "./evm-value";
import { calculateLinesByOffset, getInstructionFromLine, lineBytes } from "./utils";
import { opcodeParsers, type IOpcodeParser } from "./opcode-parsers";
import { OpcodeCSV } from "./opcodes";
import { AbstractInstruction } from "./code-builder";

const config = {}

function parseOpcode(opcode: string, offset: number = 0, stack: EVMValue[] = [], memory: Record<string, EVMValue> = {}, unknownInstructions: Set<string> = new Set(), visitedOffset: Set<number> = new Set(), depth: number = 0): string {
    const lines = opcode.split("\n");
    const linesByOffset = calculateLinesByOffset(lines);
    const codeBuilder: AbstractInstruction[] = [];

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
                codeBuilder,
                parentCallback: (...args) => parseOpcode(...args, unknownInstructions, new Set(visitedOffset), depth + 1),
                config,
            });

            if (done) {
                break;
            }

            currentOffset += lineBytes(line);
        }
        else {
            if (!unknownInstructions.has(instruction)) {
                console.warn(`Unknown instruction ${instruction}. Ignoring and continuing.`);
                unknownInstructions.add(instruction);
            }
        }
    }

    return codeBuilder.join("\n");
}

async function main() {
    await OpcodeCSV.init();
    
    const opcodeExample = (await readFile("easy.opcode")).toString().replaceAll("(Unknown Opcode)", "").replaceAll("'", "");
    console.log("Starting to parse");
    const parsedCode = parseOpcode(opcodeExample);
    console.log("Code parsed. Writing to file.");
    await writeFile("output.evaju", parsedCode);
    console.log("Done");
}

main();