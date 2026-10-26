# OPCodeDecompiler

Turn an EVM opcode listing into readable pseudo-code.

Given a disassembly-style listing (one instruction per line, `PUSH` immediates included),
the decompiler symbolically executes it, follows `JUMP`/`JUMPI`, rebuilds expressions,
models memory byte by byte, and prints an `if` / `else if` / `else` tree with storage
writes, calls, logs and return data. External dispatch is rendered as a selector check
against `msg.sig`, and every entry point becomes a named function.

```
$ node dist/cli.js examples/counter.opcode --stdout

if (0x00 == [CALLDATASIZE]) {
  // Stop successfully
}
else if (0x6d4ce63c == msg.sig) {
  function_6d4ce63c();
}
else if (0x2baeceb7 == msg.sig) {
  function_2baeceb7();
}
else {
  // [REVERT] Revert: 0x
}

// --- function_6d4ce63c (selector 0x6d4ce63c, offset 0x2e) ---
function_6d4ce63c() {
  // [RETURN] Return: [STORAGE[0x00]]
}

// --- function_2baeceb7 (selector 0x2baeceb7, offset 0x3a) ---
function_2baeceb7() {
  // STORAGE[0x00] = ([STORAGE[0x00]] + 0x01)
  // Stop successfully
}
```

The 4 byte selector is recognised in both of its common forms — `calldataload(0) >> 0xe0`
and `calldataload(0) / 2**224` — and printed as `msg.sig`. Entry functions are named after
their selector, so a branch can be matched against an ABI without extra tooling.

Because everything is symbolic, telling the decompiler what the transaction looks like
collapses the branches statically:

```
$ node dist/cli.js examples/counter.opcode --stdout --calldata 0x6d4ce63c
// [RETURN] Return: [STORAGE[0x00]]

$ node dist/cli.js examples/counter.opcode --stdout --calldata 0x2baeceb7
// STORAGE[0x00] = ([STORAGE[0x00]] + 0x01)
// Stop successfully
```

Code shared between call sites is extracted into a function and called from each of them:

```
$ node dist/cli.js examples/shared-helper.opcode --stdout

function_17();
function_17();
// Stop successfully

// --- function_17 (offset 0x17) ---
function_17() {
  // STORAGE[0x00] = 0x07
  // return
}
```

## Install and build

```bash
pnpm install        # or npm install
pnpm build          # tsc -> dist/
pnpm test           # vitest
```

Requires Node 20+.

## Input format

The input is the textual opcode listing produced by disassemblers (Etherscan, evm.codes,
`evm disasm`, ...):

```
PUSH1 0x80
PUSH1 0x40
MSTORE
CALLDATASIZE
ISZERO
PUSH2 0x0045
JUMPI
...
```

* `PUSHn <immediate>` on one line; every other instruction on its own line.
* Byte offsets are derived the way the EVM sees them: `PUSHn` occupies `n + 1` bytes.
* Bytes the disassembler could not decode (`'a8'(Unknown Opcode)`) are treated as one
  byte of data and reported as a warning, so later jump targets stay correct.

## CLI

```bash
node dist/cli.js [input.opcode] [options]
```

| Option | Description |
| --- | --- |
| `-o, --output <file>` | Where to write the pseudo-code (default `output.evaju`) |
| `--stdout` | Print the pseudo-code instead of writing a file |
| `--calldata <hex>` | Calldata of the modelled transaction |
| `--caller <value>` | `CALLER` address |
| `--address <value>` | `ADDRESS` of the contract |
| `--value <value>` | `CALLVALUE` in wei |
| `--gas <value>` | Remaining gas when execution starts |
| `--max-depth <n>` | Maximum nested jump depth (default 100) |
| `--opcodes <file>` | Use a custom `opcodes.csv` |
| `--no-cache` | Disable jump-target memoization |
| `--no-functions` | Inline shared code and dispatcher entries instead of extracting functions |
| `--json` | Print code, warnings, functions, bytecode and stats as JSON |
| `-h, --help` / `-v, --version` | Usage / version |

Numeric values accept `0x`, `0b`, `0o` or decimal notation.

## Library

```ts
import { decompile, decompileWithReport, EVMMemory, type ExecutionContext } from "opcode-decompiler";

// Pseudo-code only
const code = decompile(listing);

// Pseudo-code plus warnings, extracted functions, bytecode and instruction count
const report = decompileWithReport(listing, {
    context: {
        calldata: "0x6d4ce63c",
        caller: 0x1234n,
        value: 0n,
    },
    maxDepth: 100,
    extractFunctions: true,
});

report.code;                                  // string, functions included
report.functions;                             // [{ label, offset, selector?, returns, stackDelta, body }]
report.warnings;                              // ["Unknown instruction \"a8\" (treated as a 1 byte data byte)"]
report.bytecode;                              // "0x6080604052..."
```

