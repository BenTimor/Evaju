#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { decompileWithReport } from "./decompiler";
import type { ExecutionContext } from "./opcode-parsers/base";
import { unknownBaseStringToNumber } from "./utils";

const DEFAULT_INPUT = "easy.opcode";
const DEFAULT_OUTPUT = "output.evaju";

const HELP = `OPCodeDecompiler - turn an EVM opcode listing into readable pseudo-code

Usage:
  opcode-decompiler [input.opcode] [options]

Options:
  -o, --output <file>      Where to write the pseudo-code (default: ${DEFAULT_OUTPUT})
      --stdout             Print the pseudo-code instead of writing a file
      --calldata <hex>     Calldata of the modelled transaction
      --caller <value>     CALLER address (0x prefixed hex)
      --address <value>    ADDRESS of the contract (0x prefixed hex)
      --value <value>      CALLVALUE in wei
      --gas <value>        Remaining gas when execution starts
      --max-depth <n>      Maximum nested jump depth (default: 50)
      --opcodes <file>     Use a custom opcodes.csv
      --no-cache           Disable jump-target memoization
      --json               Print the report as JSON
  -h, --help               Show this help
  -v, --version            Show the version

The input must be a disassembler style listing, one instruction per line:

  PUSH1 0x80
  PUSH1 0x40
  MSTORE
  CALLDATASIZE
  PUSH2 0x0127
  JUMPI
`;

export type CliOptions = {
    input: string,
    output?: string,
    stdout: boolean,
    json: boolean,
    maxDepth?: number,
    opcodeCsvPath?: string,
    cache: boolean,
    context: ExecutionContext,
    help: boolean,
    version: boolean,
};

export function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = {
        input: DEFAULT_INPUT,
        stdout: false,
        json: false,
        cache: true,
        context: {},
        help: false,
        version: false,
    };

    const context = options.context;
    const positional: string[] = [];

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];

        if (argument === undefined) {
            continue;
        }

        if (!argument.startsWith("-")) {
            positional.push(argument);
            continue;
        }

        const [flag, inlineValue] = splitFlag(argument);
        const takeValue = (): string => {
            if (inlineValue !== undefined) {
                return inlineValue;
            }

            const next = argv[++index];

            if (next === undefined) {
                throw new Error(`Missing value for ${flag}`);
            }

            return next;
        };

        switch (flag) {
            case "-h":
            case "--help":
                options.help = true;
                break;
            case "-v":
            case "--version":
                options.version = true;
                break;
            case "-o":
            case "--output":
                options.output = takeValue();
                break;
            case "--stdout":
                options.stdout = true;
                break;
            case "--json":
                options.json = true;
                break;
            case "--no-cache":
                options.cache = false;
                break;
            case "--max-depth":
                options.maxDepth = parseInteger(flag, takeValue());
                break;
            case "--opcodes":
                options.opcodeCsvPath = takeValue();
                break;
            case "--calldata":
                context.calldata = parseCalldata(takeValue());
                break;
            case "--caller":
                context.caller = parseBigInt(flag, takeValue());
                break;
            case "--address":
                context.address = parseBigInt(flag, takeValue());
                break;
            case "--value":
                context.value = parseBigInt(flag, takeValue());
                break;
            case "--gas":
                context.gas = parseBigInt(flag, takeValue());
                break;
            default:
                throw new Error(`Unknown option ${argument}`);
        }
    }

    const [firstPositional] = positional;

    if (firstPositional !== undefined) {
        options.input = firstPositional;
    }

    if (positional.length > 1) {
        throw new Error(`Unexpected arguments: ${positional.slice(1).join(" ")}`);
    }

    return options;
}

function splitFlag(argument: string): [string, string | undefined] {
    const separator = argument.indexOf("=");

    if (separator === -1) {
        return [argument, undefined];
    }

    return [argument.slice(0, separator), argument.slice(separator + 1)];
}

function parseInteger(flag: string, raw: string): number {
    const value = Number(raw);

    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${flag} expects a non negative integer, received "${raw}"`);
    }

    return value;
}

function parseBigInt(flag: string, raw: string): bigint {
    try {
        return unknownBaseStringToNumber(raw);
    }
    catch (error) {
        throw new Error(`${flag} expects a number, received "${raw}": ${(error as Error).message}`);
    }
}

function parseCalldata(raw: string): string {
    const value = raw.trim().toLowerCase();
    const hex = value.startsWith("0x") ? value.slice(2) : value;

    if (hex.length === 0) {
        return "0x";
    }

    if (!/^[0-9a-f]+$/.test(hex)) {
        throw new Error(`--calldata expects hex bytes, received "${raw}"`);
    }

    if (hex.length % 2 !== 0) {
        throw new Error(`--calldata must contain a whole number of bytes, received "${raw}"`);
    }

    return `0x${hex}`;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
    let options: CliOptions;

    try {
        options = parseArgs(argv);
    }
    catch (error) {
        console.error(`error: ${(error as Error).message}`);
        console.error("Run with --help for usage information.");
        return 1;
    }

    if (options.help) {
        console.log(HELP);
        return 0;
    }

    if (options.version) {
        const { version } = await readPackageJson();
        console.log(version);
        return 0;
    }

    let source: string;

    try {
        source = await readFile(options.input, "utf8");
    }
    catch (error) {
        console.error(`error: cannot read input "${options.input}": ${(error as Error).message}`);
        return 1;
    }

    const report = decompileWithReport(source, {
        context: options.context,
        cache: options.cache,
        ...(options.maxDepth === undefined ? {} : { maxDepth: options.maxDepth }),
        ...(options.opcodeCsvPath === undefined ? {} : { opcodeCsvPath: options.opcodeCsvPath }),
    });

    if (options.json) {
        console.log(JSON.stringify({
            code: report.code,
            warnings: report.warnings,
            bytecode: report.bytecode,
            instructionCount: report.instructionCount,
        }, null, 2));
        return 0;
    }

    if (options.stdout) {
        console.log(report.code);
    }
    else {
        const output = options.output ?? DEFAULT_OUTPUT;
        await writeFile(output, `${report.code}\n`);
        console.error(`Decompiled ${report.instructionCount} instructions -> ${output} (${report.code.split("\n").length} lines)`);
    }

    for (const warning of report.warnings) {
        console.error(`warning: ${warning}`);
    }

    return 0;
}

async function readPackageJson(): Promise<{ version: string }> {
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const candidates: string[] = [];

    if (typeof __dirname === "string") {
        // dist/cli.js -> <root>/package.json and src/cli.ts -> <root>/package.json
        candidates.push(resolve(__dirname, "..", "package.json"), resolve(__dirname, "package.json"));
    }

    candidates.push(resolve(process.cwd(), "package.json"));

    const path = candidates.find(candidate => existsSync(candidate));

    if (path === undefined) {
        throw new Error("Could not locate package.json");
    }

    return JSON.parse(await readFile(path, "utf8")) as { version: string };
}

// Allow importing this module (from tests) without running the CLI.
if (typeof require !== "undefined" && require.main === module) {
    main().then(code => process.exit(code)).catch(error => {
        console.error(`error: ${(error as Error).message}`);
        process.exit(1);
    });
}