`parseOpcode(listing, offset?, stack?, memory?, storage?)` is still exported for callers
that want the raw `AbstractInstruction` tree. `memory` accepts an `EVMMemory` (or the old
`Record<string, EVMValue>` shape, which is converted).

## How it works

1. `normalizeDisassembly` cleans the listing and `calculateLinesByOffset` maps every byte
   offset to its line, so jump destinations line up with the EVM.
2. `walk` executes instructions one by one against a symbolic machine state:
   * `stack: EVMValue[]` — 256 bit values. Known numbers fold eagerly; everything else
     keeps a printable description (`[CALLER]`, `([A] + 0x04)`, ...).
   * `EVMMemory` — a sparse byte array plus symbolic regions, so `MSTORE`, `MSTORE8`,
     `CALLDATACOPY` and `MCOPY` alias each other exactly like on chain.
   * `storage` — a record keyed by the description of the slot.
   * `execution context` — calldata/caller/value/address/gas, when supplied.
3. `JUMP`/`JUMPI` recurse into the target (and the fall-through) and produce
   `IfStatementInstruction`s. Known conditions skip the unreachable side, symbolic ones
   keep both. Loops are cut with a `// Loop back to offset N` marker, and nested ifs are
   flattened into `else if` chains.
4. A first pass records every unconditional jump target and its call sites, plus every
   `msg.sig == 0x<selector>` dispatcher entry. Dispatcher entries always become functions
   (named `function_<selector>`); other targets are extracted when they are jumped to from
   more than one place (and are not loops). The body is analysed once, called as
   `function_<label>()`, and the caller continues after the call. A jump to the instruction
   right after a call site reads as `// return`.
5. `AbstractInstruction.stringifyInstruction()` renders the tree; extracted functions are
   appended below the main body.

Parsers live in `src/opcode-parsers/`, one class per opcode family (`GenericOperator` for
the arithmetic/logic ops, `CallLike` for call variants, `StackOpsParser` for opcodes that
are modelled by their stack effect only).

## Project layout

```
src/
  cli.ts              command line entry point (bin: opcode-decompiler)
  decompiler.ts       walker, memoization, function extraction, decompile()
  memory.ts           byte addressable EVM memory with symbolic regions
  evm-value.ts        EVMValue, ComputedNumber, EVMOperatorValue + operator semantics
  code-builder.ts     AbstractInstruction, IfStatementInstruction, rendering
  opcodes.ts          opcodes.csv loading, name <-> bytecode, listing -> bytecode
  utils.ts            256 bit helpers, byte slicing, offset calculation
  opcode-parsers/     one parser per opcode family
opcodes.csv           instruction table (used for CODECOPY/CODESIZE + validation)
examples/             small listings used in this README
tests/                vitest suites + a tiny assembler helper for readable fixtures
```

## Coverage

Implemented: the full arithmetic/logic set (`ADD`..`SAR`, `ADDMOD`, `MULMOD`,
`SIGNEXTEND`), memory and storage (`MLOAD`, `MSTORE`, `MSTORE8`, `SLOAD`, `SSTORE`,
`TLOAD`, `TSTORE`, `MCOPY`), calldata/code access (`CALLDATALOAD`, `CALLDATACOPY`,
`CODESIZE`, `CODECOPY`, `EXTCODE*`, `RETURNDATA*`), environment and block opcodes,
`KECCAK256`, `LOG0..4`, all call/creation opcodes, jumps, `RETURN`, `REVERT`,
`SELFDESTRUCT`, `INVALID`, `STOP`, and `PUSH0..32` / `DUP1..16` / `SWAP1..16`.

Anything else is reported once as a warning and skipped as one data byte, so offsets
never drift.

## Limitations

* An extracted function body is analysed once, with the stack of the first call site.
  Other call sites show the same body, so argument dependent values reflect that site.
* Selector names come from the dispatch comparison only: without ABI data an entry point
  is `function_6d4ce63c`, not `get()`.
* Writes through a symbolic (non constant) memory offset cannot be placed in the byte
  array; they are only read back when the same symbolic offset is used again.
* Call success and callee return data are symbolic by design — no chain state is fetched.
* Loops whose back edge sits behind a conditional jump may be treated as a recursive
  function instead of a loop.
* Storage slots and addresses are printed from their symbolic expressions; no ABI
  decoding or selector names are resolved.

## License

MIT
